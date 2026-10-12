import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { loadEnvironment } from './environment.mjs';
import { prepareLimits, restoreLimits } from './limits.mjs';
import { readIndexState, verifyIndexMode } from './account-index.mjs';

const env = loadEnvironment();
if (!existsSync(env.USERS_FILE)) throw new Error('Run npm run seed first');
const temporaryLimits = process.argv.includes('--temporary-limits');
const args = process.argv.slice(2);
if (args.some(arg => !['--temporary-limits', '--with-index', '--without-index'].includes(arg)) ||
    (args.includes('--with-index') && args.includes('--without-index'))) {
  throw new Error('Use npm run perf, perf:with-index or perf:without-index.');
}
const indexMode = args.includes('--with-index') ? 'with-index' : args.includes('--without-index') ? 'without-index' : 'baseline';
if (indexMode !== 'baseline' && !temporaryLimits) throw new Error('Index comparison requires --temporary-limits to hold the shared test lock.');
if (temporaryLimits) {
  console.log('WARNING: this temporarily raises limits for ALL Customers in local dmoneydb.');
  console.log('Stop all other API/UI/jobs traffic first. Limit restoration does NOT undo transfers, balances or quota usage.');
  if (!process.stdin.isTTY) throw new Error('Temporary limits require confirmation in an interactive terminal.');
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await input.question('If this is a disposable local test DB or all other traffic is stopped, type RAISE CUSTOMER LIMITS: ');
    if (answer.trim() !== 'RAISE CUSTOMER LIMITS') throw new Error('Cancelled. No database changes made.');
  } finally { input.close(); }
}
const reportDir = resolve('reports', `${indexMode}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
mkdirSync(reportDir, { recursive: true });
console.log(`Results: ${reportDir}`);

Object.assign(env, { REPORT_DIR: reportDir, RUN_ID: basename(reportDir),
  K6_WEB_DASHBOARD: 'true', K6_WEB_DASHBOARD_PORT: '-1',
  K6_WEB_DASHBOARD_PERIOD: '5s', K6_WEB_DASHBOARD_EXPORT: resolve(reportDir, 'dashboard.html') });
// This flag is set only after prepareLimits verifies the actual database rows.
delete env.TEST_LIMITS_PREPARED;
env.INDEX_MODE = 'baseline'; // Never trust an inherited with/without-index label.
let context, child, indexBefore = null, indexAfter = null, indexVerified = false, indexVerifiedAfter = false, interrupted = false;
const interrupt = () => { interrupted = true; if (child) child.kill('SIGINT'); };
process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
try {
  if (temporaryLimits) {
    context = await prepareLimits(env.RUN_ID);
    for (const row of context.snapshot.prepared) {
      env[`${row.period.toUpperCase()}_COUNT_LIMIT`] = String(row.max_count);
      env[`${row.period.toUpperCase()}_AMOUNT_LIMIT`] = String(row.max_amount);
    }
    env.TEST_LIMITS_PREPARED = 'true';
  }
  if (indexMode !== 'baseline') {
    indexBefore = await readIndexState(context.db);
    verifyIndexMode(indexBefore, indexMode);
    indexVerified = true;
    env.INDEX_MODE = indexMode;
    console.log(`Verified ${indexMode}: account indexes = ${indexBefore.leadingAccountIndexes.join(', ') || 'none'}`);
  }
  if (interrupted) throw new Error('Interrupted before k6 started; restoring settings.');
  process.exitCode = await new Promise((accept, reject) => {
    child = spawn('k6', ['run', '--new-machine-readable-summary=false', 'dmoney-transaction.js'], { env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', code => { child = undefined; accept(code ?? 1); });
  });
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  let restored = null;
  if (context) {
    if (indexVerified) {
      try {
        indexAfter = await readIndexState(context.db);
        verifyIndexMode(indexAfter, indexMode);
        if (JSON.stringify(indexAfter.indexes) !== JSON.stringify(indexBefore.indexes)) {
          throw new Error('Index definitions changed during this run; comparison is invalid.');
        }
        indexVerifiedAfter = true;
      } catch (error) { console.error(`INDEX VERIFICATION FAILED: ${error.message}`); process.exitCode = 1; }
    }
    try { await restoreLimits(context); restored = true; }
    catch (error) {
      restored = false; process.exitCode = 1;
      console.error(`RESTORE FAILED: ${error.message}. Backup preserved. Run npm run restore-db before using the DB normally.`);
    }
  }
  writeFileSync(resolve(reportDir, 'run-metadata.json'), JSON.stringify({
    runId: env.RUN_ID, temporaryLimitsRequested: temporaryLimits,
    indexModeRequested: indexMode, indexVerifiedBeforeRun: indexVerified,
    indexVerifiedAfterRun: indexVerifiedAfter, indexBefore, indexAfter,
    temporaryLimitsApplied: !!context, originalRules: context?.snapshot.rows || [],
    testRules: context?.snapshot.prepared || [], limitSettingsRestored: restored, interrupted,
  }, null, 2));
  process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
}
