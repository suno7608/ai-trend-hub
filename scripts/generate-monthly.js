#!/usr/bin/env node
/**
 * AI Trend Hub — Monthly Deep Dive Generator v1.0
 * Reads past month's daily + weekly content → calls Claude API → generates Monthly Deep Dive
 *
 * Usage: node scripts/generate-monthly.js [--month=2026-02] [--force]
 * Requires: ANTHROPIC_API_KEY environment variable
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const Anthropic = require('@anthropic-ai/sdk');

const ROOT = path.resolve(__dirname, '..');
const DAILY_DIR = path.join(ROOT, 'content', 'daily');
const WEEKLY_DIR = path.join(ROOT, 'content', 'weekly');
const MONTHLY_DIR = path.join(ROOT, 'content', 'monthly');

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

// ── Load daily articles for a given month ──
function loadMonthlyArticles(monthStr) {
  if (!fs.existsSync(DAILY_DIR)) return [];

  const files = fs.readdirSync(DAILY_DIR).filter(f => f.endsWith('.md'));
  const articles = [];

  for (const f of files) {
    const raw = fs.readFileSync(path.join(DAILY_DIR, f), 'utf-8');
    const { data } = matter(raw);
    const pubDate = data.date_published || '';

    // Match YYYY-MM prefix
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

  articles.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  return articles;
}

// ── Load weekly digests for the month ──
function loadWeeklyDigests(monthStr) {
  if (!fs.existsSync(WEEKLY_DIR)) return [];

  const [year, month] = monthStr.split('-').map(Number);
  const files = fs.readdirSync(WEEKLY_DIR).filter(f => f.endsWith('.md'));
  const digests = [];

  for (const f of files) {
    const raw = fs.readFileSync(path.join(WEEKLY_DIR, f), 'utf-8');
    const { data } = matter(raw);

    // Check if the weekly digest falls within the month
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

// ── Claude API call for Monthly Deep Dive ──
async function generateMonthlyDeepDive(client, articles, weeklyDigests, monthStr) {
  // Build articles summary (top 30 by confidence)
  const topArticles = articles.slice(0, 30);
  const articlesSummary = topArticles.map((a, i) => `
[${i + 1}] ${a.title}
- Source: ${a.source_name} | Date: ${a.date_published} | Confidence: ${a.confidence}
- Categories: ${a.categories.join(', ')} | Tags: ${a.tags.join(', ')}
- Summary (KO): ${a.summary_ko}
- So What (KO): ${a.so_what_ko}
- URL: ${a.canonical_url}
`).join('\n---\n');

  // Build weekly digests summary
  const weeklySummary = weeklyDigests.map(w => `
Week ${w.week}: ${w.title}
Top Trends: ${w.top_trends.join('; ')}
Keywords: ${w.top_keywords.join(', ')}
`).join('\n');

  const [year, month] = monthStr.split('-');
  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const monthNameKo = ['', '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'];

  const systemPrompt = `You are the editor of "LG AI Trend Hub", producing a Monthly Deep Dive report for LG's Global D2C organization.

Your task: Create a comprehensive Monthly Deep Dive that synthesizes the month's trends into strategic insights. This is a PREMIUM report meant for senior leadership.

OUTPUT FORMAT: Return ONLY a valid JSON object:
{
  "title_ko": "Monthly Deep Dive: [핵심 테마 한국어] — D2C가 알아야 할 [N]가지 전략적 시사점",
  "title_en": "Monthly Deep Dive: [Core Theme English] — [N] Strategic Implications for D2C",
  "featured_reports": ["Report name 1", "Report name 2", ...up to 5],
  "quote_of_month": {
    "text": "A notable quote from one of the articles or a synthesized insight",
    "attribution": "Source Name / Report"
  },
  "reports_ko": [
    {
      "title": "보고서/트렌드 주제",
      "key_points": ["포인트1", "포인트2", "포인트3"],
      "d2c_implications": "D2C 관점 시사점 2-3문장",
      "sources": [{"title": "Source Title", "url": "https://..."}]
    }
  ],
  "reports_en": [
    {
      "title": "Report/Trend Topic",
      "key_points": ["Point 1", "Point 2", "Point 3"],
      "d2c_implications": "D2C implications 2-3 sentences",
      "sources": [{"title": "Source Title", "url": "https://..."}]
    }
  ],
  "action_items_ko": [
    {"item": "액션 아이템", "owner": "담당부서"}
  ],
  "action_items_en": [
    {"item": "Action item", "owner": "Department"}
  ],
  "regional_ko": {
    "amer": "AMER 지역 관찰 (2-3 sentences)",
    "emea": "EMEA 지역 관찰 (2-3 sentences)",
    "apac": "APAC 지역 관찰 (2-3 sentences)"
  },
  "regional_en": {
    "amer": "AMER regional observation (2-3 sentences)",
    "emea": "EMEA regional observation (2-3 sentences)",
    "apac": "APAC regional observation (2-3 sentences)"
  }
}

RULES:
- Create exactly 5 report/trend sections
- Each section must reference at least 1 actual article from the input
- Sources must use REAL URLs from the input articles - NEVER fabricate URLs
- Action items should be specific and assign to departments (Commerce/IT/Data/CRM/Marketing/Strategy)
- Regional observations should connect global trends to specific market dynamics
- Write for a senior executive audience: strategic, data-driven, actionable
- NEVER fabricate statistics or quotes not present in the source articles
- Return ONLY valid JSON, no markdown code blocks`;

  const userPrompt = `Generate a Monthly Deep Dive for ${year}년 ${monthNameKo[parseInt(month)]} (${monthNames[parseInt(month)]} ${year}).

=== WEEKLY DIGESTS FROM THIS MONTH ===
${weeklySummary || '(No weekly digests available)'}

=== TOP ARTICLES THIS MONTH (${topArticles.length} of ${articles.length} total) ===
${articlesSummary}

Return ONLY a valid JSON object.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  const text = response.content[0].text.trim();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) json = JSON.parse(match[0]);
    else throw new Error('Could not parse JSON from Claude response');
  }

  return json;
}

// ── Build Monthly Markdown ──
function buildMonthlyMarkdown(dive, monthStr, datePublished) {
  // Frontmatter
  const frontmatter = [
    '---',
    `month: "${monthStr}"`,
    `date_published: "${datePublished}"`,
    `title: "${escapeYaml(dive.title_ko)}"`,
    `title_en: "${escapeYaml(dive.title_en)}"`,
    `featured_reports:`,
    ...dive.featured_reports.map(r => `  - "${escapeYaml(r)}"`),
    '---'
  ].join('\n');

  // ── Korean content ──
  let ko = `\n<div class="lang-ko">\n\n`;
  const [year, month] = monthStr.split('-');
  ko += `## 📖 ${year}년 ${parseInt(month)}월 Monthly Deep Dive\n\n`;

  // Quote of month
  if (dive.quote_of_month) {
    ko += `<div class="quote-of-month">\n\n### 이달의 문장 (Quote of the Month)\n\n`;
    ko += `> "${dive.quote_of_month.text}"\n> — ${dive.quote_of_month.attribution}\n\n</div>\n\n`;
  }

  // Reports
  ko += `## 핵심 보고서 요약\n\n`;
  dive.reports_ko.forEach((report, i) => {
    ko += `<div class="report-card">\n\n### ${i + 1}. ${report.title}\n\n`;
    ko += `**핵심 포인트:**\n`;
    report.key_points.forEach(p => { ko += `- ${p}\n`; });
    ko += `\n**D2C 시사점:**\n${report.d2c_implications}\n\n`;
    if (report.sources && report.sources.length > 0) {
      ko += `📄 **출처:** `;
      ko += report.sources.map(s => `[${s.title}](${s.url})`).join(' | ');
      ko += '\n';
    }
    ko += `\n</div>\n\n`;
  });

  // Action items
  if (dive.action_items_ko && dive.action_items_ko.length > 0) {
    ko += `<div class="action-items-box">\n\n## 🎯 D2C 조직 액션 아이템\n\n`;
    dive.action_items_ko.forEach((item, i) => {
      ko += `${i + 1}. **${item.item}** (담당: ${item.owner})\n\n`;
    });
    ko += `</div>\n\n`;
  }

  // Regional observations
  if (dive.regional_ko) {
    ko += `<div class="region-box">\n\n## 🌏 지역별 관찰\n\n`;
    ko += `**AMER (Americas):**\n${dive.regional_ko.amer}\n\n`;
    ko += `**EMEA (Europe, Middle East, Africa):**\n${dive.regional_ko.emea}\n\n`;
    ko += `**APAC (Asia Pacific):**\n${dive.regional_ko.apac}\n\n`;
    ko += `</div>\n\n`;
  }

  ko += `</div>\n`;

  // ── English content ──
  let en = `\n<div class="lang-en" style="display:none">\n\n`;
  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  en += `## 📖 ${monthNames[parseInt(month)]} ${year} Monthly Deep Dive\n\n`;

  if (dive.quote_of_month) {
    en += `<div class="quote-of-month">\n\n### Quote of the Month\n\n`;
    en += `> "${dive.quote_of_month.text}"\n> — ${dive.quote_of_month.attribution}\n\n</div>\n\n`;
  }

  en += `## Key Report Summaries\n\n`;
  dive.reports_en.forEach((report, i) => {
    en += `<div class="report-card">\n\n### ${i + 1}. ${report.title}\n\n`;
    en += `**Key Takeaways:**\n`;
    report.key_points.forEach(p => { en += `- ${p}\n`; });
    en += `\n**Implications for D2C:**\n${report.d2c_implications}\n\n`;
    if (report.sources && report.sources.length > 0) {
      en += `📄 **Source:** `;
      en += report.sources.map(s => `[${s.title}](${s.url})`).join(' | ');
      en += '\n';
    }
    en += `\n</div>\n\n`;
  });

  if (dive.action_items_en && dive.action_items_en.length > 0) {
    en += `<div class="action-items-box">\n\n## 🎯 D2C Organization Action Items\n\n`;
    dive.action_items_en.forEach((item, i) => {
      en += `${i + 1}. **${item.item}** (Ownership: ${item.owner})\n\n`;
    });
    en += `</div>\n\n`;
  }

  if (dive.regional_en) {
    en += `<div class="region-box">\n\n## 🌏 Regional Observations\n\n`;
    en += `**AMER (Americas):**\n${dive.regional_en.amer}\n\n`;
    en += `**EMEA (Europe, Middle East, Africa):**\n${dive.regional_en.emea}\n\n`;
    en += `**APAC (Asia Pacific):**\n${dive.regional_en.apac}\n\n`;
    en += `</div>\n\n`;
  }

  en += `</div>\n`;

  return `${frontmatter}\n${ko}${en}`;
}

function escapeYaml(str) {
  if (!str) return '';
  return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

// ── Main ──
async function main() {
  console.log('📖 AI Trend Hub — Monthly Deep Dive Generator v1.0');
  console.log('===================================================\n');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const forceFlag = args.includes('--force');

  let monthStr;
  const monthArg = args.find(a => a.startsWith('--month='));
  if (monthArg) {
    monthStr = monthArg.split('=')[1];
  } else {
    // Default: previous month
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    monthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
  }

  console.log(`📅 Generating deep dive for: ${monthStr}`);

  const outputPath = path.join(MONTHLY_DIR, `${monthStr}.md`);
  if (fs.existsSync(outputPath) && !forceFlag) {
    console.log(`⚠️  ${monthStr}.md already exists. Use --force to overwrite.`);
    process.exit(0);
  }

  // Load content
  const articles = loadMonthlyArticles(monthStr);
  const weeklyDigests = loadWeeklyDigests(monthStr);

  console.log(`📄 Found ${articles.length} daily articles`);
  console.log(`📊 Found ${weeklyDigests.length} weekly digests\n`);

  if (articles.length === 0) {
    console.log('⚠️  No articles found for this month. Skipping generation.');
    process.exit(0);
  }

  if (articles.length < 5) {
    console.log(`⚠️  Only ${articles.length} articles. Need at least 5 for a meaningful deep dive.`);
    process.exit(0);
  }

  // Generate with Claude
  console.log(`🤖 Calling Claude API (${MODEL})...`);
  const client = new Anthropic();

  const deepDive = await generateMonthlyDeepDive(client, articles, weeklyDigests, monthStr);
  console.log('✅ Deep dive generated successfully\n');

  // date_published = last day of the month
  const [year, month] = monthStr.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const datePublished = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

  // Build markdown
  const markdown = buildMonthlyMarkdown(deepDive, monthStr, datePublished);

  if (!fs.existsSync(MONTHLY_DIR)) {
    fs.mkdirSync(MONTHLY_DIR, { recursive: true });
  }

  fs.writeFileSync(outputPath, markdown, 'utf-8');

  console.log(`📖 Monthly Deep Dive Summary:`);
  console.log(`   Title (KO): ${deepDive.title_ko}`);
  console.log(`   Title (EN): ${deepDive.title_en}`);
  console.log(`   Reports: ${deepDive.reports_ko.length}`);
  console.log(`   Action Items: ${deepDive.action_items_ko.length}`);
  console.log(`\n💾 Saved to: content/monthly/${monthStr}.md`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
