const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

// ── TWO SEPARATE BOTS ──────────────────────────────────────────────────────
// TELEGRAM_BOT_TOKEN         = @kryptoinsidesbot       → this file (user Chat ID + personal alerts)
// TELEGRAM_CHANNEL_BOT_TOKEN = @kryptoinsidesAlertsbot → channel.js (broadcasts to your channel)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL  = 'https://api.telegram.org/bot' + BOT_TOKEN;

// ── PERSIST USERS TO DISK ─────────────────────────────────────────────────
// Users survive server restarts — they don't have to reconnect every time
const USERS_FILE = path.join(__dirname, 'telegram_users.json');

function loadUsersFromDisk() {
  if (!fs.existsSync(USERS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch(e) { return {}; }
}

function saveUsersToDisk(usersObj) {
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(usersObj, null, 2)); } catch(e) {
    console.error('[TG] Failed to persist users:', e.message);
  }
}

const users = loadUsersFromDisk();
console.log('[TG] Loaded ' + Object.keys(users).length + ' persisted Telegram user(s)');

// Per-type cooldowns
const COOLDOWN_NEWS  = 4 * 60 * 60 * 1000;  // 4 hours
const COOLDOWN_TWEET = 10 * 60 * 1000;       // 10 min

const recentAlerts = new Map();

function shouldSend(key, cooldown) {
  cooldown = cooldown || COOLDOWN_TWEET;
  const last = recentAlerts.get(key);
  if (last && (Date.now() - last) < cooldown) return false;
  recentAlerts.set(key, Date.now());
  return true;
}

const seenNewsTitles = new Map();
function _normTitle(title) {
  const stops = new Set(['a','an','the','is','in','on','at','to','of','for','and','or','but','with','by','as','from','its','it']);
  return (title || '').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/)
    .filter(w => w.length > 2 && !stops.has(w)).sort().join(' ');
}

function isSimilarNewsTitle(title) {
  const normA  = _normTitle(title);
  const wordsA = new Set(normA.split(' ').filter(Boolean));
  if (wordsA.size === 0) return false;
  const now = Date.now();
  for (const [hash, ts] of seenNewsTitles) {
    if (now - ts > COOLDOWN_NEWS) { seenNewsTitles.delete(hash); continue; }
    const wordsB = new Set(hash.split(' ').filter(Boolean));
    let shared = 0;
    for (const w of wordsA) if (wordsB.has(w)) shared++;
    const union = wordsA.size + wordsB.size - shared;
    if (shared / union >= 0.70) return true;
  }
  seenNewsTitles.set(normA, now);
  return false;
}

async function sendMessage(chatId, text) {
  if (!BOT_TOKEN) return;
  try {
    await axios.post(BASE_URL + '/sendMessage', {
      chat_id: chatId, text: text, parse_mode: 'HTML', disable_web_page_preview: true
    });
  } catch(e) {
    const desc = e.response ? e.response.data.description : e.message;
    if (e.response && (e.response.status === 403 || e.response.status === 400)) {
      console.warn('[TG] Removing unreachable user ' + chatId + ': ' + desc);
      delete users[String(chatId)];
      saveUsersToDisk(users);
    } else {
      console.error('[TG] Send error to ' + chatId + ':', desc);
    }
  }
}

async function processUpdate(update) {
  var msg = update.message;
  if (!msg || !msg.text) return;
  var chatId = msg.chat.id;
  var text = msg.text.trim().replace(/@\S+$/, '').trim().toLowerCase();
  var uid = String(chatId);

  if (!users[uid]) {
    users[uid] = {
      chatId:   chatId,
      keywords: [],
      accounts: [],
      prefs:    { emergency: true, news: true, accounts: true, keywords: true },
      isPro:    false
    };
    saveUsersToDisk(users);
  }
  var user = users[uid];

  if (text === '/start' || text === '/myid' || text === '/id') {
    var welcomeMsg = [
      '👋 <b>Welcome to KryptoInsides Alerts!</b>',
      '',
      '📋 <b>Your Chat ID is:</b>',
      '<code>' + chatId + '</code>',
      '',
      '👆 Tap the number above to copy it, then:',
      '1. Open the KryptoInsides dashboard',
      '2. Go to the <b>Telegram</b> tab',
      '3. Paste your Chat ID and tap <b>Connect</b>',
      '',
      "You'll then receive real-time crypto alerts here.",
      '',
      '/status — view your alert settings',
    ].join('\n');
    await sendMessage(chatId, welcomeMsg);
    return;
  }

  if (text === '/status') {
    var prefs = user.prefs || {};
    await sendMessage(chatId, [
      '⚙️ <b>Your Alert Settings</b>',
      '',
      '🚨 Emergency: '        + (prefs.emergency !== false ? '✅ ON' : '❌ OFF'),
      '📰 Breaking news: '    + (prefs.news !== false ? '✅ ON' : '❌ OFF'),
      '🎯 Tracked accounts: ' + (prefs.accounts !== false ? '✅ ON' : '❌ OFF'),
      '🔍 Keywords: '         + (prefs.keywords !== false ? '✅ ON' : '❌ OFF'),
      '',
      'Keywords: ' + (user.keywords.length ? user.keywords.join(', ') : 'none'),
      'Accounts: ' + (user.accounts.length ? user.accounts.join(', ') : 'none'),
    ].join('\n'));
    return;
  }

  if (text.indexOf('/emergency') === 0) {
    if (!user.prefs) user.prefs = {};
    user.prefs.emergency = text.indexOf('on') > -1;
    saveUsersToDisk(users);
    await sendMessage(chatId, 'Emergency alerts: ' + (user.prefs.emergency ? '✅ ON' : '❌ OFF'));
    return;
  }

  await sendMessage(chatId, '👋 Your Chat ID: <code>' + chatId + '</code>\n\nSend /start for setup instructions.');
}

