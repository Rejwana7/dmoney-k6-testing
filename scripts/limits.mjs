// Optional, explicit LOCAL test-limit adjustment. Never called by seed.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadEnvironment } from './environment.mjs';

const backupPath = resolve('config/limits-backup.local.json');
const lockName = 'dmoney-k6-customer-limits';
const SELECT = "SELECT id, role, period, max_amount, max_count, is_active FROM TransactionLimits WHERE role = 'Customer' AND period IN ('daily','monthly') ORDER BY id FOR UPDATE";
const same = (a, b) => a.id === b.id && a.role === b.role && a.period === b.period &&
  Number(a.max_amount) === Number(b.max_amount) && Number(a.max_count) === Number(b.max_count) &&
  Number(a.is_active) === Number(b.is_active);
function save(snapshot) {
  mkdirSync(dirname(backupPath), { recursive: true });
  writeFileSync(backupPath, JSON.stringify(snapshot, null, 2));
}
// Shared local connection + advisory lock; importing this does not change limits.
export async function connect() {
  const env = loadEnvironment({ requirePartnerKey: false });
  if (!env.LOCAL_BACKEND_ENV_FILE) throw new Error('Set LOCAL_BACKEND_ENV_FILE for local limit/index helpers.');
  const config = parseEnv(readFileSync(env.LOCAL_BACKEND_ENV_FILE, 'utf8'));
  if (!['localhost', '127.0.0.1', '::1'].includes(config.DB_HOST) || config.DB_NAME !== 'dmoneydb') {
    throw new Error('DB helpers are restricted to local dmoneydb.');
  }
  // Reuse the running backend's installed MySQL driver. No app/model imports,
  // schema sync, dependency download or hardcoded database passwords.
  const requireBackend = createRequire(resolve(dirname(env.LOCAL_BACKEND_ENV_FILE), 'package.json'));
  const mysql = requireBackend('mysql2/promise');
  const identity = { host: config.DB_HOST, port: Number(config.DB_PORT || 3306), database: config.DB_NAME };
  const db = await mysql.createConnection({ ...identity, user: config.DB_USER,
    password: config.DB_PASSWORD, connectTimeout: 10000, multipleStatements: false });
  try {
    const [[lock]] = await db.execute('SELECT GET_LOCK(?, 0) AS acquired', [lockName]);
    if (Number(lock.acquired) !== 1) throw new Error('Another test-limit/index run or recovery is active. Wait for it to finish; do not interfere with its limits/indexes.');
    return { db, identity };
  } catch (error) { await db.end(); throw error; }
}
function validate(snapshot, identity) {
  if (JSON.stringify(snapshot.identity) !== JSON.stringify(identity) ||
      !Array.isArray(snapshot.rows) || snapshot.rows.length !== 2 ||
      !Array.isArray(snapshot.prepared) || snapshot.prepared.length !== 2 ||
      new Set(snapshot.rows.map(r => r.period)).size !== 2 ||
      snapshot.rows.some(r => !Number.isInteger(r.id) || r.role !== 'Customer' ||
        !['daily', 'monthly'].includes(r.period) || ![0, 1].includes(Number(r.is_active)) ||
        !Number.isFinite(Number(r.max_amount)) || Number(r.max_amount) < 0 ||
        !Number.isInteger(Number(r.max_count)) || Number(r.max_count) < 0)) {
    throw new Error('Backup target/rows invalid. Refusing database changes.');
  }
  for (const row of snapshot.rows) {
    const prepared = snapshot.prepared.find(r => r.id === row.id);
    if (!prepared || prepared.role !== row.role || prepared.period !== row.period ||
        Number(prepared.is_active) !== Number(row.is_active) ||
        !Number.isFinite(Number(prepared.max_amount)) || Number(prepared.max_amount) < Number(row.max_amount) ||
        !Number.isInteger(Number(prepared.max_count)) || Number(prepared.max_count) < Number(row.max_count)) {
      throw new Error('Invalid prepared settings in backup. Refusing changes.');
    }
  }
}
async function restore(db, snapshot) {
  await db.beginTransaction();
  try {
    const [current] = await db.execute(SELECT);
    if (current.length !== snapshot.rows.length || current.some(row =>
      !snapshot.rows.some(original => same(row, original)) && !snapshot.prepared.some(test => same(row, test)))) {
      throw new Error('Customer rules changed outside this test. Refusing to overwrite them; inspect the preserved backup.');
    }
    for (const row of snapshot.rows) {
      await db.execute("UPDATE TransactionLimits SET max_amount = ?, max_count = ?, is_active = ? WHERE id = ? AND role = 'Customer' AND period = ?",
        [row.max_amount, row.max_count, row.is_active, row.id, row.period]);
    }
    const [after] = await db.execute(SELECT);
    if (!after.every(row => snapshot.rows.some(original => same(row, original)))) throw new Error('Restoration verification failed.');
    await db.commit();
    snapshot.restored = true; snapshot.restoredAt = new Date().toISOString(); save(snapshot);
    console.log('Original Customer limit settings restored and verified. Transactions/balances were NOT rolled back.');
  } catch (error) { try { await db.rollback(); } catch (_) {} throw error; }
}
export async function prepareLimits(runId) {
  const { db, identity } = await connect();
  let snapshot, saved = false;
  try {
    if (existsSync(backupPath) && !JSON.parse(readFileSync(backupPath, 'utf8')).restored) {
      throw new Error('An unrestored backup exists. Run npm run restore-db first.');
    }
    await db.beginTransaction();
    const [rows] = await db.execute(SELECT);
    if (rows.length !== 2 || new Set(rows.map(r => r.period)).size !== 2 || rows.some(r => Number(r.is_active) !== 1)) {
      throw new Error('Expected active daily and monthly Customer rules. Inspect the local configuration before changing it.');
    }
    const prepared = rows.map(row => ({ ...row,
      max_count: Math.max(Number(row.max_count), 10000),
      max_amount: Math.max(Number(row.max_amount), 1000000) }));
    snapshot = { runId, identity, savedAt: new Date().toISOString(), restored: false, rows, prepared };
    validate(snapshot, identity);
    save(snapshot); saved = true; // Original values persisted BEFORE any UPDATE.
    for (const row of prepared) {
      await db.execute("UPDATE TransactionLimits SET max_amount = ?, max_count = ? WHERE id = ? AND role = 'Customer' AND period = ?",
        [row.max_amount, row.max_count, row.id, row.period]);
    }
    const [after] = await db.execute(SELECT);
    if (after.length !== prepared.length || !after.every(row => prepared.some(test => same(row, test)))) throw new Error('Prepared limit verification failed.');
    await db.commit();
    console.log('Customer limits temporarily raised (still active); original settings backed up.');
    return { db, identity, snapshot };
  } catch (error) {
    try { await db.rollback(); } catch (_) {}
    if (saved) {
      try { await restore(db, snapshot); }
      catch (recovery) { console.error(`Recovery failed: ${recovery.message}. Backup kept; run npm run restore-db.`); }
    }
    await db.end(); throw error;
  }
}
export async function restoreLimits(context) {
  if (!context && !existsSync(backupPath)) { console.log('No limit backup; nothing to restore.'); return; }
  if (!context && JSON.parse(readFileSync(backupPath, 'utf8')).restored) { console.log('Limit backup is already restored.'); return; }
  const connection = context || await connect();
  try {
    const snapshot = JSON.parse(readFileSync(backupPath, 'utf8'));
    if (context && snapshot.runId !== context.snapshot.runId) throw new Error('Backup belongs to another run; refusing restore.');
    validate(snapshot, connection.identity);
    await restore(connection.db, snapshot);
  } finally { await connection.db.end(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== 'restore') throw new Error('Usage: npm run restore-db');
  await restoreLimits();
}
