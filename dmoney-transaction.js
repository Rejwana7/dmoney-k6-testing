import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { APIS, USERS, outgoingBudget,
  positiveNumber, validateTransaction, validateUsers, quotaUsage } from './lib/helpers.js';
import { summarize, html as comparisonHtml, markdown } from './lib/report.js';

const baseURL = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
if (!/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(baseURL)) {
  throw new Error('This assignment is restricted to the local test backend.');
}
if (__ENV.DISABLE_CUSTOMER_LIMITS === 'true' || __ENV.CUSTOMER_LIMITS_DISABLED === 'true') {
  throw new Error('Automatic transaction-limit bypass is not supported. Remove obsolete limit-disable flags.');
}
const interval = 1; // One-second think time AFTER each response; no env setting needed.
const users = validateUsers(JSON.parse(open(__ENV.USERS_FILE || './config/users.local.json')).users);
const amounts = Object.fromEntries(Object.entries(APIS).map(([api, config]) =>
  [api, positiveNumber(__ENV[config.amountKey], 10, config.amountKey)]));
for (const [api, amount] of Object.entries(amounts)) if (amount < 10) throw new Error(`${api} minimum amount is 10`);
if (!__ENV.PARTNER_KEY) throw new Error('PARTNER_KEY is required; use the .env-aware runner');
if (__ENV.OTP_MODE === 'dev' && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(baseURL)) {
  throw new Error('Development OTP is restricted to the local backend');
}
const requests = new Counter('transaction_requests');
const duration = new Trend('transaction_duration', true);
const httpFailed = new Rate('transaction_http_failed');
const successful = new Rate('transaction_success');
const checkPassRate = new Rate('transaction_checks');
// Each activity has ONE VU. startTime schedules four 30-second windows.
// Merchant accounts receive payments; their own logins are validated in setup().
export let options = {
  scenarios: {
    // 0-30 seconds: two activities run concurrently.
    p1_c1_send_c2: {
      executor: 'constant-vus', vus: 1, startTime: '0s', duration: '30s',
      exec: 'customer1SendMoneyToCustomer2', gracefulStop: '0s',
      tags: { api: 'SendMoney', actor: 'customer1', receiver: 'customer2' },
    },
    p1_c2_pay_m1: {
      executor: 'constant-vus', vus: 1, startTime: '0s', duration: '30s',
      exec: 'customer2PayMerchant1', gracefulStop: '0s',
      tags: { api: 'Payment', actor: 'customer2', receiver: 'merchant1' },
    },
    // 30-60 seconds: three activities run concurrently.
    p2_c2_send_c1: {
      executor: 'constant-vus', vus: 1, startTime: '30s', duration: '30s',
      exec: 'customer2SendMoneyToCustomer1', gracefulStop: '0s',
      tags: { api: 'SendMoney', actor: 'customer2', receiver: 'customer1' },
    },
    p2_a1_deposit_c2: {
      executor: 'constant-vus', vus: 1, startTime: '30s', duration: '30s',
      exec: 'agent1DepositToCustomer2', gracefulStop: '0s',
      tags: { api: 'Deposit', actor: 'agent1', receiver: 'customer2' },
    },
    p2_c1_pay_m1: {
      executor: 'constant-vus', vus: 1, startTime: '30s', duration: '30s',
      exec: 'customer1PayMerchant1', gracefulStop: '0s',
      tags: { api: 'Payment', actor: 'customer1', receiver: 'merchant1' },
    },
    // 60-90 seconds: four activities run concurrently.
    p3_a1_deposit_c1: {
      executor: 'constant-vus', vus: 1, startTime: '60s', duration: '30s',
      exec: 'agent1DepositToCustomer1', gracefulStop: '0s',
      tags: { api: 'Deposit', actor: 'agent1', receiver: 'customer1' },
    },
    p3_a2_deposit_c2: {
      executor: 'constant-vus', vus: 1, startTime: '60s', duration: '30s',
      exec: 'agent2DepositToCustomer2', gracefulStop: '0s',
      tags: { api: 'Deposit', actor: 'agent2', receiver: 'customer2' },
    },
    p3_c1_send_c2: {
      executor: 'constant-vus', vus: 1, startTime: '60s', duration: '30s',
      exec: 'customer1SendMoneyToCustomer2', gracefulStop: '0s',
      tags: { api: 'SendMoney', actor: 'customer1', receiver: 'customer2' },
    },
    p3_c2_pay_m2: {
      executor: 'constant-vus', vus: 1, startTime: '60s', duration: '30s',
      exec: 'customer2PayMerchant2', gracefulStop: '0s',
      tags: { api: 'Payment', actor: 'customer2', receiver: 'merchant2' },
    },
    // 90-120 seconds: four payments run concurrently.
    p4_a1_pay_m1: {
      executor: 'constant-vus', vus: 1, startTime: '90s', duration: '30s',
      exec: 'agent1PayMerchant1', gracefulStop: '0s',
      tags: { api: 'Payment', actor: 'agent1', receiver: 'merchant1' },
    },
    p4_a2_pay_m2: {
      executor: 'constant-vus', vus: 1, startTime: '90s', duration: '30s',
      exec: 'agent2PayMerchant2', gracefulStop: '0s',
      tags: { api: 'Payment', actor: 'agent2', receiver: 'merchant2' },
    },
    p4_c1_pay_m1: {
      executor: 'constant-vus', vus: 1, startTime: '90s', duration: '30s',
      exec: 'customer1PayMerchant1', gracefulStop: '0s',
      tags: { api: 'Payment', actor: 'customer1', receiver: 'merchant1' },
    },
    p4_c2_pay_m2: {
      executor: 'constant-vus', vus: 1, startTime: '90s', duration: '30s',
      exec: 'customer2PayMerchant2', gracefulStop: '0s',
      tags: { api: 'Payment', actor: 'customer2', receiver: 'merchant2' },
    },
  },
  thresholds: {
    // Required global thresholds.
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    checks: ['rate>=0.99'],
    'checks{kind:transaction}': ['rate>=0.99'],
    // Deposit API.
    'http_req_failed{api:Deposit}': ['rate<0.01'],
    'http_req_duration{api:Deposit}': ['p(95)<1000'],
    'checks{api:Deposit,kind:transaction}': ['rate>=0.99'],
    // Send Money API.
    'http_req_failed{api:SendMoney}': ['rate<0.01'],
    'http_req_duration{api:SendMoney}': ['p(95)<1000'],
    'checks{api:SendMoney,kind:transaction}': ['rate>=0.99'],
    // Payment API.
    'http_req_failed{api:Payment}': ['rate<0.01'],
    'http_req_duration{api:Payment}': ['p(95)<1000'],
    'checks{api:Payment,kind:transaction}': ['rate>=0.99'],
  },
  setupTimeout: '120s', summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)'],
  // Keep named checks/groups in root_group so HTML and terminal totals agree.
  systemTags: ['status', 'method', 'name', 'scenario', 'expected_response', 'check', 'group'],
};
// Read the scenario definitions above: no second copy of the assignment flow.
const activities = Object.entries(options.scenarios).map(([name, scenario]) => ({
  name, ...scenario.tags, phase: name.slice(0, 2), vus: scenario.vus,
  start: parseFloat(scenario.startTime), duration: parseFloat(scenario.duration),
}));
// Stop before login or transactions when even an unused quota cannot fit the run.
const planned = outgoingBudget(activities, interval);
for (const key of ['customer1', 'customer2']) {
  for (const period of ['DAILY', 'MONTHLY']) {
    const limit = positiveNumber(__ENV[`${period}_COUNT_LIMIT`], period === 'DAILY' ? 10 : 50, `${period}_COUNT_LIMIT`);
    if (planned[key] > limit) {
      throw new Error(`${key}: planned ${planned[key]} outgoing transactions exceeds ${period.toLowerCase()} limit ${limit}. ` +
        'No transaction requests sent. Use remaining quotas, or npm run perf -- --temporary-limits after stopping all other local traffic.');
    }
  }
}
// Keep API/phase metrics in the summary for comparisons. Threshold values come
// from the required rules above rather than a duplicate threshold definition.
const reportFilters = new Set(['']);
for (const a of activities) {
  reportFilters.add(`api:${a.api}`);
  reportFilters.add(`phase:${a.phase}`);
  reportFilters.add(`api:${a.api},phase:${a.phase}`);
  options.thresholds[`transaction_requests{scenario:${a.name}}`] = ['count>0'];
}
for (const filter of reportFilters) {
  const suffix = filter ? `{${filter}}` : '';
  options.thresholds[`transaction_duration${suffix}`] = options.thresholds.http_req_duration;
  options.thresholds[`transaction_http_failed${suffix}`] = options.thresholds.http_req_failed;
  options.thresholds[`transaction_success${suffix}`] = options.thresholds['checks{kind:transaction}'];
  options.thresholds[`transaction_checks${suffix}`] = options.thresholds['checks{kind:transaction}'];
  options.thresholds[`transaction_requests${suffix}`] = ['count>0'];
}
function json(response) { try { return response.json(); } catch (_) { return null; } }
function headers(token) {
  return { 'Content-Type': 'application/json', 'X-AUTH-SECRET-KEY': __ENV.PARTNER_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
function setupRequest(method, path, token, body, name) {
  return http.request(method, `${baseURL}${path}`, body ? JSON.stringify(body) : null, {
    headers: headers(token), tags: { kind: 'setup', name }, timeout: '15s',
    responseCallback: http.expectedStatuses(200),
  });
}
function authenticate(key) {
  const user = users[key];
  let response = setupRequest('POST', '/user/login', null, { email: user.email, password: user.password }, 'auth_login');
  let body = json(response);
  if (response.status !== 200 || !body) fail(`${key}: login failed (HTTP ${response.status})`);
  if (body.otpRequired) {
    const otp = __ENV[`${key.toUpperCase()}_OTP`] || __ENV.DEFAULT_OTP;
    if (!otp) fail(`${key}: OTP missing`);
    const query = __ENV.OTP_MODE === 'dev' ? '?env=dev' : '';
    response = setupRequest('POST', `/user/verify-otp${query}`, null, { identifier: user.email, otp }, 'auth_verify_otp');
    body = json(response);
  }
  const valid = check(response, {
    'own login HTTP 200': r => r.status === 200,
    'own token returned': () => typeof body?.token === 'string' && body.token.length > 0,
  }, { kind: 'authentication', actor: key });
  if (!valid) fail(`${key}: own authentication validation failed`);
  return body.token;
}
function ownGet(path, key, tokens, name) {
  const response = setupRequest('GET', path, tokens[key], null, name);
  const body = json(response);
  if (response.status !== 200 || !body) fail(`${key}: ${name} failed (HTTP ${response.status})`);
  return body;
}
function statement(key, tokens) {
  const rows = [];
  for (let page = 1; page <= 100; page++) {
    const body = ownGet(`/transaction/statement/${users[key].phone}?page=${page}&count=500`, key, tokens, 'preflight_statement');
    if (!Array.isArray(body.transactions)) fail(`${key}: invalid statement`);
    rows.push(...body.transactions);
    if (rows.length >= body.total || body.transactions.length < 500) return rows;
  }
  fail(`${key}: statement too large for safe preflight`);
}
export function setup() {
  const tokens = {};
  for (const key of Object.keys(USERS)) tokens[key] = authenticate(key);
  const budget = outgoingBudget(activities, interval);
  for (const key of Object.keys(USERS)) {
    const balance = Number(ownGet(`/transaction/balance/${users[key].phone}`, key, tokens, 'preflight_balance').balance);
    if (!Number.isFinite(balance) || balance < 0) fail(`${key}: invalid starting balance`);
    // Conservative fee upper bound matching verified local fee rules (SendMoney 5; Payment max(1%,5)).
    const maxDebit = activities.filter(a => a.actor === key).reduce((sum, a) => sum + a.vus * Math.ceil(a.duration / interval) *
      (amounts[a.api] + (a.api === 'Deposit' ? 0 : a.api === 'SendMoney' ? 5 : Math.max(5, amounts.Payment * 0.01))), 0);
    if (balance < maxDebit) fail(`${key}: insufficient opening balance for planned workload`);
    if (USERS[key] === 'Customer') {
      const incoming = activities.filter(a => a.api === 'Deposit' && a.receiver === key)
        .reduce((sum, a) => sum + a.vus * Math.ceil(a.duration / interval) * amounts.Deposit, 0);
      // Local Deposit API enforces its cap against CURRENT balance, not lifetime
      // Deposit-minus-Withdraw history returned by the legacy /transaction/limit.
      // Keep the configured local 10000 balance cap; do not raise/bypass it.
      if (balance + incoming > 10000) {
        fail(`${key}: deposit capacity too low. Current balance ${balance} + planned deposits ${incoming} exceeds balance cap 10000.`);
      }
      const rows = statement(key, tokens);
      const now = new Date();
      for (const period of ['DAILY', 'MONTHLY']) {
        const since = period === 'DAILY' ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) :
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
        const used = quotaUsage(rows, since);
        const countLimit = positiveNumber(__ENV[`${period}_COUNT_LIMIT`], period === 'DAILY' ? 10 : 50, `${period}_COUNT_LIMIT`);
        const amountLimit = positiveNumber(__ENV[`${period}_AMOUNT_LIMIT`], period === 'DAILY' ? 5000 : 50000, `${period}_AMOUNT_LIMIT`);
        if (used.count + budget[key] > countLimit || used.amount + maxDebit > amountLimit) {
          fail(`${key}: ${period.toLowerCase()} quota insufficient. Used ${used.count}, planned ${budget[key]}, limit ${countLimit}. ` +
            'Use npm run perf -- --temporary-limits only with all other local traffic stopped; otherwise wait for sufficient quota.');
        }
      }
    }
  }
  console.log('All six identities authenticated; balances/capacity/history verified against configured quota snapshot.');
  return { tokens };
}
let loggedFailures = 0;
function transact(api, data, actor, receiver) {
  // API and accounts come directly from the readable functions below. No lookup.
  const activity = exec.scenario.name;
  const phase = activity.slice(0, 2);
  const started = Date.now();
  const end = exec.scenario.startTime + 30000; // Each assignment window is 30s.
  const remaining = end - started;
  if (remaining < 100) { sleep(Math.max(0, remaining / 1000)); return; }
  const tags = { kind: 'transaction', api, phase, actor,
    receiver, name: APIS[api].path, scenario: activity };
  const response = http.post(`${baseURL}${APIS[api].path}`, JSON.stringify({
    from_account: users[actor].phone, to_account: users[receiver].phone, amount: amounts[api],
  }), { headers: headers(data.tokens[actor]), tags,
    timeout: `${Math.max(1, Math.min(10000, remaining - 50))}ms`, responseCallback: http.expectedStatuses(201) });
  const body = json(response);
  const assertions = validateTransaction(response.status, body, api);
  const valid = check(response, Object.fromEntries(Object.entries(assertions).map(([name, value]) => [`${api}: ${name}`, () => value])), tags);
  requests.add(1, tags); duration.add(response.timings.duration, tags);
  httpFailed.add(response.status !== 201, tags); successful.add(valid, tags);
  for (const passed of Object.values(assertions)) checkPassRate.add(passed, tags);
  if (!valid && loggedFailures++ < 3) {
    const cause = /deadlock/i.test(body?.error || '') ? 'DB deadlock' :
      /lock wait timeout/i.test(body?.error || '') ? 'DB lock timeout' : 'See API response/server logs';
    console.error(`${activity}: HTTP ${response.status}; ${String(body?.message || 'invalid JSON / transport error').slice(0, 180)}; ${cause}`);
  }
  // Wait a full second after the response, unless the 30s window ends sooner.
  const wait = Math.min(interval, (end - Date.now()) / 1000);
  if (wait > 0) sleep(wait);
}
// Each function explicitly names the API, sender and receiver. Sender's OWN token.
export function customer1SendMoneyToCustomer2(data) { transact('SendMoney', data, 'customer1', 'customer2'); }
export function customer2SendMoneyToCustomer1(data) { transact('SendMoney', data, 'customer2', 'customer1'); }
export function agent1DepositToCustomer1(data) { transact('Deposit', data, 'agent1', 'customer1'); }
export function agent1DepositToCustomer2(data) { transact('Deposit', data, 'agent1', 'customer2'); }
export function agent2DepositToCustomer2(data) { transact('Deposit', data, 'agent2', 'customer2'); }
export function customer1PayMerchant1(data) { transact('Payment', data, 'customer1', 'merchant1'); }
export function customer2PayMerchant1(data) { transact('Payment', data, 'customer2', 'merchant1'); }
export function customer2PayMerchant2(data) { transact('Payment', data, 'customer2', 'merchant2'); }
export function agent1PayMerchant1(data) { transact('Payment', data, 'agent1', 'merchant1'); }
export function agent2PayMerchant2(data) { transact('Payment', data, 'agent2', 'merchant2'); }
export function handleSummary(data) {
  // Allowlist report fields: setup_data contains login tokens and must stay private.
  const summary = { metrics: data.metrics || {},
    root_group: { ...data.root_group, checks: data.root_group?.checks || [], groups: data.root_group?.groups || [] },
    state: data.state || {}, options: {
      summaryTrendStats: data.options?.summaryTrendStats || ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)'],
      summaryTimeUnit: data.options?.summaryTimeUnit || '',
    } };
  const indexMode = ['with-index', 'without-index'].includes(__ENV.INDEX_MODE) ? __ENV.INDEX_MODE : 'baseline';
  const report = summarize(summary, { activities, interval, runId: __ENV.RUN_ID || 'baseline', indexMode,
    temporaryLimits: __ENV.TEST_LIMITS_PREPARED === 'true' });
  const dir = __ENV.REPORT_DIR || 'reports/baseline';
  return {
    [`${dir}/summary.json`]: JSON.stringify(summary, null, 2),
    [`${dir}/comparison.json`]: JSON.stringify(report, null, 2),
    [`${dir}/results.md`]: markdown(report),
    [`${dir}/report.html`]: htmlReport(summary, {
      title: 'DMoney Transaction Performance Report' + (indexMode === 'baseline' ? '' : ` — ${indexMode}`),
    }),
    [`${dir}/comparison.html`]: comparisonHtml(report),
    stdout: textSummary(summary, { indent: ' ', enableColors: true }) + '\n',
  };
}
