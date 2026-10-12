import { APIS } from './helpers.js';

export function summarize(data, { activities, interval, runId, temporaryLimits = false, indexMode = 'baseline' }) {
  const metrics = data.metrics || {};
  const elapsed = Math.max(...activities.map(a => a.start + a.duration));
  const phaseSeconds = phase => Math.max(...activities.filter(a => a.phase === phase).map(a => a.duration));
  function row(label, filter, activeSeconds) {
    const suffix = filter ? `{${filter}}` : '';
    const metric = name => metrics[name + suffix]?.values || {};
    const count = metric('transaction_requests').count || 0;
    const success = metric('transaction_success');
    const duration = metric('transaction_duration');
    return { label, requests: count, successful: success.passes || 0, failed: success.fails || 0,
      activeSeconds, throughputActive: count ? count / activeSeconds : null,
      throughputWholeTest: count ? count / elapsed : null,
      successThroughputActive: count ? (success.passes || 0) / activeSeconds : null,
      avg: count ? duration.avg ?? null : null, median: count ? duration.med ?? null : null,
      p90: count ? duration['p(90)'] ?? null : null, p95: count ? duration['p(95)'] ?? null : null,
      max: count ? duration.max ?? null : null,
      httpFailureRate: count ? metric('transaction_http_failed').rate ?? null : null,
      checkPassRate: count ? metric('transaction_checks').rate ?? null : null,
      transactionFailureRate: !count || success.rate === undefined ? null : 1 - success.rate };
  }
  const apis = Object.keys(APIS).map(api => row(api, `api:${api}`,
    [...new Set(activities.filter(a => a.api === api).map(a => a.phase))]
      .reduce((sum, phase) => sum + phaseSeconds(phase), 0)));
  const phases = [...new Set(activities.map(a => a.phase))].map(phase => ({
    ...row(phase, `phase:${phase}`, phaseSeconds(phase)),
    concurrentVUs: activities.filter(a => a.phase === phase).reduce((sum, a) => sum + a.vus, 0),
  }));
  const apiPhases = [...new Set(activities.map(a => `${a.api},${a.phase}`))].map(key => {
    const [api, phase] = key.split(',');
    return { ...row(`${api} / ${phase}`, `api:${api},phase:${phase}`, phaseSeconds(phase)), api, phase };
  });
  const thresholdResults = [];
  for (const [metric, entry] of Object.entries(metrics)) {
    for (const [rule, result] of Object.entries(entry.thresholds || {})) thresholdResults.push({ metric, rule, passed: result.ok });
  }
  const changes = [];
  for (const api of Object.keys(APIS)) {
    const rows = apiPhases.filter(r => r.api === api);
    for (let i = 1; i < rows.length; i++) {
      const previous = rows[i - 1], current = rows[i];
      if (!previous.requests || !current.requests) continue;
      changes.push({ api, from: previous.phase, to: current.phase, fromSamples: previous.requests, toSamples: current.requests,
        p95ChangePercent: previous.p95 > 0 && current.p95 !== null ? (current.p95 / previous.p95 - 1) * 100 : null,
        throughputChangePercent: previous.throughputActive > 0 ? (current.throughputActive / previous.throughputActive - 1) * 100 : null });
    }
  }
  const overall = row('All transactions', '', elapsed);
  const observedSeconds = Number(data.state?.testRunDurationMs || 0) / 1000;
  const complete = overall.requests > 0 && phases.every(p => p.requests > 0) && observedSeconds >= elapsed - 0.1;
  const passed = complete && thresholdResults.length > 0 && thresholdResults.every(r => r.passed);
  const status = !overall.requests ? 'NOT RUN' : !complete ? 'INCOMPLETE' : passed ? 'PASS' : 'FAIL';
  return { runId, generatedAt: new Date().toISOString(), mode: indexMode, workloadSeconds: elapsed,
    observedWorkloadSeconds: observedSeconds, intervalSeconds: interval,
    pacing: 'post-response', thinkTimeSeconds: interval, status, temporaryLimits,
    overall, apis, phases, apiPhases, changes, thresholdResults, passed,
    limitations: ['Closed VU model: each response is followed by a one-second think time, capped at the phase boundary. Slower responses reduce throughput.',
      'Pacing differs from earlier start-to-start runs; changing pacing and indexes together cannot isolate an index effect.',
      temporaryLimits ? 'Customer limits were temporarily raised but remained active. See run-metadata.json for post-test restoration evidence; transfers and quota usage persist.' :
        'No transaction limits were changed by this run. Preflight uses the configured quota snapshot and account history.',
      'NOT RUN means no transaction samples; INCOMPLETE means the planned workload was not fully observed. Neither is a performance pass.',
      'This two-minute local run is not a capacity benchmark; small API/phase samples limit tail-latency conclusions.',
      'API throughput uses active API seconds; whole-test throughput uses the full workload window.',
      'Authentication, provisioning and limit/balance preflight are excluded from transaction metrics.',
      indexMode === 'baseline' ? 'Account index state was not verified for this baseline run.' :
        `Runner verified ${indexMode} before execution. See run-metadata.json for index definitions before/after and ledger row counts.`,
      'The runner does not add/drop indexes. An account index can reduce locking conflicts but cannot guarantee no deadlocks.',
      'Transfers, fees, history and quota usage persist between runs. Without matching DB snapshots, before/after results are observational, not an isolated index benchmark.',
      'Latency includes successful and failed responses; quick failures can make latency look better while reliability degrades.'] };
}
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const number = value => value === null || value === undefined ? 'N/A' : Number(value).toFixed(2);
function table(rows) {
  return `<table><thead><tr><th>API / phase</th><th>Requests</th><th>req/s active</th><th>req/s whole test</th><th>Avg ms</th><th>Median ms</th><th>p95 ms</th><th>Max ms</th><th>HTTP fail %</th><th>Transaction fail %</th><th>Checks pass %</th></tr></thead><tbody>${rows.map(r => `<tr><td>${escape(r.label)}</td><td>${r.requests}</td><td>${number(r.throughputActive)}</td><td>${number(r.throughputWholeTest)}</td><td>${number(r.avg)}</td><td>${number(r.median)}</td><td>${number(r.p95)}</td><td>${number(r.max)}</td><td>${percent(r.httpFailureRate)}</td><td>${percent(r.transactionFailureRate)}</td><td>${percent(r.checkPassRate)}</td></tr>`).join('')}</tbody></table>`;
}
const percent = value => number(value == null ? null : value * 100);
function markdownTable(rows) {
  return '| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |\n' +
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n' +
    rows.map(r => `| ${r.label} | ${r.requests} | ${number(r.throughputActive)} | ${number(r.throughputWholeTest)} | ${number(r.avg)} | ${number(r.p95)} | ${number(r.max)} | ${percent(r.httpFailureRate)} | ${percent(r.transactionFailureRate)} | ${percent(r.checkPassRate)} |`).join('\n');
}
export function markdown(report) {
  return `# DMoney results: ${report.status}\n\nMode: ${report.mode}; run: ${report.runId}; planned workload: ${number(report.workloadSeconds)} seconds; observed: ${number(report.observedWorkloadSeconds)} seconds; post-response think time: ${report.thinkTimeSeconds}s (capped at phase end).\n\n` +
    (report.status === 'NOT RUN' ? 'No transaction requests were measured. Setup failed or execution stopped before the workload; API performance and degradation cannot be assessed.\n\n' : '') +
    markdownTable(report.apis) + '\n\n## By time window\n\n' + markdownTable(report.phases) +
    '\n\n## API by time window\n\n' + markdownTable(report.apiPhases) +
    (report.status === 'NOT RUN' ? '\n\nThreshold results do not establish performance without transaction samples.\n\n' :
      `\n\nThresholds: ${report.thresholdResults.filter(r => r.passed).length}/${report.thresholdResults.length} passed.\n\n`) +
    report.changes.map(c => `- ${c.api}: ${c.from} -> ${c.to}, p95 change ${number(c.p95ChangePercent)}%, throughput change ${number(c.throughputChangePercent)}% (${c.fromSamples}/${c.toSamples} samples).`).join('\n') +
    '\n\nFailed thresholds:\n\n' + (report.thresholdResults.filter(r => !r.passed).map(r => `- ${r.metric}: ${r.rule}`).join('\n') || 'None.') +
    '\n\nLimitations:\n\n' + report.limitations.map(l => `- ${l}`).join('\n') + '\n';
}
export function html(report) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>DMoney k6 report</title><style>
body{font:15px/1.5 system-ui,sans-serif;background:#f1f5f9;color:#172033;margin:0;padding:32px}main{max-width:1480px;margin:auto}h1{font-size:30px;margin-bottom:4px}h2{font-size:21px;margin-top:30px}table{border-collapse:collapse;width:100%;background:white;font-size:13px}th,td{padding:11px 9px;text-align:right;border-bottom:1px solid #e2e8f0}th:first-child,td:first-child{text-align:left}th{background:#172b4d;color:white}section{overflow:auto}.cards{display:flex;gap:14px;margin:24px 0}.card{background:white;padding:18px 26px;border-radius:8px;flex:1}.value{display:block;font-size:29px;font-weight:700;color:#075985}.badge{display:inline-block;padding:5px 12px;border-radius:6px;background:${report.passed ? '#dcfce7' : '#fee2e2'}}li{margin:6px 0}.muted{color:#526277}.timeline{display:flex;gap:10px}.phase{background:#dbeafe;padding:14px;flex:1;border-radius:6px}details{background:white;padding:14px;margin-top:20px}</style></head><body><main>
<h1>DMoney transaction performance</h1><p class="muted">${escape(report.mode)} · ${escape(report.runId)} · ${escape(report.generatedAt)}</p>
<span class="badge">${escape(report.status)}</span><p>Planned workload: ${number(report.workloadSeconds)} s; observed: ${number(report.observedWorkloadSeconds)} s.</p>
${report.status === 'NOT RUN' ? '<p>No transaction samples. API latency, failure rates and degradation are N/A; check the setup error in the terminal.</p>' : ''}
<div class="cards"><div class="card">Planned workload<span class="value">${number(report.workloadSeconds)} s</span></div><div class="card">Transactions<span class="value">${report.overall.requests}</span></div><div class="card">Transaction p95<span class="value">${number(report.overall.p95)} ms</span></div><div class="card">HTTP failure<span class="value">${percent(report.overall.httpFailureRate)}%</span></div></div>
<h2>API comparison</h2><section>${table(report.apis)}</section>
<h2>Workload phases</h2><div class="timeline">${report.phases.map(r => `<div class="phase"><b>${escape(r.label)}</b> · ${r.concurrentVUs} VUs<br>${r.requests} requests · p95 ${number(r.p95)} ms</div>`).join('')}</div>
<section>${table(report.phases)}</section><h2>API by phase</h2><section>${table(report.apiPhases)}</section>
<h2>Observed changes</h2><ul>${report.changes.map(c => `<li>${escape(c.api)}: ${c.from} → ${c.to}: p95 ${number(c.p95ChangePercent)}%; throughput ${number(c.throughputChangePercent)}% (${c.fromSamples}/${c.toSamples} samples).</li>`).join('') || '<li>No phase comparison available.</li>'}</ul>
<h2>Interpretation limits</h2><ul>${report.limitations.map(l => `<li>${escape(l)}</li>`).join('')}</ul>
<details><summary>Threshold evidence</summary><ul>${report.thresholdResults.map(r => `<li>${r.passed ? 'PASS' : 'FAIL'} ${escape(r.metric)}: ${escape(r.rule)}</li>`).join('')}</ul></details></main></body></html>`;
}
