/**
 * Monthly Deep Dive — 7-Stage Analysis Pipeline v2.1
 * Orchestrates all stages with retry logic and fallback
 *
 * v2.1 changes:
 * - Stage 1 (Data Enrichment): replaced Claude API call with local passthrough
 *   using pre-indexed metadata from summarize.js v2.0 (zero API cost)
 * - Stage 7 (Chart Data): replaced Claude API call with local JS computation
 *   (zero API cost, deterministic output)
 * - Net result: 5 Claude API calls instead of 9 per monthly run (~45% reduction)
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

// ── Stage 1: Data Enrichment (LOCAL — no API call) ───────
// Uses pre-indexed metadata written by summarize.js v2.0.
// Falls back gracefully for older articles that lack these fields.
function runStage1Local(articles) {
  console.log('  📊 Stage 1: Loading pre-indexed metadata (no API call)...');

  // Fallback: infer strategic_theme from categories for pre-v2.0 articles
  const THEME_FROM_CATEGORY = {
    agentic_commerce: 'AI_AGENT',
    commerce:         'AI_COMMERCE',
    marketing:        'AI_MARKETING',
    ai_marketing:     'AI_MARKETING',
    strategy:         'DATA_STRATEGY',
    tech:             'EMERGING_TECH',
  };

  const enriched = articles.map((a, i) => {
    const theme = a.strategic_theme ||
      (a.categories || []).reduce((t, c) => THEME_FROM_CATEGORY[c] || t, 'EMERGING_TECH');

    // Normalize regions (old articles stored lowercase 'global')
    const regions = (a.regions || ['GLOBAL']).map(r => r.toUpperCase());

    return {
      ...a,
      index: i + 1,
      strategic_theme: theme,
      regions,
      business_impact: a.business_impact || 'MEDIUM',
      sentiment: a.sentiment || 'NEUTRAL',
      key_entities: a.key_entities || [],
      one_line_insight_ko: a.one_line_insight_ko || a.so_what_ko || '',
      one_line_insight_en: a.one_line_insight_en || a.so_what_en || '',
    };
  });

  // Log how many articles had pre-indexed vs inferred data
  const preIndexed = articles.filter(a => a.strategic_theme).length;
  const inferred   = articles.length - preIndexed;
  console.log(`  ✅ Stage 1 complete: ${enriched.length} articles ready`);
  console.log(`     (${preIndexed} pre-indexed by summarize.js, ${inferred} inferred from categories)`);
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

// ── Stage 7: Chart Data (LOCAL — no API call) ────────────
// Computes all 6 chart datasets from pre-indexed metadata.
// Deterministic, instant, zero token cost.
function runStage7Local(themes, enrichedArticles) {
  console.log('  📊 Stage 7: Computing chart data locally (no API call)...');

  // ── Radar chart: theme importance + urgency scores ──
  const radarChart = {
    title_ko: '테마별 전략적 중요도',
    title_en: 'Strategic Importance by Theme',
    labels: themes.map(t => t.name_en),
    importance_scores: themes.map(t => parseFloat(t.importance_score) || 5),
    urgency_scores: themes.map(t =>
      t.urgency === 'IMMEDIATE' ? 9 : t.urgency === 'SHORT_TERM' ? 6 : 3
    ),
  };

  // ── Category (strategic_theme) distribution ──
  const categoryCount = {};
  enrichedArticles.forEach(a => {
    const theme = a.strategic_theme || 'EMERGING_TECH';
    categoryCount[theme] = (categoryCount[theme] || 0) + 1;
  });
  const sortedCats = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);

  // ── Confidence distribution (thresholds match chart labels) ──
  const confHigh   = enrichedArticles.filter(a => (a.confidence || 0) >= 0.85).length;
  const confMedium = enrichedArticles.filter(a => (a.confidence || 0) >= 0.5 && (a.confidence || 0) < 0.85).length;
  const confLow    = enrichedArticles.filter(a => (a.confidence || 0) < 0.5).length;

  // ── Regional distribution ──
  const regionCount = { GLOBAL: 0, AMER: 0, EMEA: 0, APAC: 0 };
  enrichedArticles.forEach(a => {
    (a.regions || ['GLOBAL']).forEach(r => {
      const key = r.toUpperCase();
      if (key in regionCount) regionCount[key]++;
    });
  });

  // ── Source diversity (keyword heuristic) ──
  const SOURCE_PATTERNS = {
    'Research/Analyst': ['gartner', 'forrester', 'mckinsey', 'bcg', 'idc', 'deloitte', 'accenture', 'pwc', 'kpmg', 'harvard'],
    'Tech Media':       ['techcrunch', 'wired', 'venturebeat', 'theverge', 'zdnet', 'ars technica', 'mit', 'ieee'],
    'Vendor/Brand':     ['google', 'microsoft', 'amazon', 'apple', 'meta', 'openai', 'anthropic', 'salesforce', 'adobe'],
    'News':             ['reuters', 'bloomberg', 'wsj', 'financial times', 'ft.com', 'economist', 'nytimes'],
  };
  const sourceCounts = { 'Research/Analyst': 0, 'Tech Media': 0, 'Vendor/Brand': 0, 'News': 0, 'Other': 0 };
  enrichedArticles.forEach(a => {
    const srcLower = (a.source_name || '').toLowerCase();
    let classified = false;
    for (const [type, patterns] of Object.entries(SOURCE_PATTERNS)) {
      if (patterns.some(p => srcLower.includes(p))) {
        sourceCounts[type]++;
        classified = true;
        break;
      }
    }
    if (!classified) sourceCounts['Other']++;
  });

  // ── Impact-urgency matrix ──
  const matrixPoints = themes.map(t => ({
    label:    t.name_en,
    label_ko: t.name_ko,
    importance:    parseFloat(t.importance_score) || 5,
    urgency_score: t.urgency === 'IMMEDIATE' ? 9 : t.urgency === 'SHORT_TERM' ? 6 : 3,
  }));

  console.log('  ✅ Stage 7 complete (local computation)');

  return {
    radar_chart: radarChart,
    category_bar: {
      title_ko: '카테고리별 기사 분포',
      title_en: 'Article Distribution by Category',
      labels: sortedCats.map(([k]) => k),
      values: sortedCats.map(([, v]) => v),
    },
    confidence_histogram: {
      title_ko: '기사 신뢰도 분포',
      title_en: 'Article Confidence Distribution',
      buckets: ['High (0.85+)', 'Medium (0.5~0.85)', 'Low (0.5 below)'],
      values: [confHigh, confMedium, confLow],
    },
    regional_bar: {
      title_ko: '지역별 트렌드 분포',
      title_en: 'Regional Trend Distribution',
      regions: ['GLOBAL', 'AMER', 'EMEA', 'APAC'],
      values: [regionCount.GLOBAL, regionCount.AMER, regionCount.EMEA, regionCount.APAC],
    },
    impact_matrix_data: {
      title_ko: '영향도-긴급도 매트릭스',
      title_en: 'Impact-Urgency Matrix',
      points: matrixPoints,
    },
    source_diversity: {
      title_ko: '출처 유형 분포',
      title_en: 'Source Type Distribution',
      labels: Object.keys(sourceCounts),
      values: Object.values(sourceCounts),
    },
  };
}

// ── Main Pipeline Runner ──────────────────────────────────
async function runPipeline(articles, weeklyDigests, monthStr) {
  const client = new Anthropic();
  const startTime = Date.now();

  console.log(`\n🚀 Enhanced Monthly Deep Dive Pipeline — ${monthStr}`);
  console.log(`   Articles: ${articles.length} | Weekly digests: ${weeklyDigests.length}`);
  console.log('─'.repeat(60));

  try {
    // Stage 1 — LOCAL passthrough (uses pre-indexed metadata, no API call)
    const enrichedArticles = runStage1Local(articles);
    await sleep(500);

    // Stage 2 — Claude: Theme Clustering
    const { themes, convergence_ko, convergence_en } = await runStage2(client, enrichedArticles, monthStr);
    await sleep(1500);

    // Stage 3 — Claude: Deep Analysis per Theme
    const themeAnalyses = await runStage3(client, themes, enrichedArticles, articles);
    await sleep(1500);

    // Stage 4 — Claude: Cross-Trend Synthesis
    const synthesis = await runStage4(client, themes, themeAnalyses, monthStr);
    await sleep(1500);

    // Stage 5 — Claude: Strategic Frameworks
    const frameworks = await runStage5(client, themes, synthesis, themeAnalyses);
    await sleep(1500);

    // Stage 6 — Claude: Executive Brief
    const executiveBrief = await runStage6(client, themes, synthesis, frameworks, monthStr, articles.length);
    await sleep(500);

    // Stage 7 — LOCAL computation (no API call)
    const chartData = runStage7Local(themes, enrichedArticles);

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
