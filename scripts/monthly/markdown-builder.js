/**
 * Monthly Deep Dive — Enhanced Markdown Assembler
 * Combines all pipeline outputs into a rich Markdown report
 * Compatible with existing build.js and templates.js (no template changes required)
 */

function escapeYaml(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function buildMarkdown(pipelineResult, monthStr, datePublished, chartRelativeDir) {
  const {
    themes, convergence_ko, convergence_en,
    themeAnalyses, synthesis, frameworks,
    executiveBrief, chartData, enrichedArticles, elapsed
  } = pipelineResult;

  const [year, month] = monthStr.split('-');
  const monthNamesKo = ['','1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const monthNamesEn = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthKo = monthNamesKo[parseInt(month)];
  const monthEn = monthNamesEn[parseInt(month)];

  const articleCount = enrichedArticles.length;
  const themeCount = themes.length;

  // Frontmatter
  const frontmatter = [
    '---',
    `month: "${monthStr}"`,
    `date_published: "${datePublished}"`,
    `title: "${escapeYaml(executiveBrief.brief_title_ko || '')}"`,
    `title_en: "${escapeYaml(executiveBrief.brief_title_en || '')}"`,
    `featured_reports:`,
    ...(themes.slice(0, 5).map(t => `  - "${escapeYaml(t.name_ko)}"`)),
    `article_count: ${articleCount}`,
    `theme_count: ${themeCount}`,
    `analysis_stages: 7`,
    `generation_time: ${elapsed || 0}`,
    '---'
  ].join('\n');

  // ── KOREAN SECTION ────────────────────────────────────────
  let ko = `\n<div class="lang-ko">\n\n`;

  // ── KO: Executive Brief ──
  ko += `## 📋 ${year}년 ${monthKo} Monthly Deep Dive\n\n`;
  ko += `<div class="quote-of-month">\n\n`;
  ko += `### 이달의 핵심 메시지\n\n`;
  ko += `> ${executiveBrief.month_in_one_sentence_ko || ''}\n\n`;
  if (executiveBrief.quote_of_month) {
    ko += `> **"${executiveBrief.quote_of_month.text}"**\n`;
    ko += `> — ${executiveBrief.quote_of_month.attribution}\n\n`;
  }
  ko += `</div>\n\n`;

  // ── KO: Metrics Dashboard ──
  ko += `### 📊 이달의 분석 현황\n\n`;
  ko += `| 지표 | 값 |\n|------|----|\n`;
  ko += `| 분석 기사 수 | **${articleCount}개** |\n`;
  ko += `| 도출 매크로 테마 | **${themeCount}개** |\n`;
  ko += `| AI 분석 파이프라인 | **7단계** |\n`;
  ko += `| 분석 소요 시간 | **${elapsed}초** |\n\n`;

  // Chart 1: Theme importance
  ko += `![전략적 중요도 차트](${chartRelativeDir}/theme-importance.svg)\n\n`;

  // ── KO: Meta Narrative ──
  ko += `---\n\n`;
  ko += `## 🌐 ${monthKo} AI 트렌드 개요\n\n`;
  ko += `${synthesis.meta_narrative_ko || ''}\n\n`;
  if (convergence_ko) {
    ko += `**테마 수렴 패턴:** ${convergence_ko}\n\n`;
  }

  // Chart 2: Category
  ko += `![카테고리 분포](${chartRelativeDir}/category-distribution.svg)\n\n`;

  // ── KO: Theme Analyses ──
  ko += `---\n\n`;
  ko += `## 🔬 핵심 테마 심층 분석\n\n`;

  themes.forEach((theme, i) => {
    const analysis = themeAnalyses.find(a => a.theme_id === theme.theme_id) || {};

    ko += `<div class="report-card">\n\n`;
    ko += `### ${i + 1}. ${theme.name_ko}\n`;
    ko += `**${theme.tagline_ko || ''}**\n\n`;

    // Urgency badge
    const urgencyBadge = { IMMEDIATE: '🔴 즉시', SHORT_TERM: '🟡 단기', MEDIUM_TERM: '🟢 중기' };
    ko += `> ⏰ 긴급도: ${urgencyBadge[theme.urgency] || theme.urgency} | 중요도: ${theme.importance_score}/10\n\n`;

    // Trend narrative
    ko += `#### 트렌드 분석\n\n${analysis.trend_narrative_ko || ''}\n\n`;

    // Evidence chain
    if (analysis.evidence_chain && analysis.evidence_chain.length > 0) {
      ko += `#### 📎 근거 체인\n\n`;
      analysis.evidence_chain.forEach(e => {
        ko += `- **${e.point_ko || ''}** `;
        if (e.source_url && e.source_title) {
          ko += `([${e.source_title}](${e.source_url}))`;
        }
        ko += '\n';
      });
      ko += '\n';
    }

    // Key metrics
    if (analysis.key_metrics && analysis.key_metrics.length > 0) {
      ko += `#### 📈 핵심 지표\n\n`;
      analysis.key_metrics.forEach(m => { ko += `- ${m}\n`; });
      ko += '\n';
    }

    // Impact
    if (analysis.impact_assessment) {
      const impactIcon = { HIGH: '🔴', MEDIUM: '🟡', LOW: '🟢' };
      ko += `#### 영향도 평가: ${impactIcon[analysis.impact_assessment.level] || ''} ${analysis.impact_assessment.level}\n\n`;
      ko += `${analysis.impact_assessment.rationale_ko || ''}\n\n`;
      ko += `> **시간 지평:** ${analysis.impact_assessment.time_horizon || ''}\n\n`;
    }

    // Competitive implications
    if (analysis.competitive_implications_ko) {
      ko += `#### 🏆 경쟁사 관점\n\n${analysis.competitive_implications_ko}\n\n`;
    }

    // Case studies
    if (analysis.case_studies && analysis.case_studies.length > 0) {
      ko += `#### 📌 케이스 스터디\n\n`;
      analysis.case_studies.forEach(c => {
        ko += `- **${c.company || ''}**: ${c.action || ''} → ${c.result || ''}`;
        if (c.source_url) ko += ` ([출처](${c.source_url}))`;
        ko += '\n';
      });
      ko += '\n';
    }

    // D2C So What
    if (analysis.d2c_so_what_ko) {
      ko += `#### 💡 LG D2C 시사점\n\n${analysis.d2c_so_what_ko}\n\n`;
    }

    ko += `</div>\n\n`;
  });

  // ── KO: Cross Synthesis ──
  ko += `---\n\n`;
  ko += `## 🔗 크로스 트렌드 종합 분석\n\n`;
  ko += `${synthesis.emerging_convergence_ko || ''}\n\n`;

  if (synthesis.reinforcing_pairs && synthesis.reinforcing_pairs.length > 0) {
    ko += `### 상호 강화 테마\n\n`;
    synthesis.reinforcing_pairs.forEach(p => {
      ko += `- **${p.theme_a} ↔ ${p.theme_b}**: ${p.synergy_ko || ''}\n`;
    });
    ko += '\n';
  }

  if (synthesis.tension_pairs && synthesis.tension_pairs.length > 0) {
    ko += `### 긴장 관계 테마\n\n`;
    synthesis.tension_pairs.forEach(p => {
      ko += `- **${p.theme_a} vs ${p.theme_b}**: ${p.tension_ko || ''}\n`;
    });
    ko += '\n';
  }

  // Chart 3 & 4
  ko += `![신뢰도 분포](${chartRelativeDir}/confidence-distribution.svg)\n\n`;
  ko += `![지역별 분포](${chartRelativeDir}/regional-comparison.svg)\n\n`;

  // ── KO: Strategic Framework ──
  ko += `---\n\n`;
  ko += `## 📐 전략 프레임워크\n\n`;

  // Impact-Urgency Matrix
  ko += `### 영향도-긴급도 매트릭스\n\n`;
  ko += `![영향도-긴급도 매트릭스](${chartRelativeDir}/impact-urgency-matrix.svg)\n\n`;

  if (frameworks.impact_urgency_matrix) {
    const matrix = frameworks.impact_urgency_matrix;
    const quads = matrix.quadrants || {};
    if (quads.high_impact_high_urgency?.themes?.length > 0) {
      ko += `> 🔴 **즉시 행동 (Act Now):** ${quads.high_impact_high_urgency.themes.join(', ')} — ${quads.high_impact_high_urgency.recommendation_ko || ''}\n\n`;
    }
    if (quads.high_impact_low_urgency?.themes?.length > 0) {
      ko += `> 🔵 **전략적 투자:** ${quads.high_impact_low_urgency.themes.join(', ')} — ${quads.high_impact_low_urgency.recommendation_ko || ''}\n\n`;
    }
  }

  // Action Roadmap
  if (frameworks.action_roadmap) {
    ko += `### 🎯 단계별 실행 로드맵\n\n`;
    const roadmap = frameworks.action_roadmap;

    ['immediate', 'short_term', 'medium_term'].forEach(horizon => {
      const h = roadmap[horizon];
      if (!h || !h.actions || h.actions.length === 0) return;
      ko += `<div class="action-items-box">\n\n`;
      ko += `#### ${h.label_ko || horizon}\n\n`;
      h.actions.forEach((a, i) => {
        ko += `${i + 1}. **${a.action_ko || ''}** (담당: ${a.owner || ''}) — KPI: ${a.kpi_ko || ''}\n\n`;
      });
      ko += `</div>\n\n`;
    });
  }

  // ── KO: LG D2C Position ──
  if (synthesis.lg_d2c_strategic_position_ko) {
    ko += `---\n\n`;
    ko += `## 🏢 LG D2C 전략적 포지셔닝\n\n`;
    ko += `${synthesis.lg_d2c_strategic_position_ko}\n\n`;
  }

  // ── KO: Top 3 Imperatives ──
  if (executiveBrief.top3_imperatives && executiveBrief.top3_imperatives.length > 0) {
    ko += `---\n\n`;
    ko += `<div class="action-items-box">\n\n`;
    ko += `## 🚀 핵심 전략 명령 (Top 3 Imperatives)\n\n`;
    executiveBrief.top3_imperatives.forEach(imp => {
      ko += `${imp.rank}. **${imp.imperative_ko || ''}** (${imp.owner || ''}) — ${imp.deadline_ko || ''}\n\n`;
    });
    ko += `</div>\n\n`;
  }

  ko += `</div>\n`;

  // ── ENGLISH SECTION ───────────────────────────────────────
  let en = `\n<div class="lang-en" style="display:none">\n\n`;

  en += `## 📋 ${monthEn} ${year} Monthly Deep Dive\n\n`;
  en += `<div class="quote-of-month">\n\n`;
  en += `### This Month's Core Message\n\n`;
  en += `> ${executiveBrief.month_in_one_sentence_en || ''}\n\n`;
  if (executiveBrief.quote_of_month) {
    en += `> **"${executiveBrief.quote_of_month.text}"**\n`;
    en += `> — ${executiveBrief.quote_of_month.attribution}\n\n`;
  }
  en += `</div>\n\n`;

  en += `### 📊 Monthly Analysis Dashboard\n\n`;
  en += `| Metric | Value |\n|--------|-------|\n`;
  en += `| Articles Analyzed | **${articleCount}** |\n`;
  en += `| Macro Themes Identified | **${themeCount}** |\n`;
  en += `| AI Pipeline Stages | **7** |\n`;
  en += `| Analysis Duration | **${elapsed}s** |\n\n`;

  en += `![Strategic Importance Chart](${chartRelativeDir}/theme-importance.svg)\n\n`;

  en += `---\n\n`;
  en += `## 🌐 ${monthEn} ${year} AI Trend Overview\n\n`;
  en += `${synthesis.meta_narrative_en || ''}\n\n`;
  if (convergence_en) {
    en += `**Theme Convergence:** ${convergence_en}\n\n`;
  }

  en += `![Category Distribution](${chartRelativeDir}/category-distribution.svg)\n\n`;

  en += `---\n\n`;
  en += `## 🔬 Macro Theme Deep Dives\n\n`;

  themes.forEach((theme, i) => {
    const analysis = themeAnalyses.find(a => a.theme_id === theme.theme_id) || {};

    en += `<div class="report-card">\n\n`;
    en += `### ${i + 1}. ${theme.name_en}\n`;
    en += `**${theme.tagline_en || ''}**\n\n`;

    const urgencyBadge = { IMMEDIATE: '🔴 Immediate', SHORT_TERM: '🟡 Short-term', MEDIUM_TERM: '🟢 Medium-term' };
    en += `> ⏰ Urgency: ${urgencyBadge[theme.urgency] || theme.urgency} | Importance: ${theme.importance_score}/10\n\n`;

    en += `#### Trend Analysis\n\n${analysis.trend_narrative_en || ''}\n\n`;

    if (analysis.evidence_chain && analysis.evidence_chain.length > 0) {
      en += `#### 📎 Evidence Chain\n\n`;
      analysis.evidence_chain.forEach(e => {
        en += `- **${e.point_en || ''}** `;
        if (e.source_url && e.source_title) {
          en += `([${e.source_title}](${e.source_url}))`;
        }
        en += '\n';
      });
      en += '\n';
    }

    if (analysis.key_metrics && analysis.key_metrics.length > 0) {
      en += `#### 📈 Key Metrics\n\n`;
      analysis.key_metrics.forEach(m => { en += `- ${m}\n`; });
      en += '\n';
    }

    if (analysis.impact_assessment) {
      const impactIcon = { HIGH: '🔴', MEDIUM: '🟡', LOW: '🟢' };
      en += `#### Impact Assessment: ${impactIcon[analysis.impact_assessment.level] || ''} ${analysis.impact_assessment.level}\n\n`;
      en += `${analysis.impact_assessment.rationale_en || ''}\n\n`;
      en += `> **Time Horizon:** ${analysis.impact_assessment.time_horizon || ''}\n\n`;
    }

    if (analysis.competitive_implications_en) {
      en += `#### 🏆 Competitive Landscape\n\n${analysis.competitive_implications_en}\n\n`;
    }

    if (analysis.case_studies && analysis.case_studies.length > 0) {
      en += `#### 📌 Case Studies\n\n`;
      analysis.case_studies.forEach(c => {
        en += `- **${c.company || ''}**: ${c.action || ''} → ${c.result || ''}`;
        if (c.source_url) en += ` ([source](${c.source_url}))`;
        en += '\n';
      });
      en += '\n';
    }

    if (analysis.d2c_so_what_en) {
      en += `#### 💡 LG D2C Implications\n\n${analysis.d2c_so_what_en}\n\n`;
    }

    en += `</div>\n\n`;
  });

  en += `---\n\n`;
  en += `## 🔗 Cross-Trend Synthesis\n\n`;
  en += `${synthesis.emerging_convergence_en || ''}\n\n`;

  if (synthesis.reinforcing_pairs && synthesis.reinforcing_pairs.length > 0) {
    en += `### Reinforcing Theme Pairs\n\n`;
    synthesis.reinforcing_pairs.forEach(p => {
      en += `- **${p.theme_a} ↔ ${p.theme_b}**: ${p.synergy_en || ''}\n`;
    });
    en += '\n';
  }

  en += `![Confidence Distribution](${chartRelativeDir}/confidence-distribution.svg)\n\n`;
  en += `![Regional Comparison](${chartRelativeDir}/regional-comparison.svg)\n\n`;

  en += `---\n\n`;
  en += `## 📐 Strategic Framework\n\n`;
  en += `### Impact-Urgency Matrix\n\n`;
  en += `![Impact-Urgency Matrix](${chartRelativeDir}/impact-urgency-matrix.svg)\n\n`;

  if (frameworks.action_roadmap) {
    en += `### 🎯 Phased Action Roadmap\n\n`;
    const roadmap = frameworks.action_roadmap;

    ['immediate', 'short_term', 'medium_term'].forEach(horizon => {
      const h = roadmap[horizon];
      if (!h || !h.actions || h.actions.length === 0) return;
      en += `<div class="action-items-box">\n\n`;
      en += `#### ${h.label_en || horizon}\n\n`;
      h.actions.forEach((a, i) => {
        en += `${i + 1}. **${a.action_en || ''}** (Owner: ${a.owner || ''}) — KPI: ${a.kpi_en || ''}\n\n`;
      });
      en += `</div>\n\n`;
    });
  }

  if (synthesis.lg_d2c_strategic_position_en) {
    en += `---\n\n`;
    en += `## 🏢 LG D2C Strategic Positioning\n\n`;
    en += `${synthesis.lg_d2c_strategic_position_en}\n\n`;
  }

  if (executiveBrief.top3_imperatives && executiveBrief.top3_imperatives.length > 0) {
    en += `---\n\n`;
    en += `<div class="action-items-box">\n\n`;
    en += `## 🚀 Top 3 Strategic Imperatives\n\n`;
    executiveBrief.top3_imperatives.forEach(imp => {
      en += `${imp.rank}. **${imp.imperative_en || ''}** (${imp.owner || ''}) — ${imp.deadline_en || ''}\n\n`;
    });
    en += `</div>\n\n`;
  }

  en += `</div>\n`;

  return `${frontmatter}\n${ko}${en}`;
}

module.exports = { buildMarkdown };
