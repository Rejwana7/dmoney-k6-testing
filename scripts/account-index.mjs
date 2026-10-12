// Explicit local schema experiment. Never called by seed or automatically by perf.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './limits.mjs';

const INDEX = 'idx_transactions_account_k6';
const RECORD = resolve('config/account-index.local.json');
const quote = name => '`' + name.replace(/`/g, '``') + '`';

export async function readIndexState(db) {
  const [tables] = await db.execute(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'transactions' AND TABLE_TYPE = 'BASE TABLE'");
  if (tables.length !== 1) throw new Error('Expected exactly one Transactions table in local dmoneydb.');
  const table = tables[0].name;
  const [rows] = await db.query(`SHOW INDEX FROM ${quote(table)}`);
  const indexes = rows.map(row => ({ name: row.Key_name, column: row.Column_name,
    position: Number(row.Seq_in_index), nonUnique: Number(row.Non_unique),
    prefixLength: row.Sub_part ?? null, type: row.Index_type, visible: row.Visible || 'YES',
    expression: row.Expression ?? null,
  })).sort((a, b) => a.name.localeCompare(b.name) || a.position - b.position);
  const leadingAccountIndexes = indexes.filter(row => row.position === 1 && row.column?.toLowerCase() === 'account')
    .map(row => row.name);
  const usableAccountIndexes = indexes.filter(row => leadingAccountIndexes.includes(row.name) && row.position === 1 &&
    row.visible === 'YES' && row.prefixLength === null).map(row => row.name);
  const [[count]] = await db.query(`SELECT COUNT(*) AS total FROM ${quote(table)}`);
  return { checkedAt: new Date().toISOString(), table, indexes, leadingAccountIndexes,
    usableAccountIndexes, transactionRows: Number(count.total) };
}

export function verifyIndexMode(state, mode) {
  if (mode === 'without-index' && state.leadingAccountIndexes.length) {
    throw new Error(`Cannot label this without-account-index: ${state.leadingAccountIndexes.join(', ')} exists. ` +
      'Do not drop existing application indexes. index:drop only removes the index created by this helper.');
  }
  if (mode === 'with-index' && !state.usableAccountIndexes.length) {
    throw new Error('No visible full-length index starting with account. Run npm run index:add first.');
  }
}

export async function manageIndex(db, identity, action) {
  let state = await readIndexState(db);
  if (action === 'check') return state;
  const limitBackup = resolve('config/limits-backup.local.json');
  if (existsSync(limitBackup) && !JSON.parse(readFileSync(limitBackup, 'utf8')).restored) {
    throw new Error('An unrestored limit backup exists. Run npm run restore-db before index changes.');
  }
  const own = state.indexes.filter(row => row.name === INDEX);
  if (action === 'add') {
    if (own.length && !(own.length === 1 && own[0].column === 'account' && own[0].nonUnique === 1 &&
        own[0].prefixLength === null && own[0].visible === 'YES' && own[0].type === 'BTREE')) {
      throw new Error(`${INDEX} exists with an unexpected definition; nothing changed.`);
    }
    if (state.usableAccountIndexes.length) {
      console.log(`Account index already exists: ${state.usableAccountIndexes.join(', ')}. No duplicate created.`);
      return state;
    }
    if (state.leadingAccountIndexes.length) throw new Error('An account index exists but is invisible/prefix-only. Inspect it; nothing changed.');
    // Save intent before DDL. A failed/crashed creation is not silently claimed as owned.
    mkdirSync(resolve('config'), { recursive: true });
    const record = { identity, table: state.table, name: INDEX, created: false, startedAt: new Date().toISOString() };
    writeFileSync(RECORD, JSON.stringify(record, null, 2));
    await db.query('SET SESSION lock_wait_timeout = 10');
    await db.query(`CREATE INDEX ${quote(INDEX)} ON ${quote(state.table)} (account)`);
    record.created = true; record.createdAt = new Date().toISOString();
    writeFileSync(RECORD, JSON.stringify(record, null, 2));
    state = await readIndexState(db);
    if (!state.usableAccountIndexes.includes(INDEX)) throw new Error('Created index could not be verified. Inspect index:check.');
    console.log(`Created ${INDEX} on ${state.table}(account). Rows/balances/limits were not changed.`);
  } else if (action === 'drop') {
    if (!own.length) {
      console.log(`${INDEX} is absent. No index removed.`);
      return state;
    }
    const record = existsSync(RECORD) ? JSON.parse(readFileSync(RECORD, 'utf8')) : null;
    if (!record?.created || record.droppedAt || record.name !== INDEX || record.table !== state.table ||
        JSON.stringify(record.identity) !== JSON.stringify(identity) || own.length !== 1 ||
        own[0].column !== 'account' || own[0].nonUnique !== 1 || own[0].prefixLength !== null ||
        own[0].type !== 'BTREE' || own[0].visible !== 'YES') {
      throw new Error('Refusing to drop an index not recorded as created by this helper, or whose definition changed.');
    }
    await db.query('SET SESSION lock_wait_timeout = 10');
    await db.query(`DROP INDEX ${quote(INDEX)} ON ${quote(state.table)}`);
    state = await readIndexState(db);
    if (state.indexes.some(row => row.name === INDEX)) throw new Error('Index removal could not be verified.');
    record.droppedAt = new Date().toISOString();
    writeFileSync(RECORD, JSON.stringify(record, null, 2));
    console.log(`Removed only ${INDEX}. Other indexes/rows/balances/limits were preserved.`);
  } else throw new Error('Unknown index action.');
  return state;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const action = process.argv[2] || 'check';
  if (!['check', 'add', 'drop'].includes(action) || process.argv.length > 3) throw new Error('Use index:check, index:add or index:drop.');
  if (action !== 'check') console.log('Local dmoneydb schema change: stop all other API/UI/jobs/test traffic first. Keep MySQL running.');
  let connection;
  try {
    connection = await connect(); // Same lock as temporary-limit runs; cannot alter their index mid-run.
    const state = await manageIndex(connection.db, connection.identity, action);
    console.table(state.indexes);
    console.log(`Account-leading indexes: ${state.leadingAccountIndexes.join(', ') || 'none'}; ledger rows: ${state.transactionRows}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { if (connection) await connection.db.end(); }
}
