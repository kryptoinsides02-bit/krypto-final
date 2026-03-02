const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const USERS_DB = path.join(__dirname, 'users_db.json');

function loadUsers() {
  if (!fs.existsSync(USERS_DB)) return {};
  try { return JSON.parse(fs.readFileSync(USERS_DB, 'utf8')); } catch(e) { return {}; }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_DB, JSON.stringify(users, null, 2));
}

// ── OTP STORE ─────────────────────────────────────────────────────────────
// { email: { code, expiry, name, attempts, lastRequest } }
const otpStore = {};

// ── RATE LIMITING ─────────────────────────────────────────────────────────
const OTP_REQUEST_LIMIT  = 5;
const OTP_VERIFY_LIMIT   = 5;
const OTP_REQUEST_WINDOW = 60 * 60 * 1000;   // 1 hour
const OTP_LOCKOUT_TIME   = 15 * 60 * 1000;   // 15 min lockout

const requestCounts = {};

function isRateLimited(email) {
  const now = Date.now();
  const r   = requestCounts[email];
  if (!r || (now - r.windowStart) > OTP_REQUEST_WINDOW) {
    requestCounts[email] = { count: 1, windowStart: now };
    return false;
  }
  if (r.count >= OTP_REQUEST_LIMIT) return true;
  r.count++;
  return false;
}

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── SESSIONS ──────────────────────────────────────────────────────────────
// { token: { email, name, expiry } }
const sessions = {};

function createSession(email, name) {
  const token = generateToken();
  sessions[token] = { email, name, expiry: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  return token;
}

function getSession(token) {
  if (!token) return null;
  const s = sessions[token];
  if (!s) return null;
  if (Date.now() > s.expiry) { delete sessions[token]; return null; }
  return s;
}

function deleteSession(token) {
  delete sessions[token];
}

// Step 1: Send OTP
function requestOTP(email, name) {
  const key = email.toLowerCase().trim();
  if (isRateLimited(key)) {
    return { success: false, reason: 'Too many requests. Please wait before requesting another code.' };
  }
  const code = generateOTP();
  otpStore[key] = {
    code,
    expiry:      Date.now() + 10 * 60 * 1000,
    name:        name || '',
    attempts:    0,
    lastRequest: Date.now()
  };
  return { success: true, code };
}

// Step 2: Verify OTP and log user in
function verifyOTP(email, code) {
  const key = email.toLowerCase().trim();
  const otp = otpStore[key];
  if (!otp) return { success: false, reason: 'No code found. Please request a new one.' };
  if (Date.now() > otp.expiry) { delete otpStore[key]; return { success: false, reason: 'Code expired. Please request a new one.' }; }

  if (otp.attempts >= OTP_VERIFY_LIMIT) {
    delete otpStore[key];
    return { success: false, reason: 'Too many incorrect attempts. Please request a new code.' };
  }

  // Timing-safe comparison
  const expected = Buffer.from(otp.code.trim());
  const received = Buffer.from(code.trim().padEnd(otp.code.length, ' ').slice(0, otp.code.length));
  const match = expected.length === received.length &&
                crypto.timingSafeEqual(expected, received);

  if (!match) {
    otp.attempts = (otp.attempts || 0) + 1;
    const left = OTP_VERIFY_LIMIT - otp.attempts;
    return { success: false, reason: left > 0 ? 'Incorrect code. ' + left + ' attempt(s) left.' : 'Too many incorrect attempts. Please request a new code.' };
  }

  // Code correct — create or update user
  const users = loadUsers();
  const isNew = !users[key];
  if (isNew) {
    users[key] = {
      email:     key,
      name:      otp.name || key.split('@')[0],
      plan:      'free',
      createdAt: new Date().toISOString(),
      // Per-user data — each account has its own tracking, telegram, and preferences
      tracking:  { accounts: [], keywords: [] },
      telegram:  { chatId: null, prefs: { emergency: true, news: true, accounts: true, keywords: true } },
    };
    saveUsers(users);
  } else {
    // Migrate old users who don't have the new fields yet
    let changed = false;
    if (!users[key].tracking) { users[key].tracking = { accounts: [], keywords: [] }; changed = true; }
    if (!users[key].telegram) { users[key].telegram = { chatId: null, prefs: { emergency: true, news: true, accounts: true, keywords: true } }; changed = true; }
    if (changed) saveUsers(users);
  }

  delete otpStore[key];
  const user = users[key];
  const sessionToken = createSession(user.email, user.name);
  return {
    success: true,
    sessionToken,
    user: { email: user.email, name: user.name, plan: user.plan },
    isNew
  };
}

function getUserBySession(token) {
  const session = getSession(token);
  if (!session) return null;
  const users = loadUsers();
  return users[session.email] || null;
}

// ── PER-USER DATA APIs ────────────────────────────────────────────────────

function getUserData(token) {
  const user = getUserBySession(token);
  if (!user) return null;
  return {
    tracking: user.tracking || { accounts: [], keywords: [] },
    telegram: user.telegram || { chatId: null, prefs: { emergency: true, news: true, accounts: true, keywords: true } },
  };
}

function saveTracking(token, accounts, keywords) {
  const session = getSession(token);
  if (!session) return false;
  const users = loadUsers();
  const key   = session.email;
  if (!users[key]) return false;
  if (!users[key].tracking) users[key].tracking = {};
  users[key].tracking.accounts = (accounts || []).slice(0, 50).map(a => String(a).toLowerCase().trim()).filter(Boolean);
  users[key].tracking.keywords = (keywords || []).slice(0, 50).map(k => String(k).trim()).filter(Boolean);
  saveUsers(users);
  return true;
}

function saveTelegram(token, chatId, prefs) {
  const session = getSession(token);
  if (!session) return false;
  const users = loadUsers();
  const key   = session.email;
  if (!users[key]) return false;
  if (!users[key].telegram) users[key].telegram = {};
  users[key].telegram.chatId = chatId || null;
  users[key].telegram.prefs  = prefs  || { emergency: true, news: true, accounts: true, keywords: true };
  saveUsers(users);
  return true;
}

function upgradeUserPlan(email) {
  const users = loadUsers();
  const key = email.toLowerCase().trim();
  if (users[key]) { users[key].plan = 'pro'; saveUsers(users); }
}

module.exports = {
  requestOTP, verifyOTP, getUserBySession, createSession, getSession, deleteSession,
  upgradeUserPlan, generateToken,
  getUserData, saveTracking, saveTelegram
};
