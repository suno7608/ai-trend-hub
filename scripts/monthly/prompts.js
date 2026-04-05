/**
 * Monthly Deep Dive — Centralized Claude Prompts
 * All 7-stage prompts in one place for easy tuning
 */

const SYSTEM_BASE = `You are a senior partner at a top-tier management consultancy (BCG/McKinsey caliber), specializing in AI, Commerce, and Digital Strategy. You are producing strategic intelligence for LG Electronics' Global D2C (Direct-to-Consumer) organization.

Your analysis must be:
- Data-driven: cite specific articles, numbers, and evidence from the input
- Strategic: connect trends to business implications for LG D2C
- Actionable: every insight should lead to a clear business decision
- Executive-grade: written for C-level and VP-level audience
- Bilingual: all narrative content in both Korean and English

NEVER fabricate statistics, quotes, or URLs not present in the source data.
Return ONLY valid JSON unless instructed otherwise.`;

// ── Stage 1: Data Enrichment ──────────────────────────────
const STAGE1_SYSTEM = SYSTEM_BASE;

function stage1User(articles, monthStr) {
  const articleList = articles.map((a, i) => `[${i+1}] ${a.title}
Source: ${a.source_name} | Date: ${a.date_published} | Confidence: ${a.confidence}
Categories: ${(a.categories||[]).join(', ')} | Tags: ${(a.tags||[]).join(', ')}
Summary (KO): ${a.summary_ko || ''}
Summary (EN): ${a.summary_en || ''}
So What (KO): ${a.so_what_ko || ''}
URL: ${a.canonical_url || ''}`).join('\n---\n');

  return `Analyze these ${articles.length} articles from ${monthStr} and enrich each with strategic metadata.

For each article, extract:
1. Primary strategic theme (choose ONE: AI_AGENT | AI_COMMERCE | AI_MARKETING | AI_PERSONALIZATION | RETAIL_TRANSFORMATION | DATA_STRATEGY | COMPETITIVE_DYNAMICS | CUSTOMER_EXPERIENCE | PLATFORM_ECOSYSTEM | EMERGING_TECH)
2. Geographic relevance: GLOBAL | AMER | EMEA | APAC (can be multiple)
3. Business impact level: HIGH | MEDIUM | LOW (for LG D2C)
4. Sentiment: OPPORTUNITY | THREAT | NEUTRAL
5. Key entities mentioned (companies, products, technologies)

Return JSON:
{
  "enriched_articles": [
    {
      "index": 1,
      "title": "...",
      "strategic_theme": "AI_AGENT",
      "regions": ["GLOBAL"],
      "business_impact": "HIGH",
      "sentiment": "OPPORTUNITY",
      "key_entities": ["OpenAI", "ChatGPT"],
      "one_line_insight_ko": "한국어 한 줄 인사이트",
      "one_line_insight_en": "English one-line insight"
    }
  ]
}

Articles:
${articleList}`;
}

// ── Stage 2: Theme Clustering ─────────────────────────────
const STAGE2_SYSTEM = SYSTEM_BASE;

function stage2User(enrichedArticles, monthStr) {
  const summary = enrichedArticles.map((a, i) =>
    `[${i+1}] ${a.title} | Theme: ${a.strategic_theme} | Impact: ${a.business_impact} | Sentiment: ${a.sentiment} | Entities: ${(a.key_entities||[]).join(', ')}`
  ).join('\n');

  return `Based on ${enrichedArticles.length} enriched articles from ${monthStr}, identify the 4-6 most significant MACRO THEMES for LG D2C strategy.

A macro theme is NOT a simple category — it is a strategic narrative that:
- Represents a meaningful shift in AI Commerce/Marketing landscape
- Has implications for LG's competitive position
- Is supported by multiple articles (minimum 3)
- Ranked by strategic importance to D2C electronics (not article count)

For each macro theme provide:
- A compelling strategic name (not just a category label)
- Which articles support this theme (by index number)
- Interconnections with other themes
- Strategic urgency (IMMEDIATE | SHORT_TERM | MEDIUM_TERM)

Return JSON:
{
  "macro_themes": [
    {
      "theme_id": "T1",
      "name_ko": "전략적 테마명 (한국어)",
      "name_en": "Strategic Theme Name (English)",
      "tagline_ko": "한 줄 설명",
      "tagline_en": "One-line description",
      "importance_score": 9.2,
      "urgency": "IMMEDIATE",
      "article_indices": [1, 3, 7, 12],
      "interconnections": ["T2", "T3"],
      "strategic_rationale_ko": "이 테마가 LG D2C에 중요한 이유 (2-3문장)",
      "strategic_rationale_en": "Why this theme matters for LG D2C (2-3 sentences)"
    }
  ],
  "theme_convergence_ko": "테마 간 수렴 패턴 설명 (2-3문장)",
  "theme_convergence_en": "Convergence pattern description (2-3 sentences)"
}

Enriched articles:
${summary}`;
}

