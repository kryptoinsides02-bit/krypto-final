/**
 * channel.js — Public Telegram broadcast channel
 * Spec §3.1-§3.3: Posts real-time alerts to @kryptoinsidesalerts
 *
 * Rules (§3.2 — configurable in BROADCAST_RULES below):
 *   breaking_news   → always broadcast
 *   price_milestone → top 10 coins only
 *   threshold_24h   → top 10 coins only
 *   instant_move    → only if ≥5% (not ≥3%)
 *   whale           → if value > $1M
 *   keyword_trend   → daily summary (future use)
 *   personal_kw     → NEVER
 *   tracked_account → NEVER
 */

const axios = require('axios');

// @kryptoinsidesAlertsbot — the channel broadcast bot
// Uses TELEGRAM_CHANNEL_BOT_TOKEN (separate from the user bot TELEGRAM_BOT_TOKEN)
const BOT_TOKEN  = process.env.TELEGRAM_CHANNEL_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '@kryptoinsidesalerts';
const BASE_URL   = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ── BROADCAST RULES — edit here to change what gets posted ────────────────
const BROADCAST_RULES = {
  breaking_news:    { enabled: true,  condition: () => true },
  // Milestones: BTC + ETH only (most impactful round-number crosses)
  price_milestone:  { enabled: true,  condition: (d) => MAJOR.includes(d.coin) },
  // 24h threshold: BTC/ETH only AND must be >= 10% move
  threshold_24h:    { enabled: true,  condition: (d) => MAJOR.includes(d.coin) && Math.abs(d.change24h || 0) >= 10 },
  // Instant move: BTC/ETH only AND >= 8% rapid swing
  instant_move:     { enabled: true,  condition: (d) => MAJOR.includes(d.coin) && Math.abs(d.change24h || 0) >= 8 },
  whale:            { enabled: true,  condition: (d) => (d.valueUSD || 0) >= 1_000_000 },
  keyword_trend:    { enabled: true,  condition: () => true },
  personal_keyword: { enabled: false, condition: () => false },
  tracked_account:  { enabled: false, condition: () => false },
};

// Only Bitcoin and Ethereum for price alerts — major moves only
const MAJOR = ['BTC', 'ETH'];
const TOP10  = ['BTC','ETH','SOL','XRP','BNB','DOGE','ADA','AVAX','LINK','DOT']; // kept for reference

// Dedup: same message key won't re-post within the cooldown window
// Breaking news stays in RSS feeds for hours — need a long window to prevent re-fires
const recentPosts = new Map();
const POST_COOLDOWN_NEWS  = 4 * 60 * 60 * 1000;  // 4 hours for news (articles linger in RSS)
const POST_COOLDOWN_PRICE = 10 * 60 * 1000;       // 10 min for price alerts (short-lived events)

function canPost(key, cooldown) {
  const last = recentPosts.get(key);
  if (!last) return true;
  if (Date.now() - last > cooldown) { recentPosts.delete(key); return true; }
  return false;
}