async function notifyTweet(tweet) {
  if (!BOT_TOKEN) return;
  var uids = Object.keys(users);
  for (var i = 0; i < uids.length; i++) {
    var user = users[uids[i]];
    var tweetText    = tweet.text || '';
    var authorName   = tweet.author ? tweet.author.name     || '' : '';
    var authorHandle = tweet.author ? tweet.author.username || '' : '';
    var tweetUrl = 'https://twitter.com/' + authorHandle + '/status/' + tweet.id;
    var prefs = user.prefs || { emergency: true, accounts: true, keywords: true };

    if (tweet.emergency && prefs.emergency !== false) {
      var key = 'em:' + tweetText.slice(0, 60);
      if (shouldSend(key)) {
        await sendMessage(user.chatId, '🚨 EMERGENCY ALERT\n\n' + authorName + ' @' + authorHandle + '\n\n' + tweetText + '\n\n' + tweetUrl);
        await new Promise(function(r) { setTimeout(r, 100); });
      }
      continue;
    }

    if (prefs.keywords !== false) {
      for (var j = 0; j < user.keywords.length; j++) {
        var kw = user.keywords[j];
        if (tweetText.toLowerCase().indexOf(kw.toLowerCase()) > -1) {
          var kwKey = 'kw:' + kw + ':' + tweetText.slice(0, 40);
          if (shouldSend(kwKey)) {
            await sendMessage(user.chatId, '🔍 Keyword Match: ' + kw + '\n\n' + authorName + ' @' + authorHandle + '\n\n' + tweetText + '\n\n' + tweetUrl);
            await new Promise(function(r) { setTimeout(r, 100); });
          }
          break;
        }
      }
    }

    var h = authorHandle.toLowerCase();
    if (prefs.accounts !== false && user.accounts.indexOf(h) > -1) {
      var acKey = 'ac:' + h + ':' + tweetText.slice(0, 40);
      if (shouldSend(acKey)) {
        await sendMessage(user.chatId, '🎯 Tracked: @' + h + '\n\n' + tweetText + '\n\n' + tweetUrl);
        await new Promise(function(r) { setTimeout(r, 100); });
      }
    }
  }
}

function registerUser(chatId, isPro, keywords, accounts, prefs) {
  var uid  = String(chatId);
  var isNew = !users[uid];
  if (isNew) {
    users[uid] = {
      chatId:   chatId,
      keywords: [],
      accounts: [],
      prefs:    { emergency: true, news: true, accounts: true, keywords: true },
      isPro:    false
    };
  }
  var u = users[uid];
  u.isPro = isPro || false;
  if (keywords) u.keywords = keywords;
  if (accounts) u.accounts = accounts;
  if (prefs)    u.prefs    = prefs;
  saveUsersToDisk(users);

  var activeAlerts = [];
  if (u.prefs.emergency !== false)                          activeAlerts.push('🚨 Emergency & breaking alerts');
  if (u.prefs.news !== false)                               activeAlerts.push('📰 Breaking news');
  if (u.prefs.accounts !== false && u.accounts.length > 0) activeAlerts.push('🎯 Tracked accounts (' + u.accounts.length + ')');
  if (u.prefs.keywords !== false && u.keywords.length > 0) activeAlerts.push('🔍 Keywords (' + u.keywords.length + ')');

  var confirmMsg = [
    isNew ? '✅ <b>KryptoInsides Telegram Connected!</b>' : '✅ <b>Preferences Updated!</b>',
    '',
    isNew ? 'You will now receive real-time alerts on this chat.' : 'Your alert preferences have been saved.',
    '',
    '<b>Active alerts:</b>',
    activeAlerts.length ? activeAlerts.join('\n') : 'None — enable preferences on the dashboard',
    '',
    'To update anytime, visit the Telegram tab on the dashboard.',
  ].join('\n');

  sendMessage(chatId, confirmMsg).catch(function() {});
  return u;
}

