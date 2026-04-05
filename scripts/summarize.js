#!/usr/bin/env node
/**
 * AI Trend Hub — AI Summarizer v1.0
 * Reads collected_raw.json → calls Claude API → outputs summarized.json
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 * Usage: node scripts/summarize.js
 */

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const ROOT = path.resolve(__dirname, '..');
const INPUT_PATH = path.join(ROOT, 'data', 'collected_raw.json');
const OUTPUT_PATH = path.join(ROOT, 'data', 'summarized.json');

const BATCH_SIZE = 5;
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `You are an AI editor for the "LG AI Trend Hub", a trend intelligence platform for the Global D2C (Direct-to-Consumer) organization at LG.

Your task: Analyze news articles about AI Commerce, AI Marketing, and AI Technology, then produce structured summaries.

STRICT RULES:
- NEVER fabricate facts, statistics, or quotes not in the source
- If uncertain, say "원문에서 확인되지 않음"
- summary_ko: exactly 3 Korean sentences, max 400 chars
- summary_en: exactly 3 English sentences, max 400 chars
- so_what_ko/en: 1-2 actionable sentences for D2C business perspective
- key_points: 2-4 bullet points
- tags: 3-5 lowercase hyphenated tags relevant to the article
- categories: from ["commerce", "marketing", "tech", "strategy", "agentic_commerce", "ai_marketing"]
- relevance_score: 0.0-1.0 indicating how relevant the article is to AI Marketing or Agentic Commerce (flag articles below 0.5)
- confidence: 0.5-1.0 based on source quality and content depth

Return ONLY valid JSON array, no markdown code blocks.`;

function buildUserPrompt(articles) {
  const items = articles.map((a, i) => `
[Article ${i + 1}]
Title: ${a.title}
Source: ${a.source_name} (${a.source_id})
URL: ${a.link}
Date: ${a.date_published}
Categories hint: ${(a.categories || []).join(', ')}
Description/Excerpt:
${a.description || '(no description available)'}
`).join('\n---\n');

  return `Analyze these ${articles.length} articles and return a JSON array with one object per article.

Each object must have:
{
  "index": 0,
  "summary_ko": "한국어 3문장 요약",
  "summary_en": "English 3-sentence summary",
  "so_what_ko": "D2C 관점 시사점 (한국어)",
  "so_what_en": "D2C implications (English)",
  "key_points": ["point1", "point2", "point3"],
  "categories": ["commerce"],
  "tags": ["tag1", "tag2", "tag3"],
  "relevance_score": 0.8,
  "confidence": 0.8
}

${items}

Return ONLY a valid JSON array. No extra text or markdown.`;
}

async function summarizeBatch(client, articles) {
  const prompt = buildUserPrompt(articles);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text.trim();
    // Try to extract JSON from response
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      // Try extracting JSON array from markdown code block
      const match = text.match(/\[[\s\S]*\]/);
      if (match) json = JSON.parse(match[0]);
      else throw new Error('Could not parse JSON from response');
    }

    if (!Array.isArray(json)) throw new Error('Response is not a JSON array');

    // Merge AI results with original article data
    return articles.map((article, i) => {
      const ai = json[i] || json.find(r => r.index === i) || {};
      return {
        ...article,
        summary_ko: ai.summary_ko || '',
        summary_en: ai.summary_en || '',
        so_what_ko: ai.so_what_ko || '',
        so_what_en: ai.so_what_en || '',
        key_points: ai.key_points || [],
        categories: ai.categories || article.categories || ['tech'],
        tags: ai.tags || [],
        relevance_score: ai.relevance_score ?? 0.5,
        confidence: ai.confidence || 0.5,
        ai_processed: true,
      };
    });
  } catch (error) {
    console.error(`   ❌ API Error: ${error.message}`);
    // Return articles with empty AI fields (for manual review)
    return articles.map(article => ({
      ...article,
      summary_ko: '',
      summary_en: '',
      so_what_ko: '',
      so_what_en: '',
      key_points: [],
      categories: article.categories || ['tech'],
      tags: [],
      relevance_score: 0.0,
      confidence: 0.0,
      ai_processed: false,
      ai_error: error.message,
    }));
  }
}

async function main() {
  console.log('🤖 AI Trend Hub — AI Summarizer v1.0');
  console.log('=====================================\n');

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY environment variable not set');
    console.error('   Set it: export ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  // Load collected articles
  if (!fs.existsSync(INPUT_PATH)) {
    console.log('⚠️  No collected_raw.json found. Run collect.js first.');
    process.exit(0);
  }

  const articles = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8'));
  if (articles.length === 0) {
    console.log('⚠️  No articles to summarize.');
    process.exit(0);
  }

  console.log(`📄 ${articles.length} articles to process`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   Batch size: ${BATCH_SIZE}\n`);

  const client = new Anthropic();
  const results = [];

  // Process in batches
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(articles.length / BATCH_SIZE);

    console.log(`  🔄 Batch ${batchNum}/${totalBatches} (${batch.length} articles)...`);

    const processed = await summarizeBatch(client, batch);
    results.push(...processed);

    const success = processed.filter(r => r.ai_processed).length;
    const failed = processed.filter(r => !r.ai_processed).length;
    console.log(`     ✅ ${success} success, ${failed > 0 ? '❌ ' + failed + ' failed' : '0 failed'}`);

    // Rate limiting: wait between batches
    if (i + BATCH_SIZE < articles.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Save results
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));

  // ── Archive: append to daily JSONL file (never overwrite) ──
  const archiveDir = path.join(path.resolve(__dirname, '..'), 'data', 'archive');
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const archivePath = path.join(archiveDir, `summarized_${today}.jsonl`);
  const lines = results.map(item => JSON.stringify(item)).join('\n') + '\n';
  fs.appendFileSync(archivePath, lines);

  const successCount = results.filter(r => r.ai_processed).length;
  const failCount = results.filter(r => !r.ai_processed).length;

  console.log(`\n📊 Summary:`);
  console.log(`   Processed: ${successCount}/${results.length}`);
  if (failCount > 0) console.log(`   Failed: ${failCount} (saved with confidence: 0.0)`);
  console.log(`\n💾 Saved to data/summarized.json`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
