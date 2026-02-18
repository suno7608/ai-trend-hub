#!/usr/bin/env node
/**
 * AI Trend Hub - Static Site Builder
 * Reads markdown content with YAML frontmatter → generates static HTML site
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const DIST_DIR = path.join(ROOT, 'dist');
const ASSETS_DIR = path.join(ROOT, 'assets');
const DATA_DIR = path.join(ROOT, 'data');

// ── Helpers ──────────────────────────────────────────────
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
      const { data, content } = matter(raw);
      return { ...data, _body: marked(content), _filename: f };
    })
    .sort((a, b) => new Date(b.date_published || b.date || 0) - new Date(a.date_published || a.date || 0));
}

function categoryLabel(cat) {
  const map = {
    commerce: 'Commerce',
    marketing: 'Marketing',
    tech: 'Tech',
    strategy: 'Strategy',
    ai_commerce: 'AI Commerce',
    ai_marketing: 'AI Marketing',
    ai_general: 'AI General',
    d2c_dtc: 'D2C/DTC',
    ce_industry: 'CE Industry',
    platform_vendor: 'Platform',
    cdp_crm_clv: 'CDP/CRM'
  };
  return map[cat] || cat;
}

function categoryColor(cat) {
  const map = {
    commerce: '#3B82F6',
    marketing: '#8B5CF6',
    tech: '#10B981',
    strategy: '#F59E0B',
    ai_commerce: '#3B82F6',
    ai_marketing: '#8B5CF6',
    ai_general: '#10B981',
    d2c_dtc: '#EC4899',
    ce_industry: '#6366F1',
    platform_vendor: '#F97316',
    cdp_crm_clv: '#14B8A6'
  };
  return map[cat] || '#6B7280';
}

// ── Load Content ─────────────────────────────────────────
const dailyItems = readMarkdownFiles(path.join(CONTENT_DIR, 'daily'));
const weeklyItems = readMarkdownFiles(path.join(CONTENT_DIR, 'weekly'));
const monthlyItems = readMarkdownFiles(path.join(CONTENT_DIR, 'monthly'));

// ── Generate index.json ──────────────────────────────────
const indexData = {
  generated_at: new Date().toISOString(),
  counts: {
    daily: dailyItems.length,
    weekly: weeklyItems.length,
    monthly: monthlyItems.length
  },
  daily: dailyItems.map(d => ({
    id: d.id,
    title: d.title,
    date_published: d.date_published,
    source_name: d.source_name,
    categories: d.categories,
    tags: d.tags,
    canonical_url: d.canonical_url
  })),
  weekly: weeklyItems.map(w => ({
    week: w.week,
    title: w.title || `Week ${w.week} Digest`
  })),
  monthly: monthlyItems.map(m => ({
    month: m.month,
    title: m.title || `${m.month} Deep Dive`
  }))
};

// ── Render Daily Card ────────────────────────────────────
function renderDailyCard(item, lang = 'ko') {
  const summary = lang === 'ko' ? (item.summary_ko || item.summary_en || '') : (item.summary_en || item.summary_ko || '');
  const soWhat = lang === 'ko' ? (item.so_what_ko || item.so_what_en || '') : (item.so_what_en || item.so_what_ko || '');
  const cats = (item.categories || []).map(c =>
    `<span class="tag" style="background:${categoryColor(c)}20;color:${categoryColor(c)};border:1px solid ${categoryColor(c)}40">${categoryLabel(c)}</span>`
  ).join('');
  const tags = (item.tags || []).map(t =>
    `<span class="tag tag-sub">${t}</span>`
  ).join('');
  const keyPoints = (item.key_points || []).map(kp => `<li>${kp}</li>`).join('');

  return `
    <article class="card daily-card" data-categories="${(item.categories||[]).join(',')}" data-tags="${(item.tags||[]).join(',')}" data-lang-ko data-lang-en>
      <div class="card-header">
        <div class="card-meta">
          <span class="source-badge">${item.source_name || 'Unknown'}</span>
          <time>${item.date_published || ''}</time>
        </div>
        <div class="card-tags">${cats}${tags}</div>
      </div>
      <h3 class="card-title">
        <a href="${item.canonical_url || '#'}" target="_blank" rel="noopener">${item.title || 'Untitled'}</a>
      </h3>
      <div class="card-summary">
        <div class="lang-ko">${item.summary_ko || ''}</div>
        <div class="lang-en" style="display:none">${item.summary_en || ''}</div>
      </div>
      ${keyPoints ? `<ul class="key-points">${keyPoints}</ul>` : ''}
      <div class="so-what">
        <strong>💡 So What</strong>
        <div class="lang-ko">${item.so_what_ko || ''}</div>
        <div class="lang-en" style="display:none">${item.so_what_en || ''}</div>
      </div>
      <div class="card-footer">
        <a href="${item.canonical_url || '#'}" target="_blank" rel="noopener" class="read-more">원문 보기 →</a>
        ${item.confidence ? `<span class="confidence">신뢰도: ${(item.confidence * 100).toFixed(0)}%</span>` : ''}
      </div>
    </article>`;
}

// ── Render Weekly Card ───────────────────────────────────
function renderWeeklyCard(item) {
  return `
    <article class="card weekly-card">
      <div class="card-header">
        <span class="badge badge-weekly">📊 Weekly Digest</span>
        <time>${item.week || item.date_published || ''}</time>
      </div>
      <h3 class="card-title">${item.title || `Week ${item.week} Digest`}</h3>
      <div class="card-body">${item._body || ''}</div>
    </article>`;
}

// ── Render Monthly Card ──────────────────────────────────
function renderMonthlyCard(item) {
  return `
    <article class="card monthly-card">
      <div class="card-header">
        <span class="badge badge-monthly">📖 Monthly Deep Dive</span>
        <time>${item.month || item.date_published || ''}</time>
      </div>
      <h3 class="card-title">${item.title || `${item.month} Deep Dive`}</h3>
      <div class="card-body">${item._body || ''}</div>
    </article>`;
}

// ── Build HTML ───────────────────────────────────────────
function buildSite() {
  ensureDir(DIST_DIR);
  ensureDir(path.join(DIST_DIR, 'assets', 'css'));
  ensureDir(path.join(DIST_DIR, 'assets', 'js'));

  // Copy assets
  const cssFile = path.join(ASSETS_DIR, 'css', 'style.css');
  const jsFile = path.join(ASSETS_DIR, 'js', 'app.js');
  if (fs.existsSync(cssFile)) fs.copyFileSync(cssFile, path.join(DIST_DIR, 'assets', 'css', 'style.css'));
  if (fs.existsSync(jsFile)) fs.copyFileSync(jsFile, path.join(DIST_DIR, 'assets', 'js', 'app.js'));

  // Generate daily cards
  const dailyCardsHTML = dailyItems.map(d => renderDailyCard(d)).join('\n');
  const weeklyCardsHTML = weeklyItems.map(w => renderWeeklyCard(w)).join('\n');
  const monthlyCardsHTML = monthlyItems.map(m => renderMonthlyCard(m)).join('\n');

  // Collect all unique tags
  const allTags = [...new Set(dailyItems.flatMap(d => d.tags || []))];
  const allCategories = [...new Set(dailyItems.flatMap(d => d.categories || []))];
  const tagFiltersHTML = allCategories.map(c =>
    `<button class="filter-btn" data-filter="${c}" style="--filter-color:${categoryColor(c)}">${categoryLabel(c)}</button>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Trend Hub — AI Commerce & Marketing Intelligence</title>
  <meta name="description" content="AI Commerce와 AI Marketing의 최신 트렌드, 뉴스, 인사이트를 한 곳에서. Daily · Weekly · Monthly 큐레이션.">
  <link rel="stylesheet" href="assets/css/style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <!-- Header -->
  <header class="site-header">
    <div class="container">
      <div class="header-left">
        <h1 class="logo">
          <span class="logo-icon">🔮</span>
          <span>AI Trend Hub</span>
        </h1>
        <p class="tagline lang-ko">AI Commerce & Marketing Intelligence for Global D2C</p>
        <p class="tagline lang-en" style="display:none">AI Commerce & Marketing Intelligence for Global D2C</p>
      </div>
      <div class="header-right">
        <button id="langToggle" class="lang-toggle" title="Toggle Language">
          <span class="lang-active">KO</span> / <span class="lang-inactive">EN</span>
        </button>
        <button id="themeToggle" class="theme-toggle" title="Toggle Theme">🌙</button>
      </div>
    </div>
  </header>

  <!-- Navigation -->
  <nav class="section-nav">
    <div class="container">
      <a href="#daily" class="nav-link active">📰 Daily Feed</a>
      <a href="#weekly" class="nav-link">📊 Weekly Digest</a>
      <a href="#monthly" class="nav-link">📖 Monthly Deep Dive</a>
      <a href="#sources" class="nav-link">📡 Sources</a>
    </div>
  </nav>

  <!-- Stats Bar -->
  <div class="stats-bar">
    <div class="container">
      <div class="stat">
        <span class="stat-number">${dailyItems.length}</span>
        <span class="stat-label lang-ko">오늘의 뉴스</span>
        <span class="stat-label lang-en" style="display:none">Today's News</span>
      </div>
      <div class="stat">
        <span class="stat-number">${weeklyItems.length}</span>
        <span class="stat-label lang-ko">주간 다이제스트</span>
        <span class="stat-label lang-en" style="display:none">Weekly Digest</span>
      </div>
      <div class="stat">
        <span class="stat-number">${monthlyItems.length}</span>
        <span class="stat-label lang-ko">월간 딥다이브</span>
        <span class="stat-label lang-en" style="display:none">Monthly Deep Dive</span>
      </div>
      <div class="stat">
        <span class="stat-number">${allTags.length}</span>
        <span class="stat-label lang-ko">추적 토픽</span>
        <span class="stat-label lang-en" style="display:none">Topics Tracked</span>
      </div>
    </div>
  </div>

  <main class="container main-content">
    <!-- Search -->
    <div class="search-container">
      <div class="search-wrapper">
        <span class="search-icon">🔍</span>
        <input type="text" id="searchInput" class="search-input" placeholder="🔍 키워드, 태그, 소스로 검색...">
      </div>
      <div id="searchResultsCount" class="search-results-count"></div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <span class="filters-label">Filter</span>
      <button class="filter-btn active" data-filter="all">All</button>
      ${tagFiltersHTML}
    </div>

    <!-- Daily Section -->
    <section id="daily" class="content-section">
      <div class="section-header">
        <h2>📰 <span class="lang-ko">Today's Feed</span><span class="lang-en" style="display:none">Today's Feed</span></h2>
        <span class="section-desc lang-ko">최신 AI Commerce & Marketing 뉴스 (최근 2~3일)</span>
        <span class="section-desc lang-en" style="display:none">Latest AI Commerce & Marketing news (last 2-3 days)</span>
      </div>
      <div class="card-grid">
        ${dailyCardsHTML || '<p class="empty-state">아직 Daily 콘텐츠가 없습니다.</p>'}
      </div>
    </section>

    <!-- Weekly Section -->
    <section id="weekly" class="content-section">
      <div class="section-header">
        <h2>📊 <span class="lang-ko">Weekly Digest</span><span class="lang-en" style="display:none">Weekly Digest</span></h2>
        <span class="section-desc lang-ko">이번 주 핵심 트렌드 Top 5</span>
        <span class="section-desc lang-en" style="display:none">This Week's Top 5 Trends</span>
      </div>
      <div class="card-grid card-grid-single">
        ${weeklyCardsHTML || '<p class="empty-state">아직 Weekly 콘텐츠가 없습니다.</p>'}
      </div>
    </section>

    <!-- Monthly Section -->
    <section id="monthly" class="content-section">
      <div class="section-header">
        <h2>📖 <span class="lang-ko">Monthly Deep Dive</span><span class="lang-en" style="display:none">Monthly Deep Dive</span></h2>
        <span class="section-desc lang-ko">리서치 기반 깊이 있는 분석</span>
        <span class="section-desc lang-en" style="display:none">Research-based in-depth analysis</span>
      </div>
      <div class="card-grid card-grid-single">
        ${monthlyCardsHTML || '<p class="empty-state">아직 Monthly 콘텐츠가 없습니다.</p>'}
      </div>
    </section>

    <!-- Sources Section -->
    <section id="sources" class="content-section">
      <div class="section-header">
        <h2>📡 <span class="lang-ko">데이터 소스</span><span class="lang-en" style="display:none">Data Sources</span></h2>
        <span class="section-desc lang-ko">큐레이션에 활용되는 소스 목록</span>
        <span class="section-desc lang-en" style="display:none">Sources used for curation</span>
      </div>
      <div class="sources-grid" id="sourcesGrid"></div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="site-footer">
    <div class="container">
      <p>© 2026 AI Trend Hub — Global D2C Organization</p>
      <p class="lang-ko">AI Commerce & Marketing Trend Intelligence Hub</p>
      <p class="lang-en" style="display:none">AI Commerce & Marketing Trend Intelligence Hub</p>
      <p class="footer-meta">Last build: ${new Date().toISOString().split('T')[0]} | Content items: ${dailyItems.length + weeklyItems.length + monthlyItems.length}</p>
    </div>
  </footer>

  <!-- Back to Top -->
  <button id="backToTop" class="back-to-top" title="Back to top">↑</button>

  <script src="assets/js/app.js"></script>
</body>
</html>`;

  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html);
  fs.writeFileSync(path.join(DIST_DIR, 'index.json'), JSON.stringify(indexData, null, 2));

  // Copy CNAME if exists
  const cname = path.join(ROOT, 'CNAME');
  if (fs.existsSync(cname)) fs.copyFileSync(cname, path.join(DIST_DIR, 'CNAME'));

  // Create .nojekyll for GitHub Pages
  fs.writeFileSync(path.join(DIST_DIR, '.nojekyll'), '');

  console.log(`✅ Build complete!`);
  console.log(`   Daily: ${dailyItems.length} items`);
  console.log(`   Weekly: ${weeklyItems.length} items`);
  console.log(`   Monthly: ${monthlyItems.length} items`);
  console.log(`   Output: ${DIST_DIR}`);
}

buildSite();
