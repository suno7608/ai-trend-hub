/**
 * Monthly Deep Dive — 7-Stage Analysis Pipeline
 * Orchestrates all stages with retry logic and fallback
 */

const Anthropic = require('@anthropic-ai/sdk');
const prompts = require('./prompts');

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
const MAX_RETRIES = 3;

// ── Retry-aware Claude call ───────────────────────────────
async function callClaude(client, systemPrompt, userPrompt, maxTokens = 8000, stageName = '') {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      });
      const text = response.content[0].text.trim();
      const json = parseJSON(text);
      return json;
    } catch (err) {
      console.warn(`  ⚠️  ${stageName} attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        await sleep(attempt * 2000); // exponential backoff: 2s, 4s
      } else {
        throw err;
      }
    }
  }
}

function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Could not parse JSON from Claude response');
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Stage 1: Data Enrichment ──────────────────────────────
async function runStage1(client, articles, monthStr) {
  console.log('  📊 Stage 1: Enriching articles...');
  // Process in batches of 20 to avoid token limits
  const BATCH = 20;
  const enriched = [];
  for (let i = 0; i < articles.length; i += BATCH) {
    const batch = articles.slice(i, i + BATCH);
    const result = await callClaude(
      client,
      prompts.STAGE1_SYSTEM,
      prompts.stage1User(batch, monthStr),
      6000,
      'Stage1'
    );
    const batchEnriched = result.enriched_articles || [];
    // Merge enrichment data back into original articles
    batchEnriched.forEach((e, j) => {
      const orig = batch[j] || {};
      enriched.push({ ...orig, ...e, index: i + j + 1 });
    });
    if (i + BATCH < articles.length) await sleep(1000);
  }
  console.log(`  ✅ Stage 1 complete: ${enriched.length} articles enriched`);
  return enriched;
}

// ── Stage 2: Theme Clustering ─────────────────────────────
async function runStage2(client, enrichedArticles, monthStr) {
  console.log('  🎯 Stage 2: Clustering themes...');
  const result = await callClaude(
    client,
    prompts.STAGE2_SYSTEM,
    prompts.stage2User(enrichedArticles, monthStr),
    6000,
    'Stage2'
  );
  const themes = result.macro_themes || [];
  console.log(`  ✅ Stage 2 complete: ${themes.length} macro themes identified`);
  return { themes, convergence_ko: result.theme_convergence_ko, convergence_en: result.theme_convergence_en };
}

// ── Stage 3: Deep Analysis per Theme ─────────────────────
async function runStage3(client, themes, enrichedArticles, allArticles) {
  console.log(`  🔬 Stage 3: Deep analysis for ${themes.length} themes...`);
  const analyses = [];
  for (const theme of themes) {
    const indices = theme.article_indices || [];
    // Map theme article indices to actual articles
    const themeArticles = indices.map(idx => {
      const enriched = enrichedArticles[idx - 1];
      const orig = allArticles[idx - 1] || {};
      return enriched ? { ...orig, ...enriched } : orig;
    }).filter(Boolean);

    const analysis = await callClaude(
      client,
      prompts.STAGE3_SYSTEM,
      prompts.stage3User(theme, themeArticles, allArticles),
      8000,
      `Stage3-${theme.theme_id}`
    );
    analyses.push({ ...analysis, theme_id: theme.theme_id });
    await sleep(1000);
  }
  console.log(`  ✅ Stage 3 complete: ${analyses.length} theme analyses`);
  return analyses;
}

// ── Stage 4: Cross-Trend Synthesis ───────────────────────
async function runStage4(client, themes, themeAnalyses, monthStr) {
  console.log('  🔗 Stage 4: Cross-trend synthesis...');
  const result = await callClaude(
    client,
    prompts.STAGE4_SYSTEM,
    prompts.stage4User(themes, themeAnalyses, monthStr),
    6000,
    'Stage4'
  );
  console.log('  ✅ Stage 4 complete');
  return result;
}

// ── Stage 5: Strategic Frameworks ────────────────────────
async function runStage5(client, themes, synthesis, themeAnalyses) {
  console.log('  📐 Stage 5: Strategic frameworks...');
  const result = await callClaude(
    client,
    prompts.STAGE5_SYSTEM,
    prompts.stage5User(themes, synthesis, themeAnalyses),
    8000,
    'Stage5'
  );
  console.log('  ✅ Stage 5 complete');
  return result;
}

// ── Stage 6: Executive Brief ──────────────────────────────
async function runStage6(client, themes, synthesis, frameworks, monthStr, articleCount) {
  console.log('  📋 Stage 6: Executive brief...');
  const result = await callClaude(
    client,
    prompts.STAGE6_SYSTEM,
    prompts.stage6User(themes, synthesis, frameworks, monthStr, articleCount),
    4000,
    'Stage6'
  );
  console.log('  ✅ Stage 6 complete');
  return result;
}

// ── Stage 7: Chart Data ───────────────────────────────────
async function runStage7(client, themes, enrichedArticles, themeAnalyses, monthStr) {
  console.log('  📊 Stage 7: Chart data preparation...');
  const result = await callClaude(
    client,
    prompts.STAGE7_SYSTEM,
    prompts.stage7User(themes, enrichedArticles, themeAnalyses, monthStr),
    4000,
    'Stage7'
  );
  console.log('  ✅ Stage 7 complete');
  return result;
}

// ── Main Pipeline Runner ──────────────────────────────────
async function runPipeline(articles, weeklyDigests, monthStr) {
  const client = new Anthropic();
  const startTime = Date.now();

  console.log(`\n🚀 Enhanced Monthly Deep Dive Pipeline — ${monthStr}`);
  console.log(`   Articles: ${articles.length} | Weekly digests: ${weeklyDigests.length}`);
  console.log('─'.repeat(60));

  try {
    // Stage 1
    const enrichedArticles = await runStage1(client, articles, monthStr);
    await sleep(1500);

    // Stage 2
    const { themes, convergence_ko, convergence_en } = await runStage2(client, enrichedArticles, monthStr);
    await sleep(1500);

    // Stage 3
    const themeAnalyses = await runStage3(client, themes, enrichedArticles, articles);
    await sleep(1500);

    // Stage 4
    const synthesis = await runStage4(client, themes, themeAnalyses, monthStr);
    await sleep(1500);

    // Stage 5
    const frameworks = await runStage5(client, themes, synthesis, themeAnalyses);
    await sleep(1500);

    // Stage 6
    const executiveBrief = await runStage6(client, themes, synthesis, frameworks, monthStr, articles.length);
    await sleep(1500);

    // Stage 7
    const chartData = await runStage7(client, themes, enrichedArticles, themeAnalyses, monthStr);

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n✅ Pipeline complete in ${elapsed}s`);

    return {
      enrichedArticles,
      themes,
      convergence_ko,
      convergence_en,
      themeAnalyses,
      synthesis,
      frameworks,
      executiveBrief,
      chartData,
      elapsed
    };

  } catch (err) {
    console.error(`\n❌ Pipeline failed: ${err.message}`);
    throw err;
  }
}

module.exports = { runPipeline };
