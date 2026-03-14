/**
 * news.js — Crypto news from NewsData.io API + RSS fallback
 *
 * NewsData.io free tier: 200 requests/day, returns up to 10 articles per call
 * Queried every 10 minutes = 144 calls/day (fits free tier)
 * Returns articles from the last 24 hours by default
 *
 * RSS feeds used as fallback and supplementary source (25 feeds)
 * Combined: 24h of real news from both sources
 */

'use strict';

const axios     = require('axios');
const RSSParser = require('rss-parser');
const parser    = new RSSParser({ timeout: 20000 });

// ── NEWSDATA.IO CONFIG ────────────────────────────────────────────────────
// Get free API key at: https://newsdata.io/register
// Add to .env: NEWSDATA_API_KEY=your_key_here
const NEWSDATA_KEY = process.env.NEWSDATA_API_KEY;
const NEWSDATA_URL = 'https://newsdata.io/api/1/news';

// ── RSS FEEDS ─────────────────────────────────────────────────────────────
const NEWS_FEEDS = [
  { name: 'CoinDesk',        url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',       priority: true },
  { name: 'Crypto Briefing', url: 'https://cryptobriefing.com/feed/',                      priority: true },
  { name: 'Cointelegraph',   url: 'https://cointelegraph.com/rss',                         priority: true },
  { name: 'The Block',       url: 'https://www.theblock.co/rss.xml',                       priority: true },
  { name: 'Decrypt',         url: 'https://decrypt.co/feed',                               priority: true },
  { name: 'Bitcoin.com',     url: 'https://news.bitcoin.com/feed/',                        priority: true },
  { name: 'Bitcoinist',      url: 'https://bitcoinist.com/feed/',                          priority: true },
  { name: 'AMBCrypto',       url: 'https://ambcrypto.com/feed/',                           priority: false },
  { name: 'U.Today',         url: 'https://u.today/rss',                                   priority: false },
  { name: 'NewsBTC',         url: 'https://www.newsbtc.com/feed/',                         priority: false },
  { name: 'BeInCrypto',      url: 'https://beincrypto.com/feed/',                          priority: false },
  { name: 'CryptoSlate',     url: 'https://cryptoslate.com/feed/',                         priority: false },
  { name: 'The Defiant',     url: 'https://thedefiant.io/feed',                            priority: false },
  { name: 'Bankless',        url: 'https://www.bankless.com/feed',                         priority: false },
  { name: 'DL News',         url: 'https://www.dlnews.com/arc/outboundfeeds/rss/',         priority: false },
  { name: 'Protos',          url: 'https://protos.com/feed/',                              priority: false },
  { name: 'CoinGecko News',  url: 'https://www.coingecko.com/en/news/feed',                priority: false },
  { name: 'CoinPedia',       url: 'https://coinpedia.org/feed/',                           priority: false },
  { name: 'ForbesCrypto',    url: 'https://www.forbes.com/digital-assets/feed/',           priority: false },
  { name: 'Benzinga Crypto', url: 'https://www.benzinga.com/topic/cryptocurrency/feed',    priority: false },
  { name: 'ZyCrypto',        url: 'https://zycrypto.com/feed/',                            priority: false },
  { name: 'CryptoPotato',    url: 'https://cryptopotato.com/feed/',                        priority: false },
  { name: 'Blockonomi',      url: 'https://blockonomi.com/feed/',                          priority: false },
  { name: 'CryptoDaily',     url: 'https://cryptodaily.co.uk/feed',                       priority: false },
  { name: 'CryptoBriefing',  url: 'https://cryptobriefing.com/feed/',                     priority: false },
];

// ── STATE ─────────────────────────────────────────────────────────────────
let broadcastFn   = null;
let isFirstPoll   = true;
let _cycleRunning = false;
const seenUrls    = new Set();

// ── TITLE DEDUP (same story from multiple sources) ────────────────────────
const DEDUP_WINDOW = 24 * 60 * 60 * 1000;
const seenTitles   = new Map();

function normTitle(title) {
  const stops = new Set(['a','an','the','is','in','on','at','to','of','for',
    'and','or','but','with','by','as','from','its','it','this','that',
    'be','are','was','were','has','have','had','will','not','no','s']);
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stops.has(w))
    .sort()
    .join(' ');
}

