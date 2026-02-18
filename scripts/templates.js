/**
 * AI Trend Hub — Shared HTML Templates v2.0
 * Reusable rendering functions for home, archive, and detail pages
 */

// ── Category Helpers ──────────────────────────────────────
function categoryLabel(cat) {
  const map = {
    commerce: 'Commerce', marketing: 'Marketing', tech: 'Tech', strategy: 'Strategy',
    ai_commerce: 'AI Commerce', ai_marketing: 'AI Marketing', ai_general: 'AI General',
    d2c_dtc: 'D2C/DTC', ce_industry: 'CE Industry', platform_vendor: 'Platform', cdp_crm_clv: 'CDP/CRM'
  };
  return map[cat] || cat;
}

function categoryColor(cat) {
  const map = {
    commerce: '#3B82F6', marketing: '#8B5CF6', tech: '#10B981', strategy: '#F59E0B',
    ai_commerce: '#3B82F6', ai_marketing: '#8B5CF6', ai_general: '#10B981',
    d2c_dtc: '#EC4899', ce_industry: '#6366F1', platform_vendor: '#F97316', cdp_crm_clv: '#14B8A6'
  };
  return map[cat] || '#6B7280';
}

// ── Month/Week Label Helpers ──────────────────────────────
function monthLabelKo(ym) {
  const [y, m] = ym.split('-');
  const months = ['', '1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  return `${y}년 ${months[parseInt(m)]}`;
}

function monthLabelEn(ym) {
  const [y, m] = ym.split('-');
  const months = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[parseInt(m)]} ${y}`;
}

function weekLabel(yw) {
  // yw = "2026-W08"
  return yw;
}

// ── Page Shell ────────────────────────────────────────────
function renderPageShell({ title, bodyContent, cssPath, jsPath, description, canonicalPath, ogType }) {
  const siteUrl = 'https://suno7608.github.io/ai-trend-hub';
  const fullTitle = `${title} — LG AI Trend Hub`;
  const desc = description || 'AI Commerce와 AI Marketing의 최신 트렌드, 뉴스, 인사이트를 한 곳에서.';
  const canonical = canonicalPath ? `${siteUrl}/${canonicalPath}` : siteUrl;
  const faviconPath = cssPath ? cssPath.replace('assets/css/style.css', 'assets/favicon.svg') : 'assets/favicon.svg';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fullTitle}</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${canonical}">

  <!-- Open Graph -->
  <meta property="og:type" content="${ogType || 'website'}">
  <meta property="og:title" content="${fullTitle}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="LG AI Trend Hub">
  <meta property="og:locale" content="ko_KR">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${fullTitle}">
  <meta name="twitter:description" content="${desc}">

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="${faviconPath}">

  <!-- Robots -->
  <meta name="robots" content="index, follow">

  <link rel="stylesheet" href="${cssPath || 'assets/css/style.css'}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <!-- Header -->
  <header class="site-header">
    <div class="container">
      <div class="header-left">
        <h1 class="logo">
          <a href="${cssPath ? cssPath.replace('assets/css/style.css', 'index.html') : 'index.html'}">
            <img class="logo-img" src="${faviconPath}" alt="LG" width="32" height="32">
            <span>LG AI Trend Hub</span>
          </a>
        </h1>
        <p class="tagline lang-ko">AI Commerce & Marketing Intelligence for LG Global DTC members</p>
        <p class="tagline lang-en" style="display:none">AI Commerce & Marketing Intelligence for LG Global DTC members</p>
      </div>
      <div class="header-right">
        <button id="langToggle" class="lang-toggle" title="Toggle Language">
          <span class="lang-active">KO</span> / <span class="lang-inactive">EN</span>
        </button>
        <button id="themeToggle" class="theme-toggle" title="Toggle Theme">🌙</button>
      </div>
    </div>
  </header>

${bodyContent}

  <!-- Footer -->
  <footer class="site-footer">
    <div class="container">
      <p>© 2026 LG AI Trend Hub — LG Global D2C Insight</p>
      <p class="lang-ko">AI Commerce & Marketing Trend Intelligence Hub</p>
      <p class="lang-en" style="display:none">AI Commerce & Marketing Trend Intelligence Hub</p>
    </div>
  </footer>

  <!-- Back to Top -->
  <button id="backToTop" class="back-to-top" title="Back to top">↑</button>

  <script src="${jsPath || 'assets/js/app.js'}"></script>
</body>
</html>`;
}