// ── TELEGRAM API ──────────────────────────────────────────────────────────
async function sendToChannel(text) {
  if (!BOT_TOKEN) return;
  try {
    await axios.post(`${BASE_URL}/sendMessage`, {
      chat_id: CHANNEL_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  } catch (e) {
    const desc = e.response?.data?.description || e.message;
    console.warn('[CHANNEL] Send failed:', desc?.slice(0, 100));
  }
}

// ── MESSAGE FORMATTERS — spec §3.3 ───────────────────────────────────────

function fmtBreakingNews(article) {
  return [
    `📰 <b>BREAKING NEWS</b>`,
    ``,
    `<b>${esc(article.title)}</b>`,
    `Source: ${esc(article.source || 'Unknown')}`,
    ``,
    
  ].filter(l => l !== undefined).join('\n');
}

function fmtPriceMilestone(alert) {
  const dir  = alert.isPositive ? '🚀' : '📉';
  const sign = alert.isPositive ? '+' : '';
  const ch   = (alert.change24h || 0).toFixed(2);
  return [
    `${dir} <b>PRICE MILESTONE</b>`,
    ``,
    `<b>${esc(alert.title)}</b>`,
    `Current: <b>$${fmt(alert.price)}</b> (${sign}${ch}% 24h)`,
    ``,
    ``,
    `#${alert.coin} #Crypto`,
    ``,
    
  ].join('\n');
}

function fmtThreshold24h(alert) {
  const dir  = alert.isPositive ? '📈' : '📉';
  const sign = alert.isPositive ? '+' : '';
  const ch   = (alert.change24h || 0).toFixed(2);
  return [
    `${dir} <b>24H THRESHOLD</b>`,
    ``,
    `<b>${esc(alert.title)}</b>`,
    `Current: <b>$${fmt(alert.price)}</b>`,
    `24h change: <b>${sign}${ch}%</b>`,
    ``,
    ``,
    `#${alert.coin} #${alert.coin}Price`,
    ``,
    
  ].join('\n');
}

function fmtInstantMove(alert) {
  const dir  = alert.isPositive ? '⚡' : '🔻';
  const sign = alert.isPositive ? '+' : '';
  const ch   = (alert.change24h || 0).toFixed(2);
  return [
    `${dir} <b>RAPID MOVE</b>`,
    ``,
    `<b>${esc(alert.title)}</b>`,
    `${esc(alert.message)}`,
    `Move: <b>${sign}${ch}%</b>`,
    ``,
    `#${alert.coin} #Crypto`,
    ``,
    
  ].join('\n');
}

function fmtWhaleAlert(data) {
  const amount = data.amount ? data.amount.toLocaleString() : '?';
  const valueStr = data.valueUSD ? `($${(data.valueUSD/1e6).toFixed(1)}M)` : '';
  return [
    `🐋 <b>WHALE ALERT</b>`,
    ``,
    `<b>${amount} ${data.symbol || ''} ${valueStr}</b> moved`,
    `From: ${esc(data.from || 'Unknown')}`,
    `To: ${esc(data.to || 'Unknown')}`,
    data.txUrl ? `🔗 <a href="${data.txUrl}">View Transaction</a>` : '',
    ``,
    `#${data.symbol} #WhaleAlert`,
    ``,
    
  ].filter(l => l !== undefined).join('\n');
}

// ── TITLE NORMALISATION — for cross-source dedup ─────────────────────────
// Different sites post the same story with slightly different titles.
// Normalise: lowercase, strip punctuation, remove stop-words, sort words.
// Two titles with ≥70% word overlap = same story → block.
const seenTitleHashes = new Map(); // normHash → timestamp

function normTitle(title) {
  const stops = new Set(['a','an','the','is','in','on','at','to','of','for','and','or','but','with','by','as','from','its','it','this','that','be','are','was','were','has','have','had','will','not','no','s']);
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stops.has(w))
    .sort()
    .join(' ');
}

function isSimilarTitle(title) {
  const normA  = normTitle(title);
  const wordsA = new Set(normA.split(' ').filter(Boolean));
  if (wordsA.size === 0) return false;
  const now = Date.now();
  for (const [hash, ts] of seenTitleHashes) {
    if (now - ts > POST_COOLDOWN_NEWS) { seenTitleHashes.delete(hash); continue; }
    const wordsB = new Set(hash.split(' ').filter(Boolean));
    let shared = 0;
    for (const w of wordsA) if (wordsB.has(w)) shared++;
    const union = wordsA.size + wordsB.size - shared;
    const overlap = shared / union;
    if (overlap >= 0.70) {
      console.log(`[CHANNEL] Dedup blocked (${(overlap*100).toFixed(0)}% overlap): "${title.slice(0,60)}"`);
      return true;
    }
  }
  seenTitleHashes.set(normA, now);
  return false;
}

// ── ROUTER — called by index.js on every broadcast event ─────────────────
async function broadcastToChannel(payload) {
  if (!BOT_TOKEN) return;
  let text     = null;
  let key      = null;
  let cooldown = POST_COOLDOWN_NEWS;

  if (payload.type === 'news' && payload.breaking) {
    const rule = BROADCAST_RULES.breaking_news;
    if (!rule.enabled || !rule.condition(payload)) return;
    if (isSimilarTitle(payload.title)) return;  // cross-source duplicate
    key  = 'news:' + normTitle(payload.title).slice(0, 80);
    text = fmtBreakingNews(payload);

  } else if (payload.type === 'price_alert') {
    cooldown = POST_COOLDOWN_PRICE;
    if (payload.alertType === 'milestone') {
      const rule = BROADCAST_RULES.price_milestone;
      if (!rule.enabled || !rule.condition(payload)) return;
      key  = 'pa_ms:' + payload.coin + ':' + payload.threshold;
      text = fmtPriceMilestone(payload);

    } else if (payload.alertType === 'threshold') {
      const rule = BROADCAST_RULES.threshold_24h;
      if (!rule.enabled || !rule.condition(payload)) return;
      key  = 'pa_th:' + payload.coin + ':' + payload.threshold + ':' + (payload.isPositive ? 'u' : 'd');
      text = fmtThreshold24h(payload);

    } else if (payload.alertType === 'instant') {
      const rule = BROADCAST_RULES.instant_move;
      if (!rule.enabled || !rule.condition(payload)) return;
      key  = 'pa_in:' + payload.coin + ':' + Math.floor(Date.now() / 600000);
      text = fmtInstantMove(payload);
    }

  } else if (payload.type === 'whale') {
    cooldown = POST_COOLDOWN_PRICE;
    const rule = BROADCAST_RULES.whale;
    if (!rule.enabled || !rule.condition(payload)) return;
    key  = 'whale:' + (payload.txHash || payload.amount + payload.symbol).slice(0, 40);
    text = fmtWhaleAlert(payload);
  }

  if (!text || !key) return;
  if (!canPost(key, cooldown)) return;

  recentPosts.set(key, Date.now());
  await sendToChannel(text);
  console.log(`[CHANNEL] Posted: ${key}`);
}

// ── HELPERS ───────────────────────────────────────────────────────────────
function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmt(n) {
  if (!n) return '0';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1)    return n.toFixed(2);
  return n.toFixed(4);
}

function timeAgo(iso) {
  if (!iso) return 'just now';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)   return s + 's ago';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  return Math.floor(s/3600) + 'h ago';
}

module.exports = { broadcastToChannel };
