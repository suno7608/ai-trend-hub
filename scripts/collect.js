#!/usr/bin/env node
/**
 * AI Trend Hub — RSS Feed Collector v2.0
 * Reads sources.yaml → fetches RSS → deduplicates → outputs collected_raw.json
 *
 * Usage: node scripts/collect.js [--max-items=15]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const YAML = require('yaml');

const ROOT = path.resolve(__dirname, '..');
const SOURCES_PATH = path.join(ROOT, 'data', 'sources.yaml');
const PROCESSED_PATH = path.join(ROOT, 'data', 'processed_urls.json');
const OUTPUT_PATH = path.join(ROOT, 'data', 'collected_raw.json');
const CONTENT_DIR = path.join(ROOT, 'content', 'daily');

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

// ── HTTP Fetch with redirect ──
function fetchURL(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: { 'User-Agent': 'AI-Trend-Hub-Bot/2.0 (+https://suno7608.github.io/ai-trend-hub/)' },
      timeout
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchURL(res.headers.location, timeout).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── RSS/Atom Parser ──
function parseRSSItems(xml) {
  const items = [];

  // RSS <item>
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const x = match[1];
    const title = extractTag(x, 'title');
    const link = extractTag(x, 'link') || extractAttr(x, 'link', 'href');
    const pubDate = extractTag(x, 'pubDate') || extractTag(x, 'dc:date');
    const desc = extractTag(x, 'description');
    if (title && title.length > 10) {
      items.push({ title: title.trim(), link: link.trim(), pubDate, description: (desc || '').trim().substring(0, 1000) });
    }
  }

  // Atom <entry>
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(xml)) !== null) {
      const x = match[1];
      const title = extractTag(x, 'title');
      const link = extractAttr(x, 'link', 'href') || extractTag(x, 'link');
      const pubDate = extractTag(x, 'published') || extractTag(x, 'updated');
      const desc = extractTag(x, 'summary') || extractTag(x, 'content');
      if (title && title.length > 10) {
        items.push({ title: title.trim(), link: link.trim(), pubDate, description: (desc || '').trim().substring(0, 1000) });
      }
    }
  }

  return items;
}

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
}

function extractAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const m = xml.match(re);
  return m ? m[1] : '';
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
      const result = await fetchURL(source.feed_url);
      if (result.status === 200) {
        const items = parseRSSItems(result.data);
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
      } else {
        console.log(`⚠️  HTTP ${result.status}`);
        errorCount++;
      }
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