// ── Breadcrumb ────────────────────────────────────────────
function renderBreadcrumb(trail, baseUrl) {
  // trail = [ { label_ko, label_en, url }, ... ]
  // Last item has no url (current page)
  const items = trail.map((item, i) => {
    const isLast = i === trail.length - 1;
    if (isLast) {
      return `<span class="breadcrumb-current">
        <span class="lang-ko">${item.label_ko}</span>
        <span class="lang-en" style="display:none">${item.label_en}</span>
      </span>`;
    }
    return `<a href="${item.url}" class="breadcrumb-link">
      <span class="lang-ko">${item.label_ko}</span>
      <span class="lang-en" style="display:none">${item.label_en}</span>
    </a>`;
  }).join('<span class="breadcrumb-sep">›</span>');

  return `<nav class="breadcrumb" aria-label="Breadcrumb">${items}</nav>`;
}

// ── Section Navigation (for archive pages) ────────────────
function renderArchiveNav(activePage, baseUrl) {
  const links = [
    { id: 'home', label_ko: '🏠 홈', label_en: '🏠 Home', url: `${baseUrl}index.html` },
    { id: 'search', label_ko: '🔍 통합검색', label_en: '🔍 Search', url: `${baseUrl}archive/search.html` },
    { id: 'daily', label_ko: '📰 Daily', label_en: '📰 Daily', url: `${baseUrl}archive/daily/index.html` },
    { id: 'weekly', label_ko: '📊 Weekly', label_en: '📊 Weekly', url: `${baseUrl}archive/weekly/index.html` },
    { id: 'monthly', label_ko: '📖 Monthly', label_en: '📖 Monthly', url: `${baseUrl}archive/monthly/index.html` },
  ];

  const linksHTML = links.map(l =>
    `<a href="${l.url}" class="nav-link${l.id === activePage ? ' active' : ''}">
      <span class="lang-ko">${l.label_ko}</span>
      <span class="lang-en" style="display:none">${l.label_en}</span>
    </a>`
  ).join('\n      ');

  return `
  <nav class="section-nav">
    <div class="container">
      ${linksHTML}
    </div>
  </nav>`;
}

// ── Prev / Next Navigation ────────────────────────────────
function renderPrevNext({ prev, next, backUrl, backLabelKo, backLabelEn }) {
  const prevHTML = prev
    ? `<a href="${prev.url}" class="prev-next-link prev-link">
        <span class="prev-next-arrow">←</span>
        <span class="prev-next-text">
          <span class="prev-next-label lang-ko">이전</span>
          <span class="prev-next-label lang-en" style="display:none">Previous</span>
          <span class="prev-next-title">${prev.title}</span>
        </span>
      </a>`
    : '<span></span>';

  const nextHTML = next
    ? `<a href="${next.url}" class="prev-next-link next-link">
        <span class="prev-next-text">
          <span class="prev-next-label lang-ko">다음</span>
          <span class="prev-next-label lang-en" style="display:none">Next</span>
          <span class="prev-next-title">${next.title}</span>
        </span>
        <span class="prev-next-arrow">→</span>
      </a>`
    : '<span></span>';

  const backHTML = backUrl
    ? `<div class="prev-next-back">
        <a href="${backUrl}">
          <span class="lang-ko">← ${backLabelKo || '목록으로'}</span>
          <span class="lang-en" style="display:none">← ${backLabelEn || 'Back to list'}</span>
        </a>
      </div>`
    : '';

  return `
  <div class="prev-next-nav">
    ${backHTML}
    <div class="prev-next-row">
      ${prevHTML}
      ${nextHTML}
    </div>
  </div>`;
}