function getUser(chatId)       { return users[String(chatId)] || null; }
function upgradeUser(chatId)   { var uid = String(chatId); if (users[uid]) { users[uid].isPro = true; saveUsersToDisk(users); } }
function getBotInfo()          { return _botInfo; }
function getConnectedUsers()   { return Object.keys(users).length; }

var lastUpdateId = 0;
var _pollFailCount = 0;
var _botInfo = null;

async function _clearWebhook() {
  try {
    var r = await axios.post(BASE_URL + '/deleteWebhook', { drop_pending_updates: false }, { timeout: 8000 });
    if (r.data && r.data.ok) console.log('[TG] Webhook cleared — ready for long-polling');
  } catch(e) {
    console.warn('[TG] Could not clear webhook:', e.message);
  }
}

async function pollUpdates() {
  if (!BOT_TOKEN) {
    console.log('[TG] ⚠️  No TELEGRAM_BOT_TOKEN set — user bot disabled.');
    return;
  }

  var attempt = 0;
  while (attempt < 3) {
    try {
      var me = await axios.get(BASE_URL + '/getMe', { timeout: 8000 });
      if (me.data && me.data.ok) {
        _botInfo = me.data.result;
        console.log('[TG] ✅ Bot connected: @' + _botInfo.username + ' (id: ' + _botInfo.id + ')');
        break;
      } else {
        console.error('[TG] ❌ Bot token rejected — check TELEGRAM_BOT_TOKEN in .env');
        return;
      }
    } catch(e) {
      attempt++;
      console.error('[TG] Cannot reach Telegram (attempt ' + attempt + '/3):', e.message);
      if (attempt >= 3) { console.error('[TG] Giving up.'); return; }
      await new Promise(function(r){ setTimeout(r, 3000); });
    }
  }

  await _clearWebhook();
  console.log('[TG] Polling for messages every 2s...');

  var _consecutiveConflicts = 0;

  async function doPoll() {
    try {
      var res = await axios.get(BASE_URL + '/getUpdates', {
        params: { offset: lastUpdateId + 1, timeout: 10 },
        timeout: 15000
      });
      if (_pollFailCount > 0) {
        console.log('[TG] ✅ Poll recovered after ' + _pollFailCount + ' errors');
        _consecutiveConflicts = 0;
      }
      _pollFailCount = 0;
      var updates = res.data.result || [];
      if (updates.length > 0) console.log('[TG] Received ' + updates.length + ' update(s)');
      for (var i = 0; i < updates.length; i++) {
        lastUpdateId = updates[i].update_id;
        await processUpdate(updates[i]);
      }
      setTimeout(doPoll, 2000);
    } catch(e) {
      _pollFailCount++;
      var status = e.response ? e.response.status : null;
      var desc   = (e.response && e.response.data) ? e.response.data.description : e.message;

      if (status === 409) {
        _consecutiveConflicts++;
        if (_consecutiveConflicts === 1) {
          console.log('[TG] ⚠️  409 Conflict — another bot instance is running.');
          await _clearWebhook();
          setTimeout(doPoll, 10000);
          return;
        }
        if (_consecutiveConflicts % 5 === 0) {
          console.error('[TG] ❌ Conflict still running. FIX: Close ALL terminals, run npm start ONCE.');
          await _clearWebhook();
        }
        var wait = Math.min(10000 * _consecutiveConflicts, 30000);
        setTimeout(doPoll, wait);
      } else {
        if (_pollFailCount === 1 || _pollFailCount % 30 === 0) {
          console.error('[TG] Poll error #' + _pollFailCount + ':', desc || e.message);
        }
        setTimeout(doPoll, 2000);
      }
    }
  }
  doPoll();
}

async function notifyBreakingNews(article) {
  if (!BOT_TOKEN) return;
  if (isSimilarNewsTitle(article.title || '')) return;
  var globalKey = 'news:' + _normTitle(article.title || '').slice(0, 80);
  if (!shouldSend(globalKey, COOLDOWN_NEWS)) return;

  var uids = Object.keys(users);
  for (var i = 0; i < uids.length; i++) {
    var user  = users[uids[i]];
    var prefs = user.prefs || { news: true };
    if (!prefs.news) continue;
    var msg = '📰 BREAKING NEWS\n\n<b>' + (article.title || '') + '</b>\n\nSource: ' + (article.source || '') + '\n\n' + (article.url || '');
    await sendMessage(user.chatId, msg);
    await new Promise(function(r) { setTimeout(r, 100); });
  }
  console.log('[BOT] Breaking news sent: ' + (article.title || '').slice(0, 60));
}

module.exports = { pollUpdates, notifyTweet, notifyBreakingNews, registerUser, getUser, upgradeUser, getBotInfo, getConnectedUsers };