function isDuplicate(title, source) {
  const normA  = normTitle(title);
  const wordsA = new Set(normA.split(' ').filter(Boolean));
  if (wordsA.size === 0) return false;
  const now = Date.now();
  for (const [hash, entry] of seenTitles) {
    if (now - entry.ts > DEDUP_WINDOW) { seenTitles.delete(hash); continue; }
    const wordsB = new Set(hash.split(' ').filter(Boolean));
    let shared = 0;
    for (const w of wordsA) if (wordsB.has(w)) shared++;
    const union = wordsA.size + wordsB.size - shared;
    if (shared / union >= 0.70) {
      console.log(`[News] Dedup (${((shared/union)*100).toFixed(0)}% overlap, first: ${entry.source}): "${title.slice(0,50)}"`);
      return true;
    }
  }
  seenTitles.set(normA, { ts: now, source });
  return false;
}

// ── CONTENT FILTERS ───────────────────────────────────────────────────────
const BREAKING_KEYWORDS = [
  'breaking', 'just in', 'urgent', 'alert', 'hack', 'exploit', 'crash',
  'ban', 'sec', 'lawsuit', 'arrest', 'seized', 'collapse', 'emergency',
  'flash crash', 'liquidat', 'etf approved', 'etf rejected', 'halving',
  'fork', 'listing', 'delisting', 'investigation', 'regulatory',
];

const ANALYTICAL_PATTERNS = [
  /\?$/,
  /\bhere's why\b/i, /\bhere are the\b/i, /\bhere is why\b/i,
  /\bcould\b.*\b(reach|hit|drop|surge|fall)\b/i,
  /\bpredicts?\b/i, /\banalyst says?\b/i,
  /\banalysts? (say|think|warn|expect|believe)\b/i,
  /\bprice prediction\b/i, /\b(bull|bear)ish signal\b/i,
  /\bwhy (bitcoin|ethereum|btc|eth|crypto|market)\b/i,
  /\bwhat happens (if|when|next)\b/i,
  /\b(will|can|should) (bitcoin|ethereum|btc|eth|crypto)\b/i,
  /\bhow (high|low|much|long)\b/i,
  /\bnext target\b/i, /\bprice outlook\b/i,
  /\bmarket analysis\b/i, /\btechnical analysis\b/i,
];

function isAnalytical(title) { return ANALYTICAL_PATTERNS.some(rx => rx.test(title)); }
function isBreaking(title)   { return !isAnalytical(title) && BREAKING_KEYWORDS.some(k => title.toLowerCase().includes(k)); }

function extractTags(title) {
  const tags = [];
  const coins = ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','LINK','UNI','MATIC','DOT'];
  coins.forEach(c => { if (title.toUpperCase().includes(c)) tags.push(c); });
  if (/bitcoin/i.test(title)  && !tags.includes('BTC'))  tags.push('BTC');
  if (/ethereum/i.test(title) && !tags.includes('ETH'))  tags.push('ETH');
  if (/solana/i.test(title)   && !tags.includes('SOL'))  tags.push('SOL');
  if (/\bsec\b/i.test(title))       tags.push('SEC');
  if (/\betf\b/i.test(title))       tags.push('ETF');
  if (/defi/i.test(title))          tags.push('DeFi');
  if (/hack|exploit/i.test(title))  tags.push('Security');
  if (/list(ing|ed)/i.test(title))  tags.push('Listing');
  return [...new Set(tags)].slice(0, 4);
}

// ── MAX AGE ───────────────────────────────────────────────────────────────
const MAX_AGE_MS = 24 * 60 * 60 * 1000;  // 24 hours

// ── NEWSDATA.IO FETCH ─────────────────────────────────────────────────────
async function fetchFromNewsdata(batch) {
  if (!NEWSDATA_KEY) return [];
  try {
    const res = await axios.get(NEWSDATA_URL, {
      params: {
        apikey:   NEWSDATA_KEY,
        q:        'crypto OR bitcoin OR ethereum OR blockchain',
        language: 'en',
        category: 'technology,business',
        size:     10,
        page:     null,
      },
      timeout: 15000,
    });

    const articles = res.data?.results || [];
    const out = [];

    for (const a of articles) {
      const url = a.link;
      if (!url || seenUrls.has(url)) continue;

      const pubDate = a.pubDate ? new Date(a.pubDate) : null;
      if (pubDate && (Date.now() - pubDate.getTime()) > MAX_AGE_MS) continue;

      if (isDuplicate(a.title || '', a.source_id || 'NewsData')) continue;

      seenUrls.add(url);
      out.push({
        type:        'news',
        title:       a.title || '',
        summary:     a.description || '',
        url,
        source:      a.source_id || 'NewsData',
        publishedAt: a.pubDate || new Date().toISOString(),
        tags:        extractTags(a.title || ''),
        breaking:    isBreaking(a.title || ''),
        priority:    true,
      });
    }

    if (out.length > 0) console.log(`[News] +${out.length} from NewsData.io`);
    return out;
  } catch (err) {
    if (err.response?.status === 422 || err.response?.status === 429) {
      console.warn('[News] NewsData.io limit hit — using RSS only');
    } else {
      console.warn('[News] NewsData.io error:', err.message?.slice(0, 80));
    }
    return [];
  }
}

