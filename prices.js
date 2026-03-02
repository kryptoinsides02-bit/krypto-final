/**
 * prices.js — Real-time price alert service  (v2 — Quiet & Meaningful)
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  TIER A — BTC, ETH, XRP, SOL                                        │
 * │    • Milestone crossing         → always noteworthy                 │
 * │    • 24h move ≥ 8%             → significant day                   │
 * │    • Hard cap: 3 alerts/day, min 4h gap between any two            │
 * │                                                                     │
 * │  TIER B — All other coins                                           │
 * │    • Milestone crossing         → only if also ≥15% on the day     │
 * │    • 24h move ≥ 15%            → major alt-coin event only         │
 * │    • Hard cap: 2 alerts/day, min 6h gap between any two            │
 * │                                                                     │
 * │  Instant-move (per-poll %) alerts REMOVED — far too noisy          │
 * │  Net result: ≤ 10–15 alerts total per day across ALL coins         │
 * └─────────────────────────────────────────────────────────────────────┘
 */

'use strict';

const axios = require('axios');

// ── TIER DEFINITIONS ──────────────────────────────────────────────────────
const TIER_A_SYMBOLS = new Set(['BTC', 'ETH', 'XRP', 'SOL']);

const RULES = {
  A: {
    dailyCap:        3,                    // max alerts this coin can fire per UTC day
    gapMs:           4 * 60 * 60 * 1000,  // min 4 hours between consecutive alerts
    threshold24h:    8,                    // 24h % move must be ≥ this to alert
    milestoneMinPct: 0,                    // milestones always fire (0 = no extra condition)
  },
  B: {
    dailyCap:        2,
    gapMs:           6 * 60 * 60 * 1000,  // min 6 hours between consecutive alerts
    threshold24h:    15,                   // alt coins: only big moves
    milestoneMinPct: 15,                   // milestone only fires if also ≥15% day move
  },
};

// ── POLLING ───────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 60 * 1000;       // poll CoinGecko every 60s

// ── STATE ─────────────────────────────────────────────────────────────────
let broadcastFn = null;
let COINS       = {};

// { coinId: { price, change24h, time } }
const prevPrices = {};

// { symbol: { day: 'YYYY-MM-DD', count: N, lastFired: timestamp } }
const coinState  = {};

// Milestone dedup: { 'BTC_ms_100000': timestamp } — so we don't re-fire same
// milestone if price bounces around it. Separate from dailyCap logic.
const msAlerted  = {};
const MS_REFIRE_MS = 12 * 60 * 60 * 1000; // same milestone won't re-fire for 12h

let alertIdSeq = 0;
function uid() { return 'pa_' + Date.now() + '_' + (++alertIdSeq); }

// ── HELPERS ───────────────────────────────────────────────────────────────
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function getTier(symbol) {
  return TIER_A_SYMBOLS.has(symbol) ? 'A' : 'B';
}

/**
 * Check whether this coin is allowed to fire another alert right now.
 * Handles day rollover (counter resets at midnight UTC).
 */
function canFire(symbol) {
  const rules = RULES[getTier(symbol)];
  const today = todayUTC();
  let   st    = coinState[symbol];

  // New day → reset
  if (!st || st.day !== today) {
    coinState[symbol] = { day: today, count: 0, lastFired: 0 };
    st = coinState[symbol];
  }

  if (st.count >= rules.dailyCap) {
    console.log(`[PRICE] ${symbol} daily cap (${st.count}/${rules.dailyCap}) — skipped`);
    return false;
  }

  if (st.lastFired > 0) {
    const elapsed = Date.now() - st.lastFired;
    if (elapsed < rules.gapMs) {
      const waitH = ((rules.gapMs - elapsed) / 3600000).toFixed(1);
      console.log(`[PRICE] ${symbol} gap not met — ${waitH}h to wait`);
      return false;
    }
  }

  return true;
}

function markFired(symbol) {
  const today = todayUTC();
  if (!coinState[symbol] || coinState[symbol].day !== today) {
    coinState[symbol] = { day: today, count: 0, lastFired: 0 };
  }
  coinState[symbol].count++;
  coinState[symbol].lastFired = Date.now();
  const rules = RULES[getTier(symbol)];
  console.log(`[PRICE] ${symbol} alert fired — ${coinState[symbol].count}/${rules.dailyCap} today`);
}

// ── FORMAT ────────────────────────────────────────────────────────────────
function fmtPrice(p) {
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 1)    return '$' + p.toFixed(2);
  if (p >= 0.01) return '$' + p.toFixed(4);
  return '$' + p.toFixed(8);
}

// ── EMIT ──────────────────────────────────────────────────────────────────
function emit(coin, alertType, title, message, price, change24h, threshold) {
  const payload = {
    type:        'price_alert',
    id:          uid(),
    title,
    message,
    coin:        coin.symbol,
    price,
    change24h:   parseFloat((change24h || 0).toFixed(2)),
    isPositive:  (change24h || 0) >= 0,
    alertType,
    threshold:   threshold || null,
    publishedAt: new Date().toISOString(),
  };
  if (broadcastFn) broadcastFn(payload);
  console.log(`[PRICE ALERT] [${alertType.toUpperCase()}] ${title}`);
}

