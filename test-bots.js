/**
 * test-bots.js
 * Run: node test-bots.js
 * Tests Telegram bots and reports exactly what is working.
 */

require('dotenv').config();
const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({ ok: false, raw: data }); }
      });
    }).on('error', reject);
  });
}

function isTokenMissing(token) {
  return !token || token.trim() === '' || token.includes('your_') || token.includes('paste_');
}

async function testBot(label, token) {
  console.log('\n──────────────────────────────────────────');
  console.log(' Testing: ' + label);
  console.log('──────────────────────────────────────────');

  if (isTokenMissing(token)) {
    console.log('⏭️  SKIPPED — token not configured in .env (this is OK if intentionally disabled)');
    return false;
  }

  const base = 'https://api.telegram.org/bot' + token;

  try {
    const me = await get(base + '/getMe');
    if (me.ok) {
      console.log('✅ Token valid');
      console.log('   Bot username : @' + me.result.username);
      console.log('   Bot name     : ' + me.result.first_name);
      console.log('   Bot ID       : ' + me.result.id);
    } else {
      console.log('❌ Token INVALID — Telegram rejected it');
      console.log('   Error: ' + me.description);
      return false;
    }
  } catch(e) {
    console.log('❌ Cannot reach Telegram API: ' + e.message);
    return false;
  }

  try {
    const wh = await get(base + '/getWebhookInfo');
    if (wh.ok && wh.result.url && wh.result.url !== '') {
      console.log('⚠️  WEBHOOK IS SET — this blocks polling!');
      console.log('   Webhook URL: ' + wh.result.url);
      console.log('   Fix: node -e "require(\'axios\').post(\'https://api.telegram.org/bot' + token + '/deleteWebhook\')"');
    } else {
      console.log('✅ No webhook set — polling will work');
    }
  } catch(e) {}

  try {
    const upd = await get(base + '/getUpdates?limit=5&timeout=0');
    if (upd.ok) {
      const count = upd.result.length;
      if (count > 0) {
        console.log('📬 ' + count + ' pending message(s) in queue');
        upd.result.forEach(u => {
          const msg = u.message;
          if (msg) console.log('   From: ' + (msg.from.username || msg.from.first_name) + ' | Text: ' + (msg.text || '[no text]') + ' | ChatID: ' + msg.chat.id);
        });
      } else {
        console.log('📭 No pending messages (queue empty)');
      }
    } else {
      if (upd.description && upd.description.includes('Conflict')) {
        console.log('❌ CONFLICT — another npm start is already running!');
        console.log('   Fix: close all terminals → run npm start ONCE');
      } else {
        console.log('❌ getUpdates failed: ' + upd.description);
      }
      return false;
    }
  } catch(e) {}

  return true;
}

async function testChannel(token, channelId) {
  console.log('\n──────────────────────────────────────────');
  console.log(' Testing: Channel broadcast to ' + channelId);
  console.log('──────────────────────────────────────────');

  if (isTokenMissing(token)) {
    console.log('⏭️  SKIPPED — channel bot not configured (channel posting disabled)');
    return;
  }

  const base = 'https://api.telegram.org/bot' + token;
  try {
    const r = await get(base + '/getChat?chat_id=' + encodeURIComponent(channelId));
    if (r.ok) {
      console.log('✅ Channel found: ' + (r.result.title || channelId));
    } else {
      console.log('❌ Channel not accessible: ' + r.description);
      console.log('   Make sure @kryptoinsidesAlertsbot is an ADMIN of ' + channelId);
    }
  } catch(e) {
    console.log('❌ Channel test error: ' + e.message);
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║     KryptoInsides — Bot Diagnostics      ║');
  console.log('╚══════════════════════════════════════════╝');

  const userBotToken    = process.env.TELEGRAM_BOT_TOKEN;
  const channelBotToken = process.env.TELEGRAM_CHANNEL_BOT_TOKEN;
  const channelId       = process.env.TELEGRAM_CHANNEL_ID || '@kryptoinsidesalerts';

  const userOk    = await testBot('User Bot (@kryptoinsidesbot) — TELEGRAM_BOT_TOKEN', userBotToken);
  const channelOk = await testBot('Channel Bot (@kryptoinsidesAlertsbot) — TELEGRAM_CHANNEL_BOT_TOKEN', channelBotToken);
  await testChannel(channelBotToken, channelId);

  console.log('\n══════════════════════════════════════════');
  console.log(' Summary');
  console.log('══════════════════════════════════════════');

  if (!userOk) {
    if (isTokenMissing(userBotToken)) {
      console.log('🔴 TELEGRAM_BOT_TOKEN missing from .env');
      console.log('   1. Telegram → @BotFather → /mybots → @kryptoinsidesbot → API Token');
      console.log('   2. Add to .env: TELEGRAM_BOT_TOKEN=<paste here>');
    } else {
      console.log('🔴 User bot token is set but INVALID — get a fresh token from @BotFather');
    }
  } else {
    console.log('✅ User bot (@kryptoinsidesbot) — working perfectly');
    console.log('   Users can send /start to get their Chat ID for personal alerts');
  }

  if (isTokenMissing(channelBotToken)) {
    console.log('⏭️  Channel bot — disabled (no TELEGRAM_CHANNEL_BOT_TOKEN in .env)');
    console.log('   This is fine. Live feed, personal alerts, tracking all work normally.');
    console.log('   To enable later: get token from @BotFather for @kryptoinsidesAlertsbot');
  } else if (!channelOk) {
    console.log('🟡 Channel bot token invalid — either fix or remove from .env to disable');
  } else {
    console.log('✅ Channel bot — working');
  }

  console.log('');
  if (userOk) {
    console.log('🚀 Ready! Run: npm start');
  }
  console.log('');
}

main().catch(console.error);
