#!/usr/bin/env node
/**
 * AI Trend Hub — RSS Feed Collector v2.1
 * Reads sources.yaml → fetches RSS (parallel) → deduplicates → outputs collected_raw.json
 *
 * v2.1 changes:
 * - Parallel feed fetching (concurrency 5) for speed
 * - Per-feed hard timeout (15s) with Promise.race
 * - Global script timeout (4min) saves partial results before exit
 * - Disabled sources filtered out
 * - Graceful degradation: errors are logged, never block pipeline
 *
 * Usage: node scripts/collect.js [--max-items=15]
 */

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const Parser = require('rss-parser');

const ROOT = path.resolve(__dirname, '..');
const SOURCES_PATH = path.join(ROOT, 'data', 'sources.yaml');
const PROCESSED_PATH = path.join(ROOT, 'data', 'processed_urls.json');
const OUTPUT_PATH = path.join(ROOT, 'data', 'collected_raw.json');
const CONTENT_DIR = path.join(ROOT, 'content', 'daily');

const FEED_TIMEOUT = 12000;   // 12s per feed
const SCRIPT_TIMEOUT = 240000; // 4min total (leaves time for save)
const CONCURRENCY = 5;         // parallel feed fetches

const rssParser = new Parser({
  timeout: FEED_TIMEOUT,
  headers: { 'User-Agent': 'AI-Trend-Hub-Bot/2.1 (+https://suno7608.github.io/ai-trend-hub/)' },
  customFields: {
    item: [['dc:date', 'dcDate'], ['content:encoded', 'contentEncoded']],
  },
});

// ── Shared state for graceful timeout ──
let allItems = [];
let skipCount = 0;
let errorCount = 0;
let timedOut = false;

// Global script timeout — save partial results and exit
setTimeout(() => {
  console.warn('\n⏰ Script timeout (4 min) reached. Saving partial results...');
  timedOut = true;
  saveResults();
  process.exit(0);
}, SCRIPT_TIMEOUT);

function saveResults() {
  allItems.sort((a, b) => b.date_published.localeCompare(a.date_published));
  const maxItems = parseInt(process.env.MAX_ITEMS || '15');
  const output = allItems.slice(0, maxItems);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\n📊 Results:`);
  console.log(`   Collected: ${output.length} new articles`);
  console.log(`   Duplicates skipped: ${skipCount}`);
  console.log(`   Feed errors: ${errorCount}`);
  console.log(`   Timed out: ${timedOut}`);
  console.log(`💾 Saved to data/collected_raw.json`);
}

// ── Load sources from YAML ──
function loadSources() {
  if (!fs.existsSync(SOURCES_PATH)) {
    console.error('❌ data/sources.yaml not found');
    process.exit(1);
  }
  const raw = fs.readFileSync(SOURCES_PATH, 'utf-8');
  const parsed = YAML.parse(raw);
  const sources = (parsed.sources || parsed || []).filter(s =>
    s.feed_url && s.method && s.method.includes('rss') && s.status !== 'disabled'
  );
  console.log(`📡 Loaded ${sources.length} active RSS sources from sources.yaml`);
  return sources;
}

// ── Load already-processed URLs ──
function loadProcessedUrls() {
  const urls = new Set();
  if (fs.existsSync(PROCESSED_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(PROCESSED_PATH, 'utf-8'));
      data.forEach(u => urls.add(normalizeUrl(u)));
    } catch {}
  }
  if (fs.existsSync(CONTENT_DIR)) {
    const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(CONTENT_DIR, f), 'utf-8');
      const match = content.match(/canonical_url:\s*["']?(https?:\/\/[^\s"']+)/);
      if (match) urls.add(normalizeUrl(match[1]));
    }
  }
  console.log(`   ${urls.size} previously processed URLs loaded`);
  return urls;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(p => u.searchParams.delete(p));
    return u.href.replace(/\/+$/, '').toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

// ── Fetch with hard timeout wrapper ──
function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise.then(v => { clearTimeout(timer); return v; }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timeout ${ms/1000}s: ${label}`)), ms);
    }),
  ]);
}

// ── Fetch single feed ──
async function fetchFeed(feedUrl) {
  const feed = await withTimeout(rssParser.parseURL(feedUrl), FEED_TIMEOUT, feedUrl);
  return (feed.items || []).map(item => ({
    title: (item.title || '').trim(),
    link: (item.link || '').trim(),
    pubDate: item.pubDate || item.isoDate || item.dcDate || '',
    description: (item.contentSnippet || item.content || item.contentEncoded || '').trim().substring(0, 1000),
  })).filter(item => item.title && item.title.length > 10);
}

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// ── Process a single source ──
async function processSource(source, processedUrls) {
  const startTime = Date.now();
  try {
    const items = await fetchFeed(source.feed_url);
    let newItems = 0;
    for (const item of items.slice(0, 5)) {
      const normUrl = normalizeUrl(item.link);
      if (processedUrls.has(normUrl)) {
        skipCount++;
        continue;
      }
      allItems.push({
        title: item.title,
        link: item.link,
        date_published: parseDate(item.pubDate),
        description: item.description,
        source_id: source.id,
        source_name: source.name || source.id,
        source_url: source.feed_url,
        categories: source.category || [],
      });
      newItems++;
    }
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ✅ ${(source.name || source.id).padEnd(35)} ${items.length} found, ${newItems} new (${elapsed}s)`);
  } catch (e) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ❌ ${(source.name || source.id).padEnd(35)} ${e.message} (${elapsed}s)`);
    errorCount++;
  }
}

// ── Parallel execution with concurrency limit ──
async function parallelMap(items, fn, concurrency) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      if (timedOut) return;
      const i = index++;
      await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
}

// ── Main ──
async function main() {
  const args = process.argv.slice(2);
  const maxItems = parseInt((args.find(a => a.startsWith('--max-items=')) || '--max-items=15').split('=')[1]) || 15;
  process.env.MAX_ITEMS = String(maxItems);

  console.log('📡 AI Trend Hub — RSS Feed Collector v2.1');
  console.log('==========================================\n');

  const sources = loadSources();
  const processedUrls = loadProcessedUrls();

  console.log(`\n🔄 Fetching feeds (concurrency: ${CONCURRENCY})...\n`);

  await parallelMap(sources, (source) => processSource(source, processedUrls), CONCURRENCY);

  if (!timedOut) {
    saveResults();
  }

  if (allItems.length === 0) {
    console.log('\n⚠️  No new articles found. Pipeline will skip summarization.');
    process.exit(0);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  // Try to save whatever we have
  if (allItems.length > 0) {
    console.log('Saving partial results before exit...');
    saveResults();
  }
  process.exit(1);
});
