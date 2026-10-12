import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomInt } from 'node:crypto';
import { loadEnvironment, api, login } from './environment.mjs';
import { USERS, validateUsers } from '../lib/helpers.js';

const env = loadEnvironment();
const file = env.USERS_FILE;
// Runtime fixture output, never tracked. Save immediately so interrupted provisioning is recoverable.
let fixture;
function save() { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(fixture, null, 2)); }
if (existsSync(file)) {
  fixture = JSON.parse(readFileSync(file, 'utf8'));
  validateUsers(fixture.users);
} else {
  if (!/^[^@]+@gmail\.com$/i.test(env.TEST_MAILBOX || '')) throw new Error('Set TEST_MAILBOX to a Gmail inbox you control');
  const mailbox = env.TEST_MAILBOX.split('@')[0].split('+')[0];
  fixture = { createdAt: new Date().toISOString(), users: {} };
  const phones = new Set();
  for (const [key, role] of Object.entries(USERS)) {
    let phone;
    do { phone = `019${randomInt(10000000, 100000000)}`; } while (phones.has(phone));
    phones.add(phone);
    fixture.users[key] = { name: `K6 ${key}`, email: `${mailbox}+k6+${key}@gmail.com`,
      phone, password: '1234', nid: String(randomInt(1000000000, 10000000000)), role };
  }
  save();
}
const adminToken = await login(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
for (const [key, user] of Object.entries(fixture.users)) {
  if (!user.id) {
    const created = await api('/user/create', { method: 'POST', token: adminToken,
      body: { name: user.name, email: user.email, password: user.password, phone_number: user.phone, nid: user.nid, role: user.role } });
    if (created.status === 208) {
      // Recover an interrupted create only when the exact unique fixture identity matches.
      const existing = await api(`/user/search/phonenumber/${user.phone}`, { token: adminToken });
      if (existing.status !== 200 || existing.data.user?.email !== user.email || existing.data.user?.role !== user.role) {
        throw new Error(`${key}: duplicate identity does not match this fixture`);
      }
      user.id = existing.data.user.id;
    } else {
      if (created.status !== 201 || !created.data.user?.id) throw new Error(`${key}: create failed HTTP ${created.status}: ${created.data.message}`);
      user.id = created.data.user.id;
    }
    save();
  }
  const existing = await api(`/user/search/id/${user.id}`, { token: adminToken });
  const actual = existing.data.user;
  if (existing.status !== 200 || actual?.email !== user.email || actual?.phone_number !== user.phone || actual?.role !== user.role) {
    throw new Error(`${key}: saved test identity does not match this database. No replacement account will be created automatically.`);
  }
  if (actual.status === 'suspended') throw new Error(`${key}: account is suspended; resolve it explicitly before seeding`);
  if (actual.status !== 'active') {
    const activated = await api(`/user/update/${user.id}`, { method: 'PATCH', token: adminToken, body: { status: 'active' } });
    if (activated.status !== 200) throw new Error(`${key}: activation failed`);
    user.activated = true; save();
  }
  console.log(`${key}: dedicated ${user.role} account ready`);
}
const systemToken = await login(env.SYSTEM_EMAIL, env.SYSTEM_PASSWORD);
async function balance(phone, token) {
  const result = await api(`/transaction/balance/${phone}`, { token });
  if (result.status !== 200 || !Number.isFinite(Number(result.data.balance))) throw new Error('Balance lookup failed');
  return Number(result.data.balance);
}
async function deposit(from, to, amount, token) {
  const result = await api('/transaction/deposit', { method: 'POST', token,
    body: { from_account: from, to_account: to, amount } });
  if (result.status !== 201 || !result.data.trnxId) throw new Error(`Fixture funding failed: HTTP ${result.status}: ${result.data.message}`);
}
const agentTarget = Number(env.INITIAL_AGENT_BALANCE || 20000);
const customerTarget = Number(env.INITIAL_CUSTOMER_BALANCE || 4500);
if (![agentTarget, customerTarget].every(Number.isFinite) || !(agentTarget > 0 && customerTarget > 0 && customerTarget < 9000)) {
  throw new Error('Invalid initial balances');
}
// Fund only this fixture through normal API ledger entries. No direct SQL writes or deletes.
const agentNeed = [];
for (const key of ['agent1', 'agent2']) agentNeed.push(Math.max(0, agentTarget - await balance(fixture.users[key].phone, systemToken)));
const totalNeed = agentNeed.reduce((a, b) => a + b, 0);
const systemBalance = await balance('SYSTEM', systemToken);
if (totalNeed > systemBalance) {
  const result = await api('/transaction/adminDeposit', { method: 'POST', token: adminToken,
    body: { from_account: env.ADMIN_EMAIL, to_account: 'SYSTEM', amount: totalNeed - systemBalance } });
  if (result.status !== 201) throw new Error('Could not fund SYSTEM test pool');
}
for (const [index, key] of ['agent1', 'agent2'].entries()) {
  if (agentNeed[index]) await deposit('SYSTEM', fixture.users[key].phone, agentNeed[index], systemToken);
}
const agentToken = await login(fixture.users.agent1.email, fixture.users.agent1.password);
for (const key of ['customer1', 'customer2']) {
  const amount = Math.max(0, customerTarget - await balance(fixture.users[key].phone, agentToken));
  if (amount) await deposit(fixture.users.agent1.phone, fixture.users[key].phone, amount, agentToken);
}
// Restore Agent 1's target after provisioning customer opening balances.
const restore = Math.max(0, agentTarget - await balance(fixture.users.agent1.phone, systemToken));
if (restore) {
  const remaining = await balance('SYSTEM', systemToken);
  if (restore > remaining) {
    const result = await api('/transaction/adminDeposit', { method: 'POST', token: adminToken,
      body: { from_account: env.ADMIN_EMAIL, to_account: 'SYSTEM', amount: restore - remaining } });
    if (result.status !== 201) throw new Error('Could not replenish SYSTEM test funding');
  }
  await deposit('SYSTEM', fixture.users.agent1.phone, restore, systemToken);
}
console.log('Six users provisioned; balances funded. Existing limits and indexes preserved.');
