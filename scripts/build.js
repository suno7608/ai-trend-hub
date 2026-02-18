#!/usr/bin/env node
/**
 * AI Trend Hub - Static Site Builder v2.0
 * Reads markdown content with YAML frontmatter → generates static HTML site
 * Supports: Home page, Archive pages, Detail pages (Weekly/Monthly)
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');
const T = require('./templates');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const DIST_DIR = path.join(ROOT, 'dist');
const ASSETS_DIR = path.join(ROOT, 'assets');

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

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function groupBy(arr, keyFn) {
  const groups = {};
  arr.forEach(item => {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return groups;
}

// ── Load Content ─────────────────────────────────────────
const dailyItems = readMarkdownFiles(path.join(CONTENT_DIR, 'daily'));
const weeklyItems = readMarkdownFiles(path.join(CONTENT_DIR, 'weekly'));
const monthlyItems = readMarkdownFiles(path.join(CONTENT_DIR, 'monthly'));

// Sort weekly/monthly by their specific fields
weeklyItems.sort((a, b) => (b.week || '').localeCompare(a.week || ''));
monthlyItems.sort((a, b) => (b.month || '').localeCompare(a.month || ''));

// ── Group data for archives ──────────────────────────────
const dailyByMonth = groupBy(dailyItems, item => (item.date_published || '').slice(0, 7));
const weeklyByYear = groupBy(weeklyItems, item => (item.week || '').split('-')[0]);
const monthlyByYear = groupBy(monthlyItems, item => (item.month || '').split('-')[0]);

// ── Generate index.json ──────────────────────────────────
const allTags = [...new Set(dailyItems.flatMap(d => d.tags || []))];
const allCategories = [...new Set(dailyItems.flatMap(d => d.categories || []))];

const indexData = {
  generated_at: new Date().toISOString(),
  counts: { daily: dailyItems.length, weekly: weeklyItems.length, monthly: monthlyItems.length },
  daily: dailyItems.map(d => ({
    id: d.id, title: d.title, date_published: d.date_published,
    source_name: d.source_name, categories: d.categories, tags: d.tags, canonical_url: d.canonical_url
  })),
  weekly: weeklyItems.map(w => ({ week: w.week, title: w.title || `Week ${w.week} Digest` })),
  monthly: monthlyItems.map(m => ({ month: m.month, title: m.title || `${m.month} Deep Dive` }))
};

// ══════════════════════════════════════════════════════════
//  PAGE BUILDERS
// ══════════════════════════════════════════════════════════

// ── Home Page ────────────────────────────────────────────
function buildHomePage() {
  const CONFIDENCE_THRESHOLD = 0.69;
  const MAX_VISIBLE_CARDS = 7;

  // Filter out low-confidence items (≤ 69%)
  const qualityDaily = dailyItems.filter(d => {
    const conf = d.confidence || 0;
    // Keep manually created items (no confidence field) and high-confidence items
    return conf === 0 || conf > CONFIDENCE_THRESHOLD;
  });

  // Sort by: newest first, then by confidence (highest first) as tiebreaker
  const sortedDaily = [...qualityDaily].sort((a, b) => {
    const dateA = new Date(a.date_published || 0);
    const dateB = new Date(b.date_published || 0);
    if (dateB.getTime() !== dateA.getTime()) return dateB - dateA;
    return (b.confidence || 0) - (a.confidence || 0);
  });

  // Split into visible (first 7) and hidden (rest)
  const visibleDaily = sortedDaily.slice(0, MAX_VISIBLE_CARDS);
  const hiddenDaily = sortedDaily.slice(MAX_VISIBLE_CARDS);

  const visibleCardsHTML = visibleDaily.map(d => T.renderDailyCard(d)).join('\n');
  const hiddenCardsHTML = hiddenDaily.map(d => T.renderDailyCard(d)).join('\n');

  const dailyCardsHTML = visibleCardsHTML
    + (hiddenDaily.length > 0
      ? `</div>
      <div class="card-grid card-grid-hidden" id="hiddenDailyCards" style="display:none">
        ${hiddenCardsHTML}`
      : '');

  const loadMoreBtnHTML = hiddenDaily.length > 0
    ? `<button class="load-more-btn" id="loadMoreDaily" onclick="document.getElementById('hiddenDailyCards').style.display='';this.style.display='none';document.getElementById('showLessDaily').style.display='';">
        <span class="lang-ko">📰 더보기 (${hiddenDaily.length}건 더)</span>
        <span class="lang-en" style="display:none">📰 Load More (${hiddenDaily.length} more)</span>
      </button>
      <button class="load-more-btn load-less-btn" id="showLessDaily" style="display:none" onclick="document.getElementById('hiddenDailyCards').style.display='none';this.style.display='none';document.getElementById('loadMoreDaily').style.display='';">
        <span class="lang-ko">접기 ▲</span>
        <span class="lang-en" style="display:none">Show Less ▲</span>
      </button>`
    : '';

  // Weekly: show latest 1 only with link to detail
  const latestWeekly = weeklyItems[0];
  const weeklyCardHTML = latestWeekly
    ? T.renderWeeklyCard(latestWeekly, { linkToDetail: true, detailUrl: `weekly/${latestWeekly.week}.html` })
    : '';

  // Monthly: show latest 1 only with link to detail
  const latestMonthly = monthlyItems[0];
  const monthlyCardHTML = latestMonthly
    ? T.renderMonthlyCard(latestMonthly, { linkToDetail: true, detailUrl: `monthly/${latestMonthly.month}.html` })
    : '';

  const tagFiltersHTML = allCategories.map(c =>
    `<button class="filter-btn" data-filter="${c}" style="--filter-color:${T.categoryColor(c)}">${T.categoryLabel(c)}</button>`
  ).join('');

  const archiveLinkHTML = `<a href="archive/daily/index.html" class="archive-link-btn">
        <span class="lang-ko">📂 전체 아카이브 보기</span>
        <span class="lang-en" style="display:none">📂 View Full Archive</span>
      </a>`;

  const bodyContent = `
  <!-- Navigation -->
  <nav class="section-nav">
    <div class="container">
      <a href="#daily" class="nav-link active">📰 Daily Feed</a>
      <a href="#weekly" class="nav-link">📊 Weekly Digest</a>
      <a href="#monthly" class="nav-link">📖 Monthly Deep Dive</a>
      <a href="#sources" class="nav-link">📡 Sources</a>
      <a href="archive/search.html" class="nav-link nav-link-search">🔍 Search</a>
      <a href="archive/daily/index.html" class="nav-link nav-link-archive">📂 Archive</a>
    </div>
  </nav>

  <!-- Stats Bar -->
  <div class="stats-bar">
    <div class="container">
      <div class="stat">
        <span class="stat-number">${sortedDaily.length}</span>
        <span class="stat-label lang-ko">전체 뉴스</span>
        <span class="stat-label lang-en" style="display:none">Total News</span>
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
    <!-- Daily Section -->
    <section id="daily" class="content-section">
      <div class="section-header">
        <h2>📰 <span class="lang-ko">Today's Feed</span><span class="lang-en" style="display:none">Today's Feed</span></h2>
        <span class="section-desc lang-ko">최신 AI Commerce & Marketing 뉴스</span>
        <span class="section-desc lang-en" style="display:none">Latest AI Commerce & Marketing news</span>
      </div>

      <div class="search-container">
        <div class="search-wrapper">
          <span class="search-icon">🔍</span>
          <input type="text" id="searchInput" class="search-input" placeholder="🔍 키워드, 태그, 소스로 검색...">
        </div>
        <div id="searchResultsCount" class="search-results-count"></div>
      </div>

      <div class="filters">
        <span class="filters-label">Filter</span>
        <button class="filter-btn active" data-filter="all">All</button>
        ${tagFiltersHTML}
      </div>

      <div class="card-grid">
        ${dailyCardsHTML || '<p class="empty-state">아직 Daily 콘텐츠가 없습니다.</p>'}
      </div>

      ${loadMoreBtnHTML}
      ${archiveLinkHTML}
    </section>

    <!-- Weekly Section -->
    <section id="weekly" class="content-section">
      <div class="section-header">
        <h2>📊 <span class="lang-ko">Weekly Digest</span><span class="lang-en" style="display:none">Weekly Digest</span></h2>
        <span class="section-desc lang-ko">이번 주 핵심 트렌드 Top 5</span>
        <span class="section-desc lang-en" style="display:none">This Week's Top 5 Trends</span>
      </div>
      <div class="card-grid card-grid-single">
        ${weeklyCardHTML || '<p class="empty-state">아직 Weekly 콘텐츠가 없습니다.</p>'}
      </div>
      ${weeklyItems.length > 1 ? `
      <div class="weekly-past-list">
        <h4 class="past-list-title">
          <span class="lang-ko">지난 Digest</span>
          <span class="lang-en" style="display:none">Past Digests</span>
        </h4>
        <div class="archive-list archive-list-compact">
          ${weeklyItems.slice(1, 4).map(w => T.renderWeeklyListCard(w, `weekly/${w.week}.html`)).join('\n')}
        </div>
      </div>
      <a href="archive/weekly/index.html" class="archive-link-btn">
        <span class="lang-ko">📂 전체 Weekly 아카이브 (${weeklyItems.length}건)</span>
        <span class="lang-en" style="display:none">📂 All Weekly Archive (${weeklyItems.length} issues)</span>
      </a>` : ''}
    </section>

    <!-- Monthly Section -->
    <section id="monthly" class="content-section">
      <div class="section-header">
        <h2>📖 <span class="lang-ko">Monthly Deep Dive</span><span class="lang-en" style="display:none">Monthly Deep Dive</span></h2>
        <span class="section-desc lang-ko">리서치 기반 깊이 있는 분석</span>
        <span class="section-desc lang-en" style="display:none">Research-based in-depth analysis</span>
      </div>
      <div class="card-grid card-grid-single">
        ${monthlyCardHTML || '<p class="empty-state">아직 Monthly 콘텐츠가 없습니다.</p>'}
      </div>
      ${monthlyItems.length > 1 ? `
      <div class="monthly-past-list">
        <h4 class="past-list-title">
          <span class="lang-ko">지난 Deep Dive</span>
          <span class="lang-en" style="display:none">Past Deep Dives</span>
        </h4>
        <div class="archive-list archive-list-compact">
          ${monthlyItems.slice(1, 4).map(m => T.renderMonthlyListCard(m, `monthly/${m.month}.html`)).join('\n')}
        </div>
      </div>
      <a href="archive/monthly/index.html" class="archive-link-btn">
        <span class="lang-ko">📂 전체 Monthly 아카이브 (${monthlyItems.length}건)</span>
        <span class="lang-en" style="display:none">📂 All Monthly Archive (${monthlyItems.length} issues)</span>
      </a>` : ''}
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
  </main>`;

  return T.renderPageShell({
    title: 'AI Commerce & Marketing Intelligence',
    bodyContent,
    cssPath: 'assets/css/style.css',
    jsPath: 'assets/js/app.js',
  });
}

// ── Daily Archive Index ──────────────────────────────────
function buildDailyArchiveIndex() {
  const months = Object.keys(dailyByMonth).sort().reverse();
  const cardsHTML = months.map(ym => T.renderArchiveIndexCard({
    label_ko: T.monthLabelKo(ym),
    label_en: T.monthLabelEn(ym),
    count: dailyByMonth[ym].length,
    url: `${ym.split('-')[0]}/${ym.split('-')[1]}/index.html`,
    icon: '📰'
  })).join('\n');

  const bodyContent = `
  ${T.renderArchiveNav('daily', '../../')}
  <main class="container main-content">
    <section class="content-section">
      ${T.renderBreadcrumb([
        { label_ko: '홈', label_en: 'Home', url: '../../index.html' },
        { label_ko: 'Daily 아카이브', label_en: 'Daily Archive' }
      ])}
      <div class="section-header archive-section-header">
        <h2>📰 <span class="lang-ko">Daily 아카이브</span><span class="lang-en" style="display:none">Daily Archive</span></h2>
        <span class="section-desc lang-ko">월별로 모아보는 Daily 뉴스 피드</span>
        <span class="section-desc lang-en" style="display:none">Daily news feed organized by month</span>
      </div>
      ${T.renderArchiveGrid(cardsHTML) || '<p class="empty-state">아직 콘텐츠가 없습니다.</p>'}
    </section>
  </main>`;

  return T.renderPageShell({
    title: 'Daily Archive',
    bodyContent,
    cssPath: '../../assets/css/style.css',
    jsPath: '../../assets/js/app.js',
  });
}

// ── Daily Monthly Page (e.g., /archive/daily/2026/02/) ───
function buildDailyMonthPage(ym, items) {
  const [year, month] = ym.split('-');
  const dailyCardsHTML = items.map(d => T.renderDailyCard(d)).join('\n');

  // Category filters for this month
  const monthCats = [...new Set(items.flatMap(d => d.categories || []))];
  const tagFiltersHTML = monthCats.map(c =>
    `<button class="filter-btn" data-filter="${c}" style="--filter-color:${T.categoryColor(c)}">${T.categoryLabel(c)}</button>`
  ).join('');

  const bodyContent = `
  ${T.renderArchiveNav('daily', '../../../../')}
  <main class="container main-content">
    <section class="content-section">
      ${T.renderBreadcrumb([
        { label_ko: '홈', label_en: 'Home', url: '../../../../index.html' },
        { label_ko: 'Daily 아카이브', label_en: 'Daily Archive', url: '../../index.html' },
        { label_ko: T.monthLabelKo(ym), label_en: T.monthLabelEn(ym) }
      ])}
      <div class="section-header archive-section-header">
        <h2>📰 <span class="lang-ko">${T.monthLabelKo(ym)} Daily</span><span class="lang-en" style="display:none">${T.monthLabelEn(ym)} Daily</span></h2>
        <span class="section-desc">${items.length} items</span>
      </div>

      <div class="search-container">
        <div class="search-wrapper">
          <span class="search-icon">🔍</span>
          <input type="text" id="searchInput" class="search-input" placeholder="🔍 키워드, 태그, 소스로 검색...">
        </div>
        <div id="searchResultsCount" class="search-results-count"></div>
      </div>

      <div class="filters">
        <span class="filters-label">Filter</span>
        <button class="filter-btn active" data-filter="all">All</button>
        ${tagFiltersHTML}
      </div>

      <div class="card-grid">
        ${dailyCardsHTML}
      </div>
    </section>
  </main>`;

  return T.renderPageShell({
    title: `${T.monthLabelEn(ym)} Daily`,
    bodyContent,
    cssPath: '../../../../assets/css/style.css',
    jsPath: '../../../../assets/js/app.js',
  });
}

// ── Weekly Archive Index ─────────────────────────────────
function buildWeeklyArchiveIndex() {
  const years = Object.keys(weeklyByYear).sort().reverse();
  const cardsHTML = years.map(y => T.renderArchiveIndexCard({
    label_ko: `${y}년`,
    label_en: y,
    count: weeklyByYear[y].length,
    url: `${y}/index.html`,
    icon: '📊'
  })).join('\n');

  const bodyContent = `
  ${T.renderArchiveNav('weekly', '../../')}
  <main class="container main-content">
    <section class="content-section">
      ${T.renderBreadcrumb([
        { label_ko: '홈', label_en: 'Home', url: '../../index.html' },
        { label_ko: 'Weekly 아카이브', label_en: 'Weekly Archive' }
      ])}
      <div class="section-header archive-section-header">
        <h2>📊 <span class="lang-ko">Weekly 아카이브</span><span class="lang-en" style="display:none">Weekly Archive</span></h2>
        <span class="section-desc lang-ko">주간 트렌드 다이제스트 모음</span>
        <span class="section-desc lang-en" style="display:none">Weekly trend digest collection</span>
      </div>
      ${T.renderArchiveGrid(cardsHTML) || '<p class="empty-state">아직 콘텐츠가 없습니다.</p>'}
    </section>
  </main>`;

  return T.renderPageShell({
    title: 'Weekly Archive',
    bodyContent,
    cssPath: '../../assets/css/style.css',
    jsPath: '../../assets/js/app.js',
  });
}

// ── Weekly Year Page ─────────────────────────────────────
function buildWeeklyYearPage(year, items) {
  const listHTML = items.map(item =>
    T.renderWeeklyListCard(item, `../../../weekly/${item.week}.html`)
  ).join('\n');

  const bodyContent = `
  ${T.renderArchiveNav('weekly', '../../../')}
  <main class="container main-content">
    <section class="content-section">
      ${T.renderBreadcrumb([
        { label_ko: '홈', label_en: 'Home', url: '../../../index.html' },
        { label_ko: 'Weekly 아카이브', label_en: 'Weekly Archive', url: '../index.html' },
        { label_ko: `${year}년`, label_en: year }
      ])}
      <div class="section-header archive-section-header">
        <h2>📊 <span class="lang-ko">${year}년 Weekly Digest</span><span class="lang-en" style="display:none">${year} Weekly Digest</span></h2>
        <span class="section-desc">${items.length} issues</span>
      </div>
      <div class="archive-list">
        ${listHTML}
      </div>
    </section>
  </main>`;

  return T.renderPageShell({
    title: `${year} Weekly Digest`,
    bodyContent,
    cssPath: '../../../assets/css/style.css',
    jsPath: '../../../assets/js/app.js',
  });
}

// ── Weekly Detail Page ───────────────────────────────────
function buildWeeklyDetailPage(item, prevItem, nextItem) {
  const prev = prevItem ? { title: prevItem.week, url: `${prevItem.week}.html` } : null;
  const next = nextItem ? { title: nextItem.week, url: `${nextItem.week}.html` } : null;
  const year = (item.week || '').split('-')[0];

  const bodyContent = `
  ${T.renderArchiveNav('weekly', '../')}
  <main class="container main-content">
    <section class="content-section detail-page">
      ${T.renderBreadcrumb([
        { label_ko: '홈', label_en: 'Home', url: '../index.html' },
        { label_ko: 'Weekly 아카이브', label_en: 'Weekly Archive', url: `../archive/weekly/index.html` },
        { label_ko: `${year}년`, label_en: year, url: `../archive/weekly/${year}/index.html` },
        { label_ko: item.week, label_en: item.week }
      ])}

      <article class="card weekly-card detail-card">
        <div class="card-header">
          <span class="badge badge-weekly">📊 Weekly Digest</span>
          <time>${item.week}</time>
        </div>
        <div class="card-title">
          <span class="lang-ko">${item.title || `Week ${item.week} Digest`}</span>
          <span class="lang-en" style="display:none">${item.title_en || `Week ${item.week} Digest`}</span>
        </div>
        <div class="card-body">
          ${item._body || ''}
        </div>
        <div class="social-actions" data-card-id="weekly-${item.week}">
          <button class="social-btn like-btn" data-action="like" title="좋아요">
            <span class="like-icon">♡</span>
            <span class="like-count">0</span>
          </button>
          <button class="social-btn share-btn" data-action="share" data-title="${(item.title || '').replace(/"/g, '&quot;')}" data-url="" title="공유하기">
            <span class="share-icon">↗</span>
            <span class="lang-ko">공유</span><span class="lang-en" style="display:none">Share</span>
          </button>
        </div>
      </article>

      ${T.renderPrevNext({ prev, next, backUrl: `../archive/weekly/${year}/index.html`, backLabelKo: 'Weekly 목록으로', backLabelEn: 'Back to Weekly list' })}
    </section>
  </main>`;

  return T.renderPageShell({
    title: `${item.week} Weekly Digest`,
    bodyContent,
    cssPath: '../assets/css/style.css',
    jsPath: '../assets/js/app.js',
  });
}

// ── Monthly Archive Index ────────────────────────────────
function buildMonthlyArchiveIndex() {
  const years = Object.keys(monthlyByYear).sort().reverse();
  const cardsHTML = years.map(y => T.renderArchiveIndexCard({
    label_ko: `${y}년`,
    label_en: y,
    count: monthlyByYear[y].length,
    url: `${y}/index.html`,
    icon: '📖'
  })).join('\n');

  const bodyContent = `
  ${T.renderArchiveNav('monthly', '../../')}
  <main class="container main-content">
    <section class="content-section">
      ${T.renderBreadcrumb([
        { label_ko: '홈', label_en: 'Home', url: '../../index.html' },
        { label_ko: 'Monthly 아카이브', label_en: 'Monthly Archive' }
      ])}
      <div class="section-header archive-section-header">
        <h2>📖 <span class="lang-ko">Monthly 아카이브</span><span class="lang-en" style="display:none">Monthly Archive</span></h2>
        <span class="section-desc lang-ko">리서치 기반 월간 딥다이브 모음</span>
        <span class="section-desc lang-en" style="display:none">Research-based monthly deep dive collection</span>
      </div>
      ${T.renderArchiveGrid(cardsHTML) || '<p class="empty-state">아직 콘텐츠가 없습니다.</p>'}
    </section>
  </main>`;

  return T.renderPageShell({
    title: 'Monthly Archive',
    bodyContent,
    cssPath: '../../assets/css/style.css',
    jsPath: '../../assets/js/app.js',
  });
}

// ── Monthly Year Page ────────────────────────────────────
function buildMonthlyYearPage(year, items) {
  const listHTML = items.map(item =>
    T.renderMonthlyListCard(item, `../../../monthly/${item.month}.html`)
  ).join('\n');

  const bodyContent = `
  ${T.renderArchiveNav('monthly', '../../../')}
  <main class="container main-content">
    <section class="content-section">
      ${T.renderBreadcrumb([
        { label_ko: '홈', label_en: 'Home', url: '../../../index.html' },
        { label_ko: 'Monthly 아카이브', label_en: 'Monthly Archive', url: '../index.html' },
        { label_ko: `${year}년`, label_en: year }
      ])}
      <div class="section-header archive-section-header">
        <h2>📖 <span class="lang-ko">${year}년 Monthly Deep Dive</span><span class="lang-en" style="display:none">${year} Monthly Deep Dive</span></h2>
        <span class="section-desc">${items.length} issues</span>
      </div>
      <div class="archive-list">
        ${listHTML}
      </div>
    </section>
  </main>`;

  return T.renderPageShell({
    title: `${year} Monthly Deep Dive`,
    bodyContent,
    cssPath: '../../../assets/css/style.css',
    jsPath: '../../../assets/js/app.js',
  });
}

// ── Monthly Detail Page ──────────────────────────────────
function buildMonthlyDetailPage(item, prevItem, nextItem) {
  const prev = prevItem ? { title: prevItem.month, url: `${prevItem.month}.html` } : null;
  const next = nextItem ? { title: nextItem.month, url: `${nextItem.month}.html` } : null;
  const year = (item.month || '').split('-')[0];

  const bodyContent = `
  ${T.renderArchiveNav('monthly', '../')}
  <main class="container main-content">
    <section class="content-section detail-page">
      ${T.renderBreadcrumb([
        { label_ko: '홈', label_en: 'Home', url: '../index.html' },
        { label_ko: 'Monthly 아카이브', label_en: 'Monthly Archive', url: `../archive/monthly/index.html` },
        { label_ko: `${year}년`, label_en: year, url: `../archive/monthly/${year}/index.html` },
        { label_ko: T.monthLabelKo(item.month), label_en: T.monthLabelEn(item.month) }
      ])}

      <article class="card monthly-card detail-card">
        <div class="card-header">
          <span class="badge badge-monthly">📖 Monthly Deep Dive</span>
          <time>${item.month}</time>
        </div>
        <div class="card-title">
          <span class="lang-ko">${item.title || `${item.month} Deep Dive`}</span>
          <span class="lang-en" style="display:none">${item.title_en || `${item.month} Deep Dive`}</span>
        </div>
        <div class="card-body">
          ${item._body || ''}
        </div>
        <div class="social-actions" data-card-id="monthly-${item.month}">
          <button class="social-btn like-btn" data-action="like" title="좋아요">
            <span class="like-icon">♡</span>
            <span class="like-count">0</span>
          </button>
          <button class="social-btn share-btn" data-action="share" data-title="${(item.title || '').replace(/"/g, '&quot;')}" data-url="" title="공유하기">
            <span class="share-icon">↗</span>
            <span class="lang-ko">공유</span><span class="lang-en" style="display:none">Share</span>
          </button>
        </div>
      </article>

      ${T.renderPrevNext({ prev, next, backUrl: `../archive/monthly/${year}/index.html`, backLabelKo: 'Monthly 목록으로', backLabelEn: 'Back to Monthly list' })}
    </section>
  </main>`;

  return T.renderPageShell({
    title: `${T.monthLabelEn(item.month)} Deep Dive`,
    bodyContent,
    cssPath: '../assets/css/style.css',
    jsPath: '../assets/js/app.js',
  });
}

// ── Search Index JSON ─────────────────────────────────────
function buildSearchIndex() {
  const items = [];

  dailyItems.forEach(d => {
    items.push({
      type: 'daily',
      id: d.id || d._filename,
      title: d.title || '',
      title_en: d.title || '',
      date: d.date_published || '',
      source: d.source_name || '',
      categories: d.categories || [],
      tags: d.tags || [],
      summary_ko: d.summary_ko || '',
      summary_en: d.summary_en || '',
      so_what_ko: d.so_what_ko || '',
      so_what_en: d.so_what_en || '',
      body_text: stripHtml(d._body).slice(0, 500),
      url: d.canonical_url || '',
      page_url: `archive/daily/${(d.date_published || '').slice(0, 4)}/${(d.date_published || '').slice(5, 7)}/index.html`,
    });
  });

  weeklyItems.forEach(w => {
    items.push({
      type: 'weekly',
      id: w.week || w._filename,
      title: w.title || `Week ${w.week} Digest`,
      title_en: w.title_en || w.title || `Week ${w.week} Digest`,
      date: w.week || '',
      source: '',
      categories: [],
      tags: (w.top_keywords || []),
      summary_ko: '',
      summary_en: '',
      so_what_ko: '',
      so_what_en: '',
      body_text: stripHtml(w._body).slice(0, 800),
      url: '',
      page_url: `weekly/${w.week}.html`,
    });
  });

  monthlyItems.forEach(m => {
    items.push({
      type: 'monthly',
      id: m.month || m._filename,
      title: m.title || `${m.month} Deep Dive`,
      title_en: m.title_en || m.title || `${m.month} Deep Dive`,
      date: m.month || '',
      source: '',
      categories: [],
      tags: [],
      summary_ko: '',
      summary_en: '',
      so_what_ko: '',
      so_what_en: '',
      body_text: stripHtml(m._body).slice(0, 800),
      url: '',
      page_url: `monthly/${m.month}.html`,
      featured_reports: m.featured_reports || [],
    });
  });

  // Collect all categories across all types
  const allSearchCategories = [...new Set(items.flatMap(i => i.categories))].filter(Boolean);

  return { items, categories: allSearchCategories };
}

// ── Search Page ──────────────────────────────────────────
function buildSearchPage() {
  const bodyContent = `
  ${T.renderArchiveNav('search', '../')}
  <main class="container main-content">
    <section class="content-section search-page">
      ${T.renderBreadcrumb([
        { label_ko: '홈', label_en: 'Home', url: '../index.html' },
        { label_ko: '통합 검색', label_en: 'Search' }
      ])}

      <div class="section-header archive-section-header">
        <h2>🔍 <span class="lang-ko">아카이브 통합 검색</span><span class="lang-en" style="display:none">Archive Search</span></h2>
      </div>

      <!-- Search Input -->
      <div class="global-search-box">
        <div class="search-wrapper global-search-wrapper">
          <span class="search-icon">🔍</span>
          <input type="text" id="globalSearchInput" class="search-input global-search-input"
            placeholder="키워드로 Daily, Weekly, Monthly 전체 콘텐츠를 검색하세요..."
            autofocus>
        </div>
      </div>

      <!-- Type Filters -->
      <div class="search-filters">
        <div class="search-filter-group">
          <span class="search-filter-label lang-ko">유형</span>
          <span class="search-filter-label lang-en" style="display:none">Type</span>
          <button class="search-filter-btn active" data-type="all">
            <span class="lang-ko">전체</span><span class="lang-en" style="display:none">All</span>
          </button>
          <button class="search-filter-btn" data-type="daily">📰 Daily</button>
          <button class="search-filter-btn" data-type="weekly">📊 Weekly</button>
          <button class="search-filter-btn" data-type="monthly">📖 Monthly</button>
        </div>
        <div class="search-filter-group" id="categoryFilters">
          <span class="search-filter-label lang-ko">카테고리</span>
          <span class="search-filter-label lang-en" style="display:none">Category</span>
          <button class="search-filter-btn cat-filter active" data-cat="all">
            <span class="lang-ko">전체</span><span class="lang-en" style="display:none">All</span>
          </button>
          ${allCategories.map(c =>
            `<button class="search-filter-btn cat-filter" data-cat="${c}" style="--filter-color:${T.categoryColor(c)}">${T.categoryLabel(c)}</button>`
          ).join('')}
        </div>
        <div class="search-filter-group">
          <span class="search-filter-label lang-ko">정렬</span>
          <span class="search-filter-label lang-en" style="display:none">Sort</span>
          <button class="search-filter-btn sort-btn active" data-sort="relevance">
            <span class="lang-ko">관련도</span><span class="lang-en" style="display:none">Relevance</span>
          </button>
          <button class="search-filter-btn sort-btn" data-sort="newest">
            <span class="lang-ko">최신순</span><span class="lang-en" style="display:none">Newest</span>
          </button>
          <button class="search-filter-btn sort-btn" data-sort="oldest">
            <span class="lang-ko">오래된순</span><span class="lang-en" style="display:none">Oldest</span>
          </button>
        </div>
      </div>

      <!-- Search Stats -->
      <div id="searchStats" class="search-stats"></div>

      <!-- Results -->
      <div id="searchResults" class="search-results">
        <div class="search-initial-state">
          <div class="search-initial-icon">🔮</div>
          <p class="lang-ko">Daily · Weekly · Monthly 전체 콘텐츠를 검색할 수 있습니다.</p>
          <p class="lang-en" style="display:none">Search across all Daily · Weekly · Monthly content.</p>
          <div class="search-initial-hints">
            <span class="lang-ko">예시: agentic commerce, D2C, AI 마케팅, McKinsey</span>
            <span class="lang-en" style="display:none">Examples: agentic commerce, D2C, AI marketing, McKinsey</span>
          </div>
        </div>
      </div>
    </section>
  </main>`;

  return T.renderPageShell({
    title: '통합 검색',
    bodyContent,
    cssPath: '../assets/css/style.css',
    jsPath: '../assets/js/app.js',
  });
}

// ══════════════════════════════════════════════════════════
//  BUILD ALL
// ══════════════════════════════════════════════════════════
function buildSite() {
  // Clean & prepare dist
  ensureDir(DIST_DIR);
  ensureDir(path.join(DIST_DIR, 'assets', 'css'));
  ensureDir(path.join(DIST_DIR, 'assets', 'js'));

  // Copy assets
  const cssFile = path.join(ASSETS_DIR, 'css', 'style.css');
  const jsFile = path.join(ASSETS_DIR, 'js', 'app.js');
  if (fs.existsSync(cssFile)) fs.copyFileSync(cssFile, path.join(DIST_DIR, 'assets', 'css', 'style.css'));
  if (fs.existsSync(jsFile)) fs.copyFileSync(jsFile, path.join(DIST_DIR, 'assets', 'js', 'app.js'));

  let pageCount = 0;

  // ── 1. Home page ───────────────────────────────────────
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), buildHomePage());
  fs.writeFileSync(path.join(DIST_DIR, 'index.json'), JSON.stringify(indexData, null, 2));
  pageCount++;

  // ── 2. Daily Archive ───────────────────────────────────
  const dailyArchiveDir = path.join(DIST_DIR, 'archive', 'daily');
  ensureDir(dailyArchiveDir);
  fs.writeFileSync(path.join(dailyArchiveDir, 'index.html'), buildDailyArchiveIndex());
  pageCount++;

  // Daily month pages
  Object.keys(dailyByMonth).forEach(ym => {
    const [year, month] = ym.split('-');
    const monthDir = path.join(dailyArchiveDir, year, month);
    ensureDir(monthDir);
    fs.writeFileSync(path.join(monthDir, 'index.html'), buildDailyMonthPage(ym, dailyByMonth[ym]));
    pageCount++;
  });

  // ── 3. Weekly Archive ──────────────────────────────────
  const weeklyArchiveDir = path.join(DIST_DIR, 'archive', 'weekly');
  ensureDir(weeklyArchiveDir);
  fs.writeFileSync(path.join(weeklyArchiveDir, 'index.html'), buildWeeklyArchiveIndex());
  pageCount++;

  // Weekly year pages
  Object.keys(weeklyByYear).forEach(year => {
    const yearDir = path.join(weeklyArchiveDir, year);
    ensureDir(yearDir);
    fs.writeFileSync(path.join(yearDir, 'index.html'), buildWeeklyYearPage(year, weeklyByYear[year]));
    pageCount++;
  });

  // Weekly detail pages
  const weeklyDetailDir = path.join(DIST_DIR, 'weekly');
  ensureDir(weeklyDetailDir);
  weeklyItems.forEach((item, i) => {
    const prevItem = weeklyItems[i + 1] || null; // older
    const nextItem = weeklyItems[i - 1] || null; // newer
    fs.writeFileSync(path.join(weeklyDetailDir, `${item.week}.html`), buildWeeklyDetailPage(item, prevItem, nextItem));
    pageCount++;
  });

  // ── 4. Monthly Archive ─────────────────────────────────
  const monthlyArchiveDir = path.join(DIST_DIR, 'archive', 'monthly');
  ensureDir(monthlyArchiveDir);
  fs.writeFileSync(path.join(monthlyArchiveDir, 'index.html'), buildMonthlyArchiveIndex());
  pageCount++;

  // Monthly year pages
  Object.keys(monthlyByYear).forEach(year => {
    const yearDir = path.join(monthlyArchiveDir, year);
    ensureDir(yearDir);
    fs.writeFileSync(path.join(yearDir, 'index.html'), buildMonthlyYearPage(year, monthlyByYear[year]));
    pageCount++;
  });

  // Monthly detail pages
  const monthlyDetailDir = path.join(DIST_DIR, 'monthly');
  ensureDir(monthlyDetailDir);
  monthlyItems.forEach((item, i) => {
    const prevItem = monthlyItems[i + 1] || null;
    const nextItem = monthlyItems[i - 1] || null;
    fs.writeFileSync(path.join(monthlyDetailDir, `${item.month}.html`), buildMonthlyDetailPage(item, prevItem, nextItem));
    pageCount++;
  });

  // ── 5. Search ──────────────────────────────────────────
  const searchDir = path.join(DIST_DIR, 'archive');
  ensureDir(searchDir);
  fs.writeFileSync(path.join(searchDir, 'search.html'), buildSearchPage());
  pageCount++;

  const searchIndex = buildSearchIndex();
  fs.writeFileSync(path.join(DIST_DIR, 'search-index.json'), JSON.stringify(searchIndex));
  console.log(`   Search index: ${searchIndex.items.length} items indexed`);

  // ── 6. Misc ────────────────────────────────────────────
  const cname = path.join(ROOT, 'CNAME');
  if (fs.existsSync(cname)) fs.copyFileSync(cname, path.join(DIST_DIR, 'CNAME'));
  fs.writeFileSync(path.join(DIST_DIR, '.nojekyll'), '');

  console.log(`✅ Build complete!`);
  console.log(`   Daily: ${dailyItems.length} items`);
  console.log(`   Weekly: ${weeklyItems.length} items`);
  console.log(`   Monthly: ${monthlyItems.length} items`);
  console.log(`   Pages generated: ${pageCount}`);
  console.log(`   Output: ${DIST_DIR}`);
}

buildSite();
