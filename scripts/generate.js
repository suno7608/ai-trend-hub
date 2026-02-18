#!/usr/bin/env node
/**
 * AI Trend Hub — Markdown Generator v1.0
 * Reads summarized.json → generates daily markdown files → updates processed_urls.json
 *
 * Usage: node scripts/generate.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INPUT_PATH = path.join(ROOT, 'data', 'summarized.json');
const CONTENT_DIR = path.join(ROOT, 'content', 'daily');
const PROCESSED_PATH = path.join(ROOT, 'data', 'processed_urls.json');

// ── Slug generation ──
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

function generateFilename(item) {
  const date = item.date_published || new Date().toISOString().slice(0, 10);
  const sourceId = (item.source_id || 'unknown').replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  const slug = slugify(item.title);
  return `${date}__${sourceId}__${slug}.md`;
}

function generateId(item, index) {
  const date = (item.date_published || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  return `daily_${date}_${String(index + 1).padStart(3, '0')}`;
}

// ── YAML Frontmatter builder ──
function buildFrontmatter(item, id) {
  const yaml = [
    '---',
    `id: "${id}"`,
    `date_published: "${item.date_published}"`,
    `date_ingested: "${new Date().toISOString()}"`,
    `source_name: "${escapeYaml(item.source_name)}"`,
    `source_id: "${item.source_id}"`,
    `source_type: "rss"`,
    `source_url: "${item.source_url || ''}"`,
    `title: "${escapeYaml(item.title)}"`,
    `canonical_url: "${item.link}"`,
    `language_original: "en"`,
    `categories: [${(item.categories || ['tech']).map(c => `"${c}"`).join(', ')}]`,
    `tags: [${(item.tags || []).map(t => `"${t}"`).join(', ')}]`,
    `regions: ["global"]`,
    `summary_ko: "${escapeYaml(item.summary_ko)}"`,
    `summary_en: "${escapeYaml(item.summary_en)}"`,
    `so_what_ko: "${escapeYaml(item.so_what_ko)}"`,
    `so_what_en: "${escapeYaml(item.so_what_en)}"`,
    `key_points:`,
    ...(item.key_points || []).map(p => `  - "${escapeYaml(p)}"`),
    `confidence: ${item.confidence || 0.5}`,
    '---',
  ];
  return yaml.join('\n');
}

function escapeYaml(str) {
  if (!str) return '';
  return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

// ── Markdown body builder ──
function buildBody(item) {
  const sections = [];

  // Korean summary
  if (item.summary_ko) {
    sections.push(`<div class="lang-ko">\n\n${item.summary_ko}\n\n</div>`);
  }
  // English summary
  if (item.summary_en) {
    sections.push(`<div class="lang-en" style="display:none">\n\n${item.summary_en}\n\n</div>`);
  }

  // Key points
  if (item.key_points && item.key_points.length > 0) {
    sections.push(`\n## Key Points\n`);
    item.key_points.forEach(p => sections.push(`- ${p}`));
  }

  return sections.join('\n');
}

// ── Load processed URLs ──
function loadProcessedUrls() {
  if (fs.existsSync(PROCESSED_PATH)) {
    try { return JSON.parse(fs.readFileSync(PROCESSED_PATH, 'utf-8')); } catch {}
  }
  return [];
}

function saveProcessedUrls(urls) {
  // Keep last 500 URLs max (roughly 1 month of content)
  const trimmed = urls.slice(-500);
  fs.writeFileSync(PROCESSED_PATH, JSON.stringify(trimmed, null, 2));
}

// ── Main ──
function main() {
  console.log('📝 AI Trend Hub — Markdown Generator v1.0');
  console.log('==========================================\n');

  if (!fs.existsSync(INPUT_PATH)) {
    console.log('⚠️  No summarized.json found. Run summarize.js first.');
    process.exit(0);
  }

  const articles = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8'));
  if (articles.length === 0) {
    console.log('⚠️  No articles to generate.');
    process.exit(0);
  }

  // Ensure content/daily/ exists
  if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
  }

  const processedUrls = loadProcessedUrls();
  let created = 0;
  let skipped = 0;

  // Count existing files with today's date for ID generation
  const today = new Date().toISOString().slice(0, 10);
  const existingToday = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.startsWith(today)).length;

  articles.forEach((item, i) => {
    // Skip items with no AI summary (failed processing)
    if (!item.summary_ko && !item.summary_en && item.confidence === 0) {
      console.log(`  ⏭️  Skipping (no summary): ${item.title.substring(0, 60)}...`);
      skipped++;
      return;
    }

    const filename = generateFilename(item);
    const filepath = path.join(CONTENT_DIR, filename);

    // Skip if file already exists
    if (fs.existsSync(filepath)) {
      console.log(`  ⏭️  Already exists: ${filename}`);
      skipped++;
      return;
    }

    const id = generateId(item, existingToday + created);
    const frontmatter = buildFrontmatter(item, id);
    const body = buildBody(item);
    const content = `${frontmatter}\n\n${body}\n`;

    fs.writeFileSync(filepath, content, 'utf-8');
    console.log(`  ✅ Created: ${filename}`);
    created++;

    // Track URL
    if (item.link) processedUrls.push(item.link);
  });

  // Save updated processed URLs
  saveProcessedUrls(processedUrls);

  console.log(`\n📊 Results:`);
  console.log(`   Created: ${created} markdown files`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total in content/daily/: ${fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md')).length}`);
}

main();