// ── Stage 3: Deep Analysis per Theme ─────────────────────
const STAGE3_SYSTEM = SYSTEM_BASE;

function stage3User(theme, themeArticles, allArticles) {
  const articleDetail = themeArticles.map((a, i) => `[${i+1}] ${a.title}
Summary: ${a.summary_ko || a.summary_en || ''}
So What: ${a.so_what_ko || a.so_what_en || ''}
URL: ${a.canonical_url || ''}`).join('\n---\n');

  return `Produce a BCG/McKinsey-grade deep analysis for this macro theme:

THEME: "${theme.name_en}" (${theme.name_ko})
Tagline: ${theme.tagline_en}
Strategic Rationale: ${theme.strategic_rationale_en}
Urgency: ${theme.urgency}

Supporting articles (${themeArticles.length}):
${articleDetail}

Generate a comprehensive strategic analysis. Return JSON:
{
  "theme_id": "${theme.theme_id}",
  "trend_narrative_ko": "트렌드 서술 (400-600자, 컨설팅 보고서 스타일)",
  "trend_narrative_en": "Trend narrative (300-500 words, consulting report style)",
  "evidence_chain": [
    {
      "point_ko": "근거 포인트",
      "point_en": "Evidence point",
      "source_title": "Article title",
      "source_url": "https://..."
    }
  ],
  "impact_assessment": {
    "level": "HIGH",
    "rationale_ko": "영향 평가 근거",
    "rationale_en": "Impact rationale",
    "time_horizon": "6-12개월 / 6-12 months"
  },
  "competitive_implications_ko": "LG vs 경쟁사 관점 분석 (삼성, 소니, 애플 등)",
  "competitive_implications_en": "LG vs competitors analysis (Samsung, Sony, Apple, etc.)",
  "d2c_so_what_ko": "LG D2C 조직이 취해야 할 행동 (구체적, 실행 가능)",
  "d2c_so_what_en": "What LG D2C should do (specific, actionable)",
  "case_studies": [
    {
      "company": "Company name",
      "action": "What they did",
      "result": "Outcome",
      "source_url": "https://..."
    }
  ],
  "key_metrics": ["관련 수치나 통계 (출처 기반만)", "metric from source"]
}`;
}

// ── Stage 4: Cross-Trend Synthesis ───────────────────────
const STAGE4_SYSTEM = SYSTEM_BASE;

function stage4User(themes, themeAnalyses, monthStr) {
  const themesSummary = themes.map(t =>
    `${t.theme_id}: ${t.name_en} (Importance: ${t.importance_score}, Urgency: ${t.urgency})`
  ).join('\n');

  const analysesSummary = themeAnalyses.map(a =>
    `${a.theme_id}:
- D2C So What: ${a.d2c_so_what_en}
- Impact: ${a.impact_assessment?.level} | ${a.impact_assessment?.rationale_en}
- Competitive: ${a.competitive_implications_en?.substring(0, 200)}...`
  ).join('\n\n');

  return `You have completed deep analysis of ${themes.length} macro themes for ${monthStr}.
Now synthesize across ALL themes to find meta-patterns and strategic convergences.

THEMES OVERVIEW:
${themesSummary}

THEME ANALYSES SUMMARY:
${analysesSummary}

Produce a cross-theme synthesis. Return JSON:
{
  "meta_narrative_ko": "이달의 전체 AI 트렌드를 관통하는 핵심 메시지 (3-4문장, 임원 보고서 수준)",
  "meta_narrative_en": "The overarching strategic narrative for this month's AI trends (3-4 sentences)",
  "reinforcing_pairs": [
    {
      "theme_a": "T1",
      "theme_b": "T2",
      "synergy_ko": "두 테마가 서로를 어떻게 강화하는가",
      "synergy_en": "How these themes reinforce each other"
    }
  ],
  "tension_pairs": [
    {
      "theme_a": "T3",
      "theme_b": "T4",
      "tension_ko": "두 테마 간 긴장 또는 갈등 요소",
      "tension_en": "Tension or conflict between these themes"
    }
  ],
  "emerging_convergence_ko": "여러 테마가 수렴하여 만들어내는 새로운 트렌드 또는 기회",
  "emerging_convergence_en": "New trends or opportunities emerging from theme convergence",
  "lg_d2c_strategic_position_ko": "이 트렌드 지형에서 LG D2C의 전략적 포지셔닝 평가",
  "lg_d2c_strategic_position_en": "Assessment of LG D2C's strategic positioning in this trend landscape"
}`;
}

// ── Stage 5: Strategic Frameworks ────────────────────────
const STAGE5_SYSTEM = SYSTEM_BASE;

