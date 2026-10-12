import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';

export function loadEnvironment({ requirePartnerKey = true } = {}) {
  if (existsSync('.env')) {
    const local = parseEnv(readFileSync('.env', 'utf8'));
    for (const [key, value] of Object.entries(local)) if (process.env[key] === undefined) process.env[key] = value;
  }
  const base = new URL(process.env.BASE_URL || 'http://localhost:5000');
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (!localHost) throw new Error('This fixture runner is restricted to a local test backend.');
  if (process.env.DISABLE_CUSTOMER_LIMITS === 'true' || process.env.CUSTOMER_LIMITS_DISABLED === 'true') {
    throw new Error('Automatic limit bypass is not supported. Remove obsolete limit-disable flags.');
  }
  if (process.env.LOCAL_BACKEND_ENV_FILE) {
    const backend = parseEnv(readFileSync(process.env.LOCAL_BACKEND_ENV_FILE, 'utf8'));
    for (const key of ['PARTNER_KEY', 'DEFAULT_OTP']) {
      if (!process.env[key]) process.env[key] = backend[key] || '';
    }
    if (!process.env.TEST_MAILBOX) process.env.TEST_MAILBOX = backend.EMAIL_USER || '';
  }
  if (requirePartnerKey && !process.env.PARTNER_KEY) throw new Error('Set PARTNER_KEY in .env');
  process.env.BASE_URL = base.href.replace(/\/$/, '');
  process.env.USERS_FILE = resolve(process.env.USERS_FILE || './config/users.local.json');
  return process.env;
}
export async function api(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${process.env.BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-AUTH-SECRET-KEY': process.env.PARTNER_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  return { status: response.status, data };
}
export async function login(email, password) {
  let result = await api('/user/login', { method: 'POST', body: { email, password } });
  if (result.status !== 200) throw new Error(`Login failed: HTTP ${result.status}`);
  if (result.data.otpRequired) {
    if (process.env.OTP_MODE !== 'dev' || !process.env.DEFAULT_OTP) throw new Error('Local OTP_MODE=dev and DEFAULT_OTP required');
    result = await api('/user/verify-otp?env=dev', {
      method: 'POST', body: { identifier: email, otp: process.env.DEFAULT_OTP },
    });
  }
  if (result.status !== 200 || !result.data.token) throw new Error('Authentication did not return a token');
  return result.data.token;
}
