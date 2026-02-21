#!/usr/bin/env node
/**
 * AI Trend Hub — RSS Feed Collector v2.0
 * Reads sources.yaml → fetches RSS → deduplicates → outputs collected_raw.json
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

const FEED_TIMEOUT = 15000; // 15s per feed
const SCRIPT_TIMEOUT = 300000; // 5 min total script timeout

const rssParser = new Parser({
  timeout: FEED_TIMEOUT,
  headers: { 'User-Agent': 'AI-Trend-Hub-Bot/2.0 (+https://suno7608.github.io/ai-trend-hub/)' },
  customFields: {
    item: [['dc:date', 'dcDate'], ['content:encoded', 'contentEncoded']],
  },
});

// Global script timeout — force exit after 5 minutes
setTimeout(() => {
  console.error('\n⏰ Script timeout (5 min) reached. Exiting with collected data...');
  process.exit(0);
}, SCRIPT_TIMEOUT);

// ── Load sources from YAML ──
function loadSources() {
  if (!fs.existsSync(SOURCES_PATH)) {
    console.error('❌ data/sources.yaml not found');
    process.exit(1);
  }
  const raw = fs.readFileSync(SOURCES_PATH, 'utf-8');
  const parsed = YAML.parse(raw);
  // sources.yaml has array of source objects
  const sources = (parsed.sources || parsed || []).filter(s =>
    s.feed_url && s.method && s.method.includes('rss')
  );
  console.log(`📡 Loaded ${sources.length} RSS-capable sources from sources.yaml`);
  return sources;
}

// ── Load already-processed URLs ──
function loadProcessedUrls() {
  // From processed_urls.json
  const urls = new Set();
  if (fs.existsSync(PROCESSED_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(PROCESSED_PATH, 'utf-8'));
      data.forEach(u => urls.add(normalizeUrl(u)));
    } catch {}
  }
  // Also scan existing content/daily/ files for canonical_url
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
    // Remove tracking params
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(p => u.searchParams.delete(p));
    return u.href.replace(/\/+$/, '').toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

// ── Fetch with hard timeout wrapper ──
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms/1000}s: ${label}`)), ms)
    ),
  ]);
}

// ── Fetch and parse RSS/Atom feed via rss-parser ──
async function fetchFeed(feedUrl) {
  const feed = await withTimeout(rssParser.parseURL(feedUrl), FEED_TIMEOUT, feedUrl);
  return (feed.items || []).map(item => ({
    title: (item.title || '').trim(),
    link: (item.link || '').trim(),
    pubDate: item.pubDate || item.isoDate || item.dcDate || '',
    description: (item.contentSnippet || item.content || item.contentEncoded || '').trim().substring(0, 1000),
  })).filter(item => item.title && item.title.length > 10);
}

// ── Parse date to YYYY-MM-DD ──
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

// ── Main ──
async function main() {
  const args = process.argv.slice(2);
  const maxItems = parseInt((args.find(a => a.startsWith('--max-items=')) || '--max-items=15').split('=')[1]) || 15;

  console.log('📡 AI Trend Hub — RSS Feed Collector v2.0');
  console.log('==========================================\n');

  const sources = loadSources();
  const processedUrls = loadProcessedUrls();

  let allItems = [];
  let skipCount = 0;
  let errorCount = 0;

  for (const source of sources) {
    try {
      process.stdout.write(`  📥 ${source.name || source.id}... `);
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
      console.log(`✅ ${items.length} found, ${newItems} new`);
    } catch (e) {
      console.log(`❌ ${e.message}`);
      errorCount++;
    }
  }

  // Sort by date (newest first) and limit
  allItems.sort((a, b) => b.date_published.localeCompare(a.date_published));
  allItems = allItems.slice(0, maxItems);

  console.log(`\n📊 Results:`);
  console.log(`   Collected: ${allItems.length} new articles`);
  console.log(`   Duplicates skipped: ${skipCount}`);
  console.log(`   Feed errors: ${errorCount}`);

  // Save output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allItems, null, 2));
  console.log(`\n💾 Saved to data/collected_raw.json`);

  if (allItems.length === 0) {
    console.log('\n⚠️  No new articles found. Pipeline will skip summarization.');
    process.exit(0);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