// ── RSS FEED FETCH ────────────────────────────────────────────────────────
async function pollRSSFeed(feed, batch) {
  try {
    const parsed = await parser.parseURL(feed.url);
    let added = 0;
    for (const item of parsed.items.slice(0, 50)) {
      const url = item.link || item.guid;
      if (!url || seenUrls.has(url)) continue;
      const pubDate = item.pubDate ? new Date(item.pubDate) : null;
      if (pubDate && (Date.now() - pubDate.getTime()) > MAX_AGE_MS) continue;
      if (!pubDate && !isFirstPoll) continue;
      if (isDuplicate(item.title || '', feed.name)) continue;
      seenUrls.add(url);
      batch.push({
        type:        'news',
        title:       item.title || '',
        summary:     item.contentSnippet || item.content?.replace(/<[^>]+>/g,'').slice(0,200) || '',
        url,
        source:      feed.name,
        publishedAt: item.pubDate || new Date().toISOString(),
        tags:        extractTags(item.title || ''),
        breaking:    isBreaking(item.title || ''),
        priority:    feed.priority || false,
      });
      added++;
    }
    if (added > 0) console.log(`[News] +${added} from ${feed.name}`);
  } catch (_) { /* timeout — skip silently */ }
}

// ── FLUSH BATCH — sort oldest→newest then broadcast ───────────────────────
function flushBatch(batch, label) {
  if (batch.length === 0) return;
  batch.sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
  console.log(`[News] ${label}: broadcasting ${batch.length} articles`);
  for (const item of batch) {
    if (broadcastFn) broadcastFn(item);
  }
}

// ── POLL CYCLE ────────────────────────────────────────────────────────────
async function runCycle(feeds, label, includeNewsdata) {
  if (_cycleRunning) { console.log(`[News] ${label} skipped — busy`); return; }
  _cycleRunning = true;
  const batch = [];
  try {
    // NewsData.io first (most reliable 24h source)
    if (includeNewsdata) {
      const nd = await fetchFromNewsdata(batch);
      batch.push(...nd);
    }
    // RSS feeds
    for (const feed of feeds) await pollRSSFeed(feed, batch);
    flushBatch(batch, label);
  } finally {
    _cycleRunning = false;
  }
}

// ── START ─────────────────────────────────────────────────────────────────
function startNewsPolling(broadcast) {
  broadcastFn = broadcast;
  const hasNewsdata = !!NEWSDATA_KEY;
  console.log(`[News] Starting — ${NEWS_FEEDS.length} RSS feeds + ${hasNewsdata ? 'NewsData.io API ✅' : 'no NewsData key (RSS only)'}`);
  if (!hasNewsdata) {
    console.log('[News] Add NEWSDATA_API_KEY to .env for 24h news — free at newsdata.io/register');
  }

  // Startup: all feeds + newsdata
  runCycle(NEWS_FEEDS, 'startup', true).then(() => {
    isFirstPoll = false;
    console.log('[News] Live mode active');
  });

  // Priority RSS every 2 min
  const priority = NEWS_FEEDS.filter(f => f.priority);
  setInterval(() => runCycle(priority, 'priority poll', false), 2 * 60 * 1000);

  // All RSS every 5 min
  setInterval(() => runCycle(NEWS_FEEDS, 'full RSS poll', false), 5 * 60 * 1000);

  // NewsData.io every 10 min (fits 200/day free limit: 144 calls/day)
  if (hasNewsdata) {
    setInterval(async () => {
      if (_cycleRunning) return;
      _cycleRunning = true;
      try {
        const nd = await fetchFromNewsdata([]);
        flushBatch(nd, 'NewsData poll');
      } finally { _cycleRunning = false; }
    }, 10 * 60 * 1000);
  }

  // Hourly URL cache clear
  setInterval(() => {
    seenUrls.clear();
    console.log('[News] URL cache cleared');
  }, 60 * 60 * 1000);
}

module.exports = { startNewsPolling };