// ── Daily Card ────────────────────────────────────────────
function renderDailyCard(item) {
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
        <time>${item.date_published || ''}</time>
        ${item.confidence ? `<span class="confidence">신뢰도: ${(item.confidence * 100).toFixed(0)}%</span>` : ''}
      </div>
      <div class="social-actions" data-card-id="daily-${item.id || item._filename}">
        <button class="social-btn like-btn" data-action="like" title="좋아요">
          <span class="like-icon">♡</span>
          <span class="like-count">0</span>
        </button>
        <button class="social-btn share-btn" data-action="share" data-title="${(item.title || '').replace(/"/g, '&quot;')}" data-url="${item.canonical_url || ''}" title="공유하기">
          <span class="share-icon">↗</span>
          <span class="lang-ko">공유</span><span class="lang-en" style="display:none">Share</span>
        </button>
      </div>
    </article>`;
}

// ── Weekly Card ───────────────────────────────────────────
function renderWeeklyCard(item, options = {}) {
  const { linkToDetail = false, detailUrl = '' } = options;
  const titleHTML = linkToDetail
    ? `<a href="${detailUrl}">${item.title || `Week ${item.week} Digest`}</a>`
    : (item.title || `Week ${item.week} Digest`);
  const titleEnHTML = linkToDetail
    ? `<a href="${detailUrl}">${item.title_en || `Week ${item.week} Digest`}</a>`
    : (item.title_en || `Week ${item.week} Digest`);

  return `
    <article class="card weekly-card">
      <div class="card-header">
        <span class="badge badge-weekly">📊 Weekly Digest</span>
        <time>${item.week || item.date_published || ''}</time>
      </div>
      <div class="card-title">
        <span class="lang-ko">${titleHTML}</span>
        <span class="lang-en" style="display:none">${titleEnHTML}</span>
      </div>
      ${options.showBody !== false ? `<div class="card-body">${item._body || ''}</div>` : ''}
      <div class="social-actions" data-card-id="weekly-${item.week || item._filename}">
        <button class="social-btn like-btn" data-action="like" title="좋아요">
          <span class="like-icon">♡</span>
          <span class="like-count">0</span>
        </button>
        <button class="social-btn share-btn" data-action="share" data-title="${(item.title || '').replace(/"/g, '&quot;')}" data-url="" title="공유하기">
          <span class="share-icon">↗</span>
          <span class="lang-ko">공유</span><span class="lang-en" style="display:none">Share</span>
        </button>
      </div>
    </article>`;
}

// ── Monthly Card ──────────────────────────────────────────
function renderMonthlyCard(item, options = {}) {
  const { linkToDetail = false, detailUrl = '' } = options;
  const titleHTML = linkToDetail
    ? `<a href="${detailUrl}">${item.title || `${item.month} Deep Dive`}</a>`
    : (item.title || `${item.month} Deep Dive`);
  const titleEnHTML = linkToDetail
    ? `<a href="${detailUrl}">${item.title_en || `${item.month} Deep Dive`}</a>`
    : (item.title_en || `${item.month} Deep Dive`);

  return `
    <article class="card monthly-card">
      <div class="card-header">
        <span class="badge badge-monthly">📖 Monthly Deep Dive</span>
        <time>${item.month || item.date_published || ''}</time>
      </div>
      <div class="card-title">
        <span class="lang-ko">${titleHTML}</span>
        <span class="lang-en" style="display:none">${titleEnHTML}</span>
      </div>
      ${options.showBody !== false ? `<div class="card-body">${item._body || ''}</div>` : ''}
      <div class="social-actions" data-card-id="monthly-${item.month || item._filename}">
        <button class="social-btn like-btn" data-action="like" title="좋아요">
          <span class="like-icon">♡</span>
          <span class="like-count">0</span>
        </button>
        <button class="social-btn share-btn" data-action="share" data-title="${(item.title || '').replace(/"/g, '&quot;')}" data-url="" title="공유하기">
          <span class="share-icon">↗</span>
          <span class="lang-ko">공유</span><span class="lang-en" style="display:none">Share</span>
        </button>
      </div>
    </article>`;
}

// ── Archive Index Card (for month/year selection) ─────────
function renderArchiveIndexCard({ label_ko, label_en, count, url, icon }) {
  return `
    <a href="${url}" class="archive-item">
      <div class="archive-item-icon">${icon || '📁'}</div>
      <div class="archive-item-info">
        <h3>
          <span class="lang-ko">${label_ko}</span>
          <span class="lang-en" style="display:none">${label_en}</span>
        </h3>
        <span class="archive-item-count">${count}
          <span class="lang-ko">건</span>
          <span class="lang-en" style="display:none"> items</span>
        </span>
      </div>
      <span class="archive-item-arrow">→</span>
    </a>`;
}

// ── Archive Grid Wrapper ──────────────────────────────────
function renderArchiveGrid(cardsHTML) {
  return `<div class="archive-grid">${cardsHTML}</div>`;
}

// ── Weekly Summary Card (compact, for archive listing) ────
function renderWeeklyListCard(item, detailUrl) {
  const topTrends = (item.top_trends || []).slice(0, 3);
  const trendsHTML = topTrends.length
    ? `<div class="archive-list-tags">${topTrends.map(t => `<span class="tag tag-sub">${typeof t === 'string' ? t : t.title || t}</span>`).join('')}</div>`
    : '';

  return `
    <a href="${detailUrl}" class="archive-list-item">
      <div class="archive-list-meta">
        <span class="badge badge-weekly">📊 ${item.week}</span>
      </div>
      <h3 class="archive-list-title">
        <span class="lang-ko">${item.title || `Week ${item.week} Digest`}</span>
        <span class="lang-en" style="display:none">${item.title_en || `Week ${item.week} Digest`}</span>
      </h3>
      ${trendsHTML}
      <span class="archive-list-arrow">→</span>
    </a>`;
}

// ── Monthly Summary Card (compact, for archive listing) ───
function renderMonthlyListCard(item, detailUrl) {
  const reports = (item.featured_reports || []).slice(0, 5);
  const reportsHTML = reports.length
    ? `<ul class="monthly-report-list">${reports.map(r => `<li>${typeof r === 'string' ? r : r}</li>`).join('')}</ul>`
    : '';

  return `
    <a href="${detailUrl}" class="archive-list-item monthly-list-item">
      <div class="monthly-list-header">
        <span class="badge badge-monthly">📖 ${item.month}</span>
        <span class="archive-list-arrow">→</span>
      </div>
      <h3 class="archive-list-title monthly-list-title">
        <span class="lang-ko">${item.title || `${item.month} Deep Dive`}</span>
        <span class="lang-en" style="display:none">${item.title_en || `${item.month} Deep Dive`}</span>
      </h3>
      ${reportsHTML}
    </a>`;
}

// ── Archive Search Bar ────────────────────────────────────
function renderArchiveSearch() {
  return `
    <div class="archive-search-container">
      <div class="search-wrapper">
        <span class="search-icon">🔍</span>
        <input type="text" id="archiveSearchInput" class="search-input archive-search-input"
          placeholder="🔍 아카이브 검색...">
      </div>
      <div id="archiveSearchCount" class="search-results-count"></div>
    </div>`;
}

module.exports = {
  categoryLabel,
  categoryColor,
  monthLabelKo,
  monthLabelEn,
  weekLabel,
  renderPageShell,
  renderBreadcrumb,
  renderArchiveNav,
  renderPrevNext,
  renderDailyCard,
  renderWeeklyCard,
  renderMonthlyCard,
  renderArchiveIndexCard,
  renderArchiveGrid,
  renderWeeklyListCard,
  renderMonthlyListCard,
  renderArchiveSearch,
};