function stage5User(themes, synthesis, themeAnalyses) {
  const context = themes.map(t => {
    const analysis = themeAnalyses.find(a => a.theme_id === t.theme_id) || {};
    return `${t.theme_id}: ${t.name_en}
- Importance: ${t.importance_score}/10 | Urgency: ${t.urgency}
- Impact Level: ${analysis.impact_assessment?.level || 'N/A'}
- D2C Action: ${analysis.d2c_so_what_en?.substring(0, 150) || ''}`;
  }).join('\n\n');

  return `Based on the macro themes and synthesis analysis, generate BCG/McKinsey-style strategic frameworks for LG D2C.

THEMES & ANALYSIS:
${context}

META-NARRATIVE: ${synthesis.meta_narrative_en}

Generate strategic frameworks. Return JSON:
{
  "impact_urgency_matrix": {
    "description_ko": "이 매트릭스 해석 방법",
    "description_en": "How to interpret this matrix",
    "quadrants": {
      "high_impact_high_urgency": {
        "label_ko": "즉시 행동 (Act Now)",
        "label_en": "Act Now",
        "themes": ["T1", "T2"],
        "recommendation_ko": "즉각적 투자 및 실행 권고",
        "recommendation_en": "Immediate investment and action required"
      },
      "high_impact_low_urgency": {
        "label_ko": "전략적 투자 (Invest Strategically)",
        "label_en": "Invest Strategically",
        "themes": [],
        "recommendation_ko": "",
        "recommendation_en": ""
      },
      "low_impact_high_urgency": {
        "label_ko": "모니터링 (Monitor & Adapt)",
        "label_en": "Monitor & Adapt",
        "themes": [],
        "recommendation_ko": "",
        "recommendation_en": ""
      },
      "low_impact_low_urgency": {
        "label_ko": "관찰 (Watch)",
        "label_en": "Watch",
        "themes": [],
        "recommendation_ko": "",
        "recommendation_en": ""
      }
    }
  },
  "action_roadmap": {
    "immediate": {
      "label_ko": "즉시 (0-30일)",
      "label_en": "Immediate (0-30 days)",
      "actions": [
        {
          "action_ko": "구체적 액션",
          "action_en": "Specific action",
          "owner": "Commerce/Marketing/IT/Data/CRM/Strategy",
          "kpi_ko": "측정 지표",
          "kpi_en": "KPI",
          "related_theme": "T1"
        }
      ]
    },
    "short_term": {
      "label_ko": "단기 (1-3개월)",
      "label_en": "Short-term (1-3 months)",
      "actions": []
    },
    "medium_term": {
      "label_ko": "중기 (3-6개월)",
      "label_en": "Medium-term (3-6 months)",
      "actions": []
    }
  }
}`;
}

// ── Stage 6: Executive Brief ──────────────────────────────
const STAGE6_SYSTEM = SYSTEM_BASE;

