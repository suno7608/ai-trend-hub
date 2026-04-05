#!/usr/bin/env node
/**
 * AI Trend Hub — Monthly Deep Dive Generator v2.0
 * Enhanced with 7-stage BCG/McKinsey-grade analysis pipeline
 *
 * Usage: node scripts/generate-monthly.js [--month=2026-02] [--force] [--simple]
 * Requires: ANTHROPIC_API_KEY environment variable
 *
 * --simple : fallback to v1.0 single-call mode (for debugging)
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = path.resolve(__dirname, '..');
const DAILY_DIR = path.join(ROOT, 'content', 'daily');
const WEEKLY_DIR = path.join(ROOT, 'content', 'weekly');
const MONTHLY_DIR = path.join(ROOT, 'content', 'monthly');

// ── Load daily articles for a given month (ALL articles, not top 30) ──
function loadMonthlyArticles(monthStr) {
  if (!fs.existsSync(DAILY_DIR)) return [];

  const files = fs.readdirSync(DAILY_DIR).filter(f => f.endsWith('.md'));
  const articles = [];

  for (const f of files) {
    const raw = fs.readFileSync(path.join(DAILY_DIR, f), 'utf-8');
    const { data } = matter(raw);
    const pubDate = data.date_published || '';

    if (pubDate.startsWith(monthStr)) {
      articles.push({
        title: data.title || '',
        source_name: data.source_name || '',
        date_published: pubDate,
        categories: data.categories || [],
        tags: data.tags || [],
        summary_ko: data.summary_ko || '',
        summary_en: data.summary_en || '',
        so_what_ko: data.so_what_ko || '',
        so_what_en: data.so_what_en || '',
        key_points: data.key_points || [],
        confidence: data.confidence || 0,
        canonical_url: data.canonical_url || ''
      });
    }
  }

  // Sort by confidence descending (keep all, not just top 30)
  articles.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  return articles;
}

// ── Load weekly digests for the month ──
function loadWeeklyDigests(monthStr) {
  if (!fs.existsSync(WEEKLY_DIR)) return [];

  const files = fs.readdirSync(WEEKLY_DIR).filter(f => f.endsWith('.md'));
  const digests = [];

  for (const f of files) {
    const raw = fs.readFileSync(path.join(WEEKLY_DIR, f), 'utf-8');
    const { data } = matter(raw);

    const pubDate = data.date_published || '';
    if (pubDate.startsWith(monthStr)) {
      digests.push({
        week: data.week || '',
        title: data.title || '',
        top_trends: data.top_trends || [],
        top_keywords: data.top_keywords || []
      });
    }
  }

  return digests;
}

// ── v1.0 Fallback: Simple single-call generation ──────────
async function generateSimple(articles, weeklyDigests, monthStr) {
  console.log('  🔄 Using simple generation mode (v1.0 fallback)...');
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic();
  const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

  const topArticles = articles.slice(0, 30);
  const articlesSummary = topArticles.map((a, i) => `
[${i + 1}] ${a.title}
- Source: ${a.source_name} | Date: ${a.date_published} | Confidence: ${a.confidence}
- Categories: ${a.categories.join(', ')} | Tags: ${a.tags.join(', ')}
- Summary (KO): ${a.summary_ko}
- So What (KO): ${a.so_what_ko}
- URL: ${a.canonical_url}
`).join('\n---\n');

  const weeklySummary = weeklyDigests.map(w =>
    `Week ${w.week}: ${w.title}\nTop Trends: ${w.top_trends.join('; ')}`
  ).join('\n');

  const [year, month] = monthStr.split('-');
  const monthNames = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthNameKo = ['','1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: `You are the editor of "LG AI Trend Hub", producing a Monthly Deep Dive report for LG's Global D2C organization. Return ONLY valid JSON.`,
    messages: [{ role: 'user', content: `Generate Monthly Deep Dive for ${year}년 ${monthNameKo[parseInt(month)]}.

Return JSON:
{
  "title_ko": "Monthly Deep Dive 제목",
  "title_en": "Monthly Deep Dive Title",
  "featured_reports": ["report1", "report2", "report3"],
  "quote_of_month": {"text": "quote", "attribution": "source"},
  "reports_ko": [{"title":"","key_points":[],"d2c_implications":"","sources":[{"title":"","url":""}]}],
  "reports_en": [{"title":"","key_points":[],"d2c_implications":"","sources":[{"title":"","url":""}]}],
  "action_items_ko": [{"item":"","owner":""}],
  "action_items_en": [{"item":"","owner":""}],
  "regional_ko": {"amer":"","emea":"","apac":""},
  "regional_en": {"amer":"","emea":"","apac":""}
}

Articles (top ${topArticles.length}):
${articlesSummary}

Weekly:
${weeklySummary || '(none)'}

Return ONLY valid JSON.` }]
  });

  const text = response.content[0].text.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Could not parse simple generation JSON');
  }
}

// ── v1.0 Markdown Builder (simple fallback) ──────────────
function buildSimpleMarkdown(dive, monthStr, datePublished) {
  function escapeYaml(str) {
    if (!str) return '';
    return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
  }

  const frontmatter = [
    '---',
    `month: "${monthStr}"`,
    `date_published: "${datePublished}"`,
    `title: "${escapeYaml(dive.title_ko)}"`,
    `title_en: "${escapeYaml(dive.title_en)}"`,
    `featured_reports:`,
    ...(dive.featured_reports || []).map(r => `  - "${escapeYaml(r)}"`),
    `article_count: 30`,
    `analysis_stages: 1`,
    '---'
  ].join('\n');

  const [year, month] = monthStr.split('-');
  const monthNamesKo = ['','1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const monthNamesEn = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

  let ko = `\n<div class="lang-ko">\n\n## 📖 ${year}년 ${monthNamesKo[parseInt(month)]} Monthly Deep Dive\n\n`;

  if (dive.quote_of_month) {
    ko += `<div class="quote-of-month">\n\n### 이달의 문장\n\n> "${dive.quote_of_month.text}"\n> — ${dive.quote_of_month.attribution}\n\n</div>\n\n`;
  }

  ko += `## 핵심 보고서 요약\n\n`;
  (dive.reports_ko || []).forEach((report, i) => {
    ko += `<div class="report-card">\n\n### ${i + 1}. ${report.title}\n\n**핵심 포인트:**\n`;
    (report.key_points || []).forEach(p => { ko += `- ${p}\n`; });
    ko += `\n**D2C 시사점:**\n${report.d2c_implications}\n\n`;
    if (report.sources && report.sources.length > 0) {
      ko += `📄 **출처:** ${report.sources.map(s => `[${s.title}](${s.url})`).join(' | ')}\n`;
    }
    ko += `\n</div>\n\n`;
  });

  if (dive.action_items_ko && dive.action_items_ko.length > 0) {
    ko += `<div class="action-items-box">\n\n## 🎯 D2C 조직 액션 아이템\n\n`;
    dive.action_items_ko.forEach((item, i) => { ko += `${i + 1}. **${item.item}** (담당: ${item.owner})\n\n`; });
    ko += `</div>\n\n`;
  }

  if (dive.regional_ko) {
    ko += `<div class="region-box">\n\n## 🌏 지역별 관찰\n\n`;
    ko += `**AMER:** ${dive.regional_ko.amer}\n\n**EMEA:** ${dive.regional_ko.emea}\n\n**APAC:** ${dive.regional_ko.apac}\n\n</div>\n\n`;
  }

  ko += `</div>\n`;

  let en = `\n<div class="lang-en" style="display:none">\n\n## 📖 ${monthNamesEn[parseInt(month)]} ${year} Monthly Deep Dive\n\n`;

  if (dive.quote_of_month) {
    en += `<div class="quote-of-month">\n\n### Quote of the Month\n\n> "${dive.quote_of_month.text}"\n> — ${dive.quote_of_month.attribution}\n\n</div>\n\n`;
  }

  en += `## Key Report Summaries\n\n`;
  (dive.reports_en || []).forEach((report, i) => {
    en += `<div class="report-card">\n\n### ${i + 1}. ${report.title}\n\n**Key Takeaways:**\n`;
    (report.key_points || []).forEach(p => { en += `- ${p}\n`; });
    en += `\n**Implications for D2C:**\n${report.d2c_implications}\n\n`;
    if (report.sources && report.sources.length > 0) {
      en += `📄 **Source:** ${report.sources.map(s => `[${s.title}](${s.url})`).join(' | ')}\n`;
    }
    en += `\n</div>\n\n`;
  });

  if (dive.action_items_en && dive.action_items_en.length > 0) {
    en += `<div class="action-items-box">\n\n## 🎯 D2C Organization Action Items\n\n`;
    dive.action_items_en.forEach((item, i) => { en += `${i + 1}. **${item.item}** (Ownership: ${item.owner})\n\n`; });
    en += `</div>\n\n`;
  }

  if (dive.regional_en) {
    en += `<div class="region-box">\n\n## 🌏 Regional Observations\n\n`;
    en += `**AMER:** ${dive.regional_en.amer}\n\n**EMEA:** ${dive.regional_en.emea}\n\n**APAC:** ${dive.regional_en.apac}\n\n</div>\n\n`;
  }

  en += `</div>\n`;

  return `${frontmatter}\n${ko}${en}`;
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  console.log('📖 AI Trend Hub — Monthly Deep Dive Generator v2.0');
  console.log('====================================================\n');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const forceFlag = args.includes('--force');
  const simpleFlag = args.includes('--simple');

  let monthStr;
  const monthArg = args.find(a => a.startsWith('--month='));
  if (monthArg) {
    monthStr = monthArg.split('=')[1];
  } else {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    monthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
  }

  console.log(`📅 Target month: ${monthStr}`);
  console.log(`🔧 Mode: ${simpleFlag ? 'Simple (v1.0 fallback)' : 'Enhanced (v2.0 pipeline)'}\n`);

  const outputPath = path.join(MONTHLY_DIR, `${monthStr}.md`);
  if (fs.existsSync(outputPath) && !forceFlag) {
    console.log(`⚠️  ${monthStr}.md already exists. Use --force to overwrite.`);
    process.exit(0);
  }

  // Load content
  const articles = loadMonthlyArticles(monthStr);
  const weeklyDigests = loadWeeklyDigests(monthStr);

  console.log(`📄 Found ${articles.length} daily articles (all loaded)`);
  console.log(`📊 Found ${weeklyDigests.length} weekly digests\n`);

  if (articles.length === 0) {
    console.log('⚠️  No articles found for this month. Skipping.');
    process.exit(0);
  }

  if (articles.length < 5) {
    console.log(`⚠️  Only ${articles.length} articles. Need at least 5. Skipping.`);
    process.exit(0);
  }

  const [year, month] = monthStr.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const datePublished = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

  if (!fs.existsSync(MONTHLY_DIR)) {
    fs.mkdirSync(MONTHLY_DIR, { recursive: true });
  }

  let markdown;

  if (simpleFlag) {
    // ── Simple mode (v1.0) ──
    const dive = await generateSimple(articles, weeklyDigests, monthStr);
    markdown = buildSimpleMarkdown(dive, monthStr, datePublished);

  } else {
    // ── Enhanced pipeline (v2.0) ──
    let usedFallback = false;

    try {
      const { runPipeline } = require('./monthly/pipeline');
      const { renderAllCharts } = require('./monthly/chart-renderer');
      const { buildMarkdown } = require('./monthly/markdown-builder');

      // Run 7-stage pipeline
      const pipelineResult = await runPipeline(articles, weeklyDigests, monthStr);

      // Generate charts
      console.log('\n📊 Generating SVG charts...');
      const chartDir = path.join(MONTHLY_DIR, 'charts', monthStr);
      const chartRelativeDir = `charts/${monthStr}`;
      const generatedCharts = renderAllCharts(pipelineResult.chartData, chartDir);
      console.log(`   Generated ${Object.keys(generatedCharts).length} charts`);

      // Build enhanced markdown
      markdown = buildMarkdown(pipelineResult, monthStr, datePublished, chartRelativeDir);

    } catch (err) {
      console.error(`\n⚠️  Enhanced pipeline failed: ${err.message}`);
      console.log('🔄 Falling back to simple generation mode...\n');
      usedFallback = true;

      const dive = await generateSimple(articles, weeklyDigests, monthStr);
      markdown = buildSimpleMarkdown(dive, monthStr, datePublished);
    }

    if (usedFallback) {
      console.log('\n⚠️  NOTE: Generated with fallback mode. Check pipeline errors above.');
    }
  }

  fs.writeFileSync(outputPath, markdown, 'utf-8');

  console.log(`\n✅ Monthly Deep Dive saved: content/monthly/${monthStr}.md`);
  console.log(`   File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
