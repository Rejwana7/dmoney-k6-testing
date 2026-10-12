export const USERS = {
  agent1: 'Agent', agent2: 'Agent', customer1: 'Customer',
  customer2: 'Customer', merchant1: 'Merchant', merchant2: 'Merchant',
};
export const APIS = {
  Deposit: { path: '/transaction/deposit', message: 'Deposit successful', amountKey: 'DEPOSIT_AMOUNT' },
  SendMoney: { path: '/transaction/sendmoney', message: 'Send money successful', amountKey: 'SENDMONEY_AMOUNT' },
  Payment: { path: '/transaction/payment', message: 'Payment successful', amountKey: 'PAYMENT_AMOUNT' },
};
export function positiveNumber(value, fallback, name) {
  const number = Number(value === undefined || value === '' ? fallback : value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${name} must be a finite positive number`);
  return number;
}
export function outgoingBudget(activities, interval) {
  const budget = Object.fromEntries(Object.keys(USERS).map(key => [key, 0]));
  for (const a of activities) budget[a.actor] += a.vus * Math.ceil(a.duration / interval);
  return budget;
}
export function validateTransaction(status, body, api) {
  return {
    'expected HTTP 201': status === 201,
    'transaction successful': status === 201 && !!body && !body.error && !body.errors &&
      typeof body.currentBalance === 'number' && Number.isFinite(body.currentBalance) && body.currentBalance >= 0,
    'transaction ID returned': typeof body?.trnxId === 'string' && body.trnxId.trim().length > 0,
    'expected success message': body?.message === APIS[api].message,
  };
}
export function validateUsers(users) {
  const seen = new Set();
  for (const [key, role] of Object.entries(USERS)) {
    const user = users[key];
    if (!user || user.role !== role || !user.email || !user.password || !/^\d{11}$/.test(user.phone)) {
      throw new Error(`Invalid credentials/role/phone for ${key}`);
    }
    if (seen.has(user.phone) || seen.has(user.email)) throw new Error(`Duplicate identity: ${key}`);
    seen.add(user.phone); seen.add(user.email);
  }
  return users;
}
export function quotaUsage(rows, since) {
  const ids = new Set();
  let amount = 0;
  for (const row of rows) {
    // Sequelize dates have UTC Z in API responses. Count only sender debit rows.
    if (Number(row.debit) > 0 && ['SendMoney', 'Payment', 'Withdraw'].includes(row.transaction_type) &&
        Date.parse(row.createdAt) >= since) {
      ids.add(row.trnxId); amount += Number(row.debit);
    }
  }
  return { count: ids.size, amount };
}
