#!/usr/bin/env node
/**
 * AI Trend Hub — RSS Feed Collector (PoC)
 * Fetches RSS feeds from sources.yaml and outputs raw items
 *
 * Usage: node scripts/collect.js [--max-items=15] [--source=retail_dive]
 *
 * NOTE: This is a PoC collector. In production, integrate with:
 * - AI summarization API (Claude/OpenAI) for summary_ko/en generation
 * - Deduplication engine (URL + similarity based)
 * - Scoring/ranking model
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Simple YAML parser for sources (just key-value, no full YAML lib needed for PoC)
function loadSources() {
  const sourcesPath = path.resolve(__dirname, '..', 'data', 'sources.yaml');
  if (!fs.existsSync(sourcesPath)) {
    console.error('❌ sources.yaml not found');
    process.exit(1);
  }
  // For PoC, we use a simplified approach
  // In production, use a proper YAML parser
  const raw = fs.readFileSync(sourcesPath, 'utf-8');
  console.log(`📡 Loaded sources.yaml (${raw.split('- id:').length - 1} sources)`);
  return raw;
}

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: { 'User-Agent': 'AI-Trend-Hub-Bot/1.0' },
      timeout: 10000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchURL(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Simple RSS/Atom XML parser (PoC level)
function parseRSSItems(xml) {
  const items = [];
  // Try RSS <item> tags
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = (itemXml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s) || [])[1] || '';
    const link = (itemXml.match(/<link>(.*?)<\/link>/s) || [])[1] || '';
    const pubDate = (itemXml.match(/<pubDate>(.*?)<\/pubDate>/s) || [])[1] || '';
    const desc = (itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/s) || [])[1] || '';
    if (title) items.push({ title: title.trim(), link: link.trim(), pubDate, description: desc.trim().substring(0, 500) });
  }

  // Try Atom <entry> tags if no RSS items found
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      const title = (entryXml.match(/<title[^>]*>(.*?)<\/title>/s) || [])[1] || '';
      const link = (entryXml.match(/<link[^>]*href="([^"]*)"/) || [])[1] || '';
      const published = (entryXml.match(/<(?:published|updated)>(.*?)<\/(?:published|updated)>/s) || [])[1] || '';
      if (title) items.push({ title: title.trim(), link: link.trim(), pubDate: published, description: '' });
    }
  }

  return items;
}

async function main() {
  const args = process.argv.slice(2);
  const maxItems = parseInt((args.find(a => a.startsWith('--max-items=')) || '').split('=')[1]) || 15;

  console.log('📡 AI Trend Hub — RSS Feed Collector (PoC)');
  console.log('==========================================\n');

  // PoC: Test a few known-good RSS feeds
  const testFeeds = [
    { id: 'retail_dive', name: 'Retail Dive', url: 'https://www.retaildive.com/feeds/news/' },
    { id: 'adweek', name: 'Adweek', url: 'https://www.adweek.com/feed' },
    { id: 'martech_org', name: 'MarTech.org', url: 'https://martech.org/feed' },
    { id: 'digiday', name: 'Digiday', url: 'https://digiday.com/feed' },
    { id: 'the_verge_ai', name: 'The Verge (AI)', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  ];

  let allItems = [];

  for (const feed of testFeeds) {
    try {
      console.log(`  Fetching ${feed.name}...`);
      const result = await fetchURL(feed.url);
      if (result.status === 200) {
        const items = parseRSSItems(result.data);
        console.log(`    ✅ ${items.length} items found`);
        allItems.push(...items.slice(0, 5).map(item => ({
          ...item,
          source_id: feed.id,
          source_name: feed.name
        })));
      } else {
        console.log(`    ⚠️ HTTP ${result.status}`);
      }
    } catch (e) {
      console.log(`    ❌ Error: ${e.message}`);
    }
  }

  console.log(`\n📊 Total items collected: ${allItems.length}`);
  console.log(`   (Limit to ${maxItems} for processing)\n`);

  // Output results
  const outputPath = path.resolve(__dirname, '..', 'data', 'collected_raw.json');
  fs.writeFileSync(outputPath, JSON.stringify(allItems.slice(0, maxItems), null, 2));
  console.log(`💾 Saved to ${outputPath}`);
  console.log('\n⚠️  Next steps (not yet automated):');
  console.log('   1. Send to AI API for summarization');
  console.log('   2. Generate markdown files with YAML frontmatter');
  console.log('   3. Validate and commit');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
