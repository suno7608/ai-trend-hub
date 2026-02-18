#!/usr/bin/env node
/**
 * AI Trend Hub — Weekly Digest Generator v1.0
 * Reads past week's daily content → calls Claude API → generates Weekly Digest markdown
 *
 * Usage: node scripts/generate-weekly.js [--week=2026-W08] [--force]
 * Requires: ANTHROPIC_API_KEY environment variable
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const Anthropic = require('@anthropic-ai/sdk');

const ROOT = path.resolve(__dirname, '..');
const DAILY_DIR = path.join(ROOT, 'content', 'daily');
const WEEKLY_DIR = path.join(ROOT, 'content', 'weekly');

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

// ── ISO Week helpers ──
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

function formatWeekString(year, week) {
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function getWeekDateRange(year, week) {
  // ISO week: Monday = day 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  const weekStart = new Date(firstMonday);
  weekStart.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  return {
    start: weekStart.toISOString().slice(0, 10),
    end: weekEnd.toISOString().slice(0, 10)
  };
}

// ── Load daily articles for a given week ──
function loadWeeklyArticles(weekStr) {
  const [yearStr, weekPart] = weekStr.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekPart);
  const { start, end } = getWeekDateRange(year, week);

  console.log(`   Date range: ${start} ~ ${end}`);

  if (!fs.existsSync(DAILY_DIR)) return [];

  const files = fs.readdirSync(DAILY_DIR).filter(f => f.endsWith('.md'));
  const articles = [];

  for (const f of files) {
    const raw = fs.readFileSync(path.join(DAILY_DIR, f), 'utf-8');
    const { data } = matter(raw);
    const pubDate = data.date_published || '';

    if (pubDate >= start && pubDate <= end) {
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

  // Sort by confidence (desc) then date (desc)
  articles.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

  return articles;
}

// ── Claude API call for Weekly Digest ──
async function generateWeeklyDigest(client, articles, weekStr) {
  const articlesSummary = articles.map((a, i) => `
[${i + 1}] ${a.title}
- Source: ${a.source_name} | Date: ${a.date_published} | Confidence: ${a.confidence}
- Categories: ${a.categories.join(', ')}
- Tags: ${a.tags.join(', ')}
- Summary (KO): ${a.summary_ko}
- Summary (EN): ${a.summary_en}
- So What (KO): ${a.so_what_ko}
- So What (EN): ${a.so_what_en}
- Key Points: ${a.key_points.join('; ')}
- URL: ${a.canonical_url}
`).join('\n---\n');

  const systemPrompt = `You are the editor of "LG AI Trend Hub", a trend intelligence platform for LG's Global D2C organization.

Your task: Create a Weekly Digest that synthesizes the week's most important AI Commerce & Marketing trends into 5 key themes.

OUTPUT FORMAT: Return ONLY a valid JSON object with this exact structure:
{
  "title_ko": "Weekly Digest ${weekStr}: [핵심 테마 한국어]",
  "title_en": "Weekly Digest ${weekStr}: [Core Theme English]",
  "top_trends": ["트렌드1", "트렌드2", "트렌드3", "트렌드4", "트렌드5"],
  "top_keywords": ["keyword1", "keyword2", ...up to 10],
  "trends_ko": [
    {
      "title": "트렌드 제목",
      "analysis": "3-5 sentences of analysis in Korean. Include specific data points from the articles.",
      "sources": [{"title": "Article Title", "url": "https://..."}],
      "so_what": "1-2 actionable sentences for D2C perspective in Korean"
    }
  ],
  "trends_en": [
    {
      "title": "Trend title in English",
      "analysis": "3-5 sentences of analysis in English. Include specific data points.",
      "sources": [{"title": "Article Title", "url": "https://..."}],
      "so_what": "1-2 actionable sentences for D2C perspective in English"
    }
  ],
  "risks_opportunities_ko": [
    {"type": "risk", "title": "리스크 제목", "description": "설명"},
    {"type": "opportunity", "title": "기회 제목", "description": "설명"},
    {"type": "observation", "title": "관찰 제목", "description": "설명"}
  ],
  "risks_opportunities_en": [
    {"type": "risk", "title": "Risk title", "description": "description"},
    {"type": "opportunity", "title": "Opportunity title", "description": "description"},
    {"type": "observation", "title": "Observation title", "description": "description"}
  ]
}

RULES:
- Identify TOP 5 trends by grouping related articles into themes
- Each trend MUST reference at least 1 actual article from the input
- sources must use REAL URLs from the input articles - NEVER fabricate URLs
- analysis should synthesize multiple articles when possible
- so_what must be actionable and specific to D2C business
- Write in professional but accessible tone
- NEVER fabricate statistics or quotes not present in source articles
- Return ONLY valid JSON, no markdown code blocks`;

  const userPrompt = `Here are ${articles.length} articles from week ${weekStr}. Create the Weekly Digest.

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

// ── Build Weekly Markdown ──
function buildWeeklyMarkdown(digest, weekStr, datePublished) {
  // Frontmatter
  const frontmatter = [
    '---',
    `week: "${weekStr}"`,
    `date_published: "${datePublished}"`,
    `title: "${escapeYaml(digest.title_ko)}"`,
    `title_en: "${escapeYaml(digest.title_en)}"`,
    `top_trends:`,
    ...digest.top_trends.map(t => `  - "${escapeYaml(t)}"`),
    `top_keywords:`,
    ...digest.top_keywords.map(k => `  - "${k}"`),
    '---'
  ].join('\n');

  // Korean content
  let koContent = '\n<div class="lang-ko">\n\n## 🏆 이번 주 Top 5 트렌드\n';

  digest.trends_ko.forEach((trend, i) => {
    koContent += `\n<div class="trend-box">\n\n### ${i + 1}. ${trend.title}\n\n`;
    koContent += `${trend.analysis}\n\n`;
    koContent += `**근거:**\n`;
    trend.sources.forEach(s => {
      koContent += `- [${s.title}](${s.url})\n`;
    });
    koContent += `\n**💡 So What for D2C:** ${trend.so_what}\n\n</div>\n`;
  });

  koContent += '\n<div class="risk-opportunity-box">\n\n## 📈 이번 주 관찰: 리스크와 기회\n\n';
  digest.risks_opportunities_ko.forEach((item, i) => {
    const prefix = item.type === 'risk' ? '리스크' : item.type === 'opportunity' ? '기회' : '관찰';
    koContent += `${i + 1}. **${prefix} — ${item.title}**: ${item.description}\n\n`;
  });
  koContent += '</div>\n\n</div>\n';

  // English content
  let enContent = '\n<div class="lang-en" style="display:none">\n\n## 🏆 This Week\'s Top 5 Trends\n';

  digest.trends_en.forEach((trend, i) => {
    enContent += `\n<div class="trend-box">\n\n### ${i + 1}. ${trend.title}\n\n`;
    enContent += `${trend.analysis}\n\n`;
    enContent += `**Sources:**\n`;
    trend.sources.forEach(s => {
      enContent += `- [${s.title}](${s.url})\n`;
    });
    enContent += `\n**💡 So What for D2C:** ${trend.so_what}\n\n</div>\n`;
  });

  enContent += '\n<div class="risk-opportunity-box">\n\n## 📈 This Week\'s Observations: Risks & Opportunities\n\n';
  digest.risks_opportunities_en.forEach((item, i) => {
    const prefix = item.type === 'risk' ? 'Risk' : item.type === 'opportunity' ? 'Opportunity' : 'Observation';
    enContent += `${i + 1}. **${prefix} — ${item.title}**: ${item.description}\n\n`;
  });
  enContent += '</div>\n\n</div>\n';

  return `${frontmatter}\n${koContent}${enContent}`;
}

function escapeYaml(str) {
  if (!str) return '';
  return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

// ── Main ──
async function main() {
  console.log('📊 AI Trend Hub — Weekly Digest Generator v1.0');
  console.log('================================================\n');

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set');
    process.exit(1);
  }

  // Parse arguments
  const args = process.argv.slice(2);
  const forceFlag = args.includes('--force');

  let weekStr;
  const weekArg = args.find(a => a.startsWith('--week='));
  if (weekArg) {
    weekStr = weekArg.split('=')[1];
  } else {
    // Default: previous week
    const now = new Date();
    const lastWeek = new Date(now);
    lastWeek.setDate(now.getDate() - 7);
    const { year, week } = getISOWeek(lastWeek);
    weekStr = formatWeekString(year, week);
  }

  console.log(`📅 Generating digest for: ${weekStr}`);

  // Check if already exists
  const outputPath = path.join(WEEKLY_DIR, `${weekStr}.md`);
  if (fs.existsSync(outputPath) && !forceFlag) {
    console.log(`⚠️  ${weekStr}.md already exists. Use --force to overwrite.`);
    process.exit(0);
  }

  // Load articles
  const articles = loadWeeklyArticles(weekStr);
  console.log(`📄 Found ${articles.length} articles for this week\n`);

  if (articles.length === 0) {
    console.log('⚠️  No articles found for this week. Skipping digest generation.');
    process.exit(0);
  }

  if (articles.length < 3) {
    console.log(`⚠️  Only ${articles.length} articles found. Need at least 3 for a meaningful digest.`);
    console.log('   Skipping generation. Collect more content first.');
    process.exit(0);
  }

  // Generate with Claude
  console.log(`🤖 Calling Claude API (${MODEL})...`);
  const client = new Anthropic();

  const digest = await generateWeeklyDigest(client, articles, weekStr);
  console.log('✅ Digest generated successfully\n');

  // Calculate date_published (Sunday of the week)
  const [yearStr, weekPart] = weekStr.split('-W');
  const { end } = getWeekDateRange(parseInt(yearStr), parseInt(weekPart));

  // Build markdown
  const markdown = buildWeeklyMarkdown(digest, weekStr, end);

  // Ensure directory
  if (!fs.existsSync(WEEKLY_DIR)) {
    fs.mkdirSync(WEEKLY_DIR, { recursive: true });
  }

  // Write file
  fs.writeFileSync(outputPath, markdown, 'utf-8');

  console.log(`📊 Weekly Digest Summary:`);
  console.log(`   Title (KO): ${digest.title_ko}`);
  console.log(`   Title (EN): ${digest.title_en}`);
  console.log(`   Trends: ${digest.top_trends.length}`);
  console.log(`   Keywords: ${digest.top_keywords.join(', ')}`);
  console.log(`\n💾 Saved to: content/weekly/${weekStr}.md`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