function stage6User(themes, synthesis, frameworks, monthStr, articleCount) {
  const [year, month] = monthStr.split('-');
  const monthNamesKo = ['','1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const monthNamesEn = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

  return `Create a C-level executive brief for ${year}년 ${monthNamesKo[parseInt(month)]} (${monthNamesEn[parseInt(month)]} ${year}) AI Trend Monthly Deep Dive.

This brief must be readable in under 2 minutes and stand alone without the full report.

INPUT CONTEXT:
- Total articles analyzed: ${articleCount}
- Macro themes identified: ${themes.length}
- Meta-narrative: ${synthesis.meta_narrative_en}
- Top urgent themes: ${themes.filter(t => t.urgency === 'IMMEDIATE').map(t => t.name_en).join(', ')}
- Act Now quadrant: ${frameworks.impact_urgency_matrix?.quadrants?.high_impact_high_urgency?.themes?.join(', ') || 'TBD'}

Return JSON:
{
  "brief_title_ko": "이달의 브리핑 제목 (임팩트 있게)",
  "brief_title_en": "Monthly briefing title (impactful)",
  "month_in_one_sentence_ko": "이 달의 AI 트렌드를 한 문장으로",
  "month_in_one_sentence_en": "This month's AI trends in one sentence",
  "top3_themes": [
    {
      "rank": 1,
      "theme_ko": "테마명",
      "theme_en": "Theme name",
      "headline_ko": "헤드라인 인사이트 (1-2문장)",
      "headline_en": "Headline insight (1-2 sentences)",
      "why_it_matters_ko": "왜 중요한가 (간결하게)",
      "why_it_matters_en": "Why it matters (concisely)"
    }
  ],
  "key_metrics_dashboard": [
    {"label_ko": "분석 기사 수", "label_en": "Articles Analyzed", "value": "${articleCount}"},
    {"label_ko": "핵심 테마 수", "label_en": "Macro Themes", "value": "${themes.length}"},
    {"label_ko": "즉시 행동 항목", "label_en": "Act Now Items", "value": "TBD"}
  ],
  "top3_imperatives": [
    {
      "rank": 1,
      "imperative_ko": "전략적 명령 (What LG D2C must do)",
      "imperative_en": "Strategic imperative",
      "owner": "department",
      "deadline_ko": "기한",
      "deadline_en": "Timeline"
    }
  ],
  "quote_of_month": {
    "text": "A powerful insight quote synthesized from the month's analysis",
    "attribution": "Source or synthesized from [N] articles"
  }
}`;
}

// ── Stage 7: Chart Data ───────────────────────────────────
const STAGE7_SYSTEM = SYSTEM_BASE;

function stage7User(themes, enrichedArticles, themeAnalyses, monthStr) {
  // Build theme stats
  const themeStats = themes.map(t => ({
    id: t.theme_id,
    name_en: t.name_en,
    name_ko: t.name_ko,
    importance: t.importance_score,
    urgency: t.urgency,
    article_count: (t.article_indices || []).length
  }));

  // Category distribution
  const categoryCount = {};
  enrichedArticles.forEach(a => {
    const theme = a.strategic_theme || 'OTHER';
    categoryCount[theme] = (categoryCount[theme] || 0) + 1;
  });

  // Confidence distribution
  const confidenceBuckets = { high: 0, medium: 0, low: 0 };
  enrichedArticles.forEach(a => {
    const c = parseFloat(a.confidence) || 0;
    if (c >= 0.8) confidenceBuckets.high++;
    else if (c >= 0.5) confidenceBuckets.medium++;
    else confidenceBuckets.low++;
  });

  // Regional distribution
  const regionCount = { GLOBAL: 0, AMER: 0, EMEA: 0, APAC: 0 };
  enrichedArticles.forEach(a => {
    (a.regions || ['GLOBAL']).forEach(r => { regionCount[r] = (regionCount[r] || 0) + 1; });
  });

  return `Generate chart data for the monthly deep dive visualizations.

THEME STATISTICS:
${JSON.stringify(themeStats, null, 2)}

CATEGORY DISTRIBUTION:
${JSON.stringify(categoryCount, null, 2)}

CONFIDENCE DISTRIBUTION:
${JSON.stringify(confidenceBuckets, null, 2)}

REGIONAL DISTRIBUTION:
${JSON.stringify(regionCount, null, 2)}

Return JSON with chart data for all 6 charts:
{
  "radar_chart": {
    "title_ko": "테마별 전략적 중요도",
    "title_en": "Strategic Importance by Theme",
    "labels": ["T1 name", "T2 name"],
    "importance_scores": [9.2, 8.1],
    "urgency_scores": [9.0, 7.5]
  },
  "category_bar": {
    "title_ko": "카테고리별 기사 분포",
    "title_en": "Article Distribution by Category",
    "labels": ["AI_AGENT", "AI_COMMERCE"],
    "values": [15, 12]
  },
  "confidence_histogram": {
    "title_ko": "기사 신뢰도 분포",
    "title_en": "Article Confidence Distribution",
    "buckets": ["High (0.8+)", "Medium (0.5-0.8)", "Low (<0.5)"],
    "values": [${confidenceBuckets.high}, ${confidenceBuckets.medium}, ${confidenceBuckets.low}]
  },
  "regional_bar": {
    "title_ko": "지역별 트렌드 분포",
    "title_en": "Regional Trend Distribution",
    "regions": ["GLOBAL", "AMER", "EMEA", "APAC"],
    "values": [${regionCount.GLOBAL}, ${regionCount.AMER}, ${regionCount.EMEA}, ${regionCount.APAC}]
  },
  "impact_matrix_data": {
    "title_ko": "영향도-긴급도 매트릭스",
    "title_en": "Impact-Urgency Matrix",
    "points": ${JSON.stringify(themeStats.map(t => ({
      label: t.name_en,
      label_ko: t.name_ko,
      importance: t.importance,
      urgency_score: t.urgency === 'IMMEDIATE' ? 9 : t.urgency === 'SHORT_TERM' ? 6 : 3
    })))}
  },
  "source_diversity": {
    "title_ko": "출처 유형 분포",
    "title_en": "Source Type Distribution",
    "labels": ["Research/Analyst", "Tech Media", "Vendor/Brand", "News", "Other"],
    "values": [0, 0, 0, 0, 0]
  }
}`;
}

module.exports = {
  STAGE1_SYSTEM, stage1User,
  STAGE2_SYSTEM, stage2User,
  STAGE3_SYSTEM, stage3User,
  STAGE4_SYSTEM, stage4User,
  STAGE5_SYSTEM, stage5User,
  STAGE6_SYSTEM, stage6User,
  STAGE7_SYSTEM, stage7User
};