// ── MILESTONE CHECK ───────────────────────────────────────────────────────
function checkMilestones(coin, cur, prev, change24h) {
  if (!prev || !coin.milestones) return;

  const tier  = getTier(coin.symbol);
  const rules = RULES[tier];

  // Tier B: milestone only fires if the coin is also having a big day
  if (rules.milestoneMinPct > 0 && Math.abs(change24h || 0) < rules.milestoneMinPct) {
    return;
  }

  for (const m of coin.milestones) {
    const crossedUp   = prev < m && cur >= m;
    const crossedDown = prev > m && cur <= m;
    if (!crossedUp && !crossedDown) continue;

    // Milestone-level dedup (independent of per-coin daily cap)
    const msKey = `${coin.symbol}_ms_${m}`;
    if (msAlerted[msKey] && (Date.now() - msAlerted[msKey]) < MS_REFIRE_MS) {
      console.log(`[PRICE] ${coin.symbol} milestone $${m} already alerted recently`);
      continue;
    }

    // Daily cap + gap check
    if (!canFire(coin.symbol)) return;

    msAlerted[msKey] = Date.now();
    markFired(coin.symbol);

    const dir      = crossedUp ? 'above' : 'below';
    const emoji    = crossedUp ? '🚀' : '📉';
    const absChange = Math.abs(change24h || 0);
    const sign     = (change24h || 0) >= 0 ? '+' : '';

    emit(
      coin, 'milestone',
      `${emoji} ${coin.name} (${coin.symbol}) crossed ${dir} $${m.toLocaleString()}`,
      `Now at ${fmtPrice(cur)} · ${sign}${(change24h || 0).toFixed(1)}% today`,
      cur, change24h, m
    );
  }
}

// ── 24H THRESHOLD CHECK ───────────────────────────────────────────────────
function check24hThreshold(coin, cur, change24h) {
  if (change24h === null || change24h === undefined) return;

  const tier     = getTier(coin.symbol);
  const rules    = RULES[tier];
  const abs      = Math.abs(change24h);

  if (abs < rules.threshold24h) return;

  if (!canFire(coin.symbol)) return;

  markFired(coin.symbol);

  const isUp  = change24h >= 0;
  const emoji = isUp ? '📈' : '📉';
  const dir   = isUp ? 'up' : 'down';
  const sign  = isUp ? '+' : '';
  const pct   = abs.toFixed(1);

  emit(
    coin, 'threshold',
    `${emoji} ${coin.name} (${coin.symbol}) ${dir} ${pct}% today`,
    `Trading at ${fmtPrice(cur)} · ${sign}${change24h.toFixed(2)}% in the last 24h`,
    cur, change24h, rules.threshold24h
  );
}

// ── FETCH & PROCESS ───────────────────────────────────────────────────────
async function fetchAndCheck() {
  const ids = Object.values(COINS).map(c => c.id).join(',');
  try {
    const res = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: { ids, vs_currencies: 'usd', include_24hr_change: true },
      timeout: 15000,
      headers: { Accept: 'application/json' },
    });

    for (const coin of Object.values(COINS)) {
      const d = res.data[coin.id];
      if (!d || typeof d.usd !== 'number') continue;

      const cur  = d.usd;
      const ch24 = typeof d.usd_24h_change === 'number' ? d.usd_24h_change : 0;
      const prev = prevPrices[coin.id]?.price ?? null;

      // Milestone first (more specific/exciting), then 24h threshold
      // Note: both share the canFire gate so at most one fires per poll
      checkMilestones(coin, cur, prev, ch24);
      check24hThreshold(coin, cur, ch24);

      prevPrices[coin.id] = { price: cur, change24h: ch24, time: Date.now() };
    }
  } catch (err) {
    if (err.response?.status === 429) {
      console.warn('[PRICE] CoinGecko rate limited — skipping poll');
    } else {
      console.warn('[PRICE] Fetch error:', err.message?.slice(0, 120));
    }
  }
}

// ── START ─────────────────────────────────────────────────────────────────
function startPriceAlerts(broadcast) {
  broadcastFn = broadcast;
  try {
    COINS = require('./coins.json');

    const tierA = Object.values(COINS).filter(c => TIER_A_SYMBOLS.has(c.symbol)).map(c => c.symbol);
    const tierB = Object.values(COINS).filter(c => !TIER_A_SYMBOLS.has(c.symbol)).map(c => c.symbol);

    console.log('[PRICE] Alert rules:');
    console.log(`  Tier A (${tierA.join(', ')}): ≥8% 24h OR milestone · max 3/day · min 4h gap`);
    console.log(`  Tier B (${tierB.join(', ')}): ≥15% 24h OR milestone+15%day · max 2/day · min 6h gap`);
    console.log(`  Polling every ${POLL_INTERVAL_MS / 1000}s`);
  } catch (e) {
    console.error('[PRICE] Failed to load coins.json:', e.message);
    return;
  }

  fetchAndCheck();
  setInterval(fetchAndCheck, POLL_INTERVAL_MS);
}

module.exports = { startPriceAlerts };
