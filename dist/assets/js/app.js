/* ══════════════════════════════════════════════════
   AI Trend Hub — Client App v2.0
   Search, Filters, Language, Theme, Back-to-top
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';

  // ── Language Toggle ──
  let currentLang = 'ko';
  const langToggle = document.getElementById('langToggle');

  function setLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('.lang-ko').forEach(el => el.style.display = lang === 'ko' ? '' : 'none');
    document.querySelectorAll('.lang-en').forEach(el => el.style.display = lang === 'en' ? '' : 'none');
    if (langToggle) {
      langToggle.querySelector('.lang-active').textContent = lang.toUpperCase();
      langToggle.querySelector('.lang-inactive').textContent = lang === 'ko' ? 'EN' : 'KO';
    }
    // Update search placeholder
    const si = document.getElementById('searchInput');
    if (si) si.placeholder = lang === 'ko' ? '🔍 키워드, 태그, 소스로 검색...' : '🔍 Search by keyword, tag, source...';
  }

  if (langToggle) langToggle.addEventListener('click', () => {
    const newLang = currentLang === 'ko' ? 'en' : 'ko';
    setLanguage(newLang);
    try { localStorage.setItem(LANG_KEY, newLang); } catch {}
  });

  // ── Theme Toggle (persists across pages) ──
  const THEME_KEY = 'ai-trend-hub-theme';
  const themeToggle = document.getElementById('themeToggle');
  let isDark = true;
  try { isDark = (localStorage.getItem(THEME_KEY) || 'dark') === 'dark'; } catch {}
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  if (themeToggle) {
    themeToggle.textContent = isDark ? '🌙' : '☀️';
    themeToggle.addEventListener('click', () => {
      isDark = !isDark;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      themeToggle.textContent = isDark ? '🌙' : '☀️';
      try { localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light'); } catch {}
    });
  }

  // ── Language Toggle (persists across pages) ──
  const LANG_KEY = 'ai-trend-hub-lang';
  try { const saved = localStorage.getItem(LANG_KEY); if (saved) currentLang = saved; } catch {}
  setLanguage(currentLang);

  // ── Search ──
  const searchInput = document.getElementById('searchInput');
  const searchCount = document.getElementById('searchResultsCount');
  const allCards = document.querySelectorAll('.daily-card');

  function performSearch() {
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
    let visible = 0;

    allCards.forEach(card => {
      if (!query) {
        card.style.display = '';
        visible++;
        return;
      }
      const text = card.textContent.toLowerCase();
      const tags = (card.dataset.tags || '').toLowerCase();
      const cats = (card.dataset.categories || '').toLowerCase();
      const match = text.includes(query) || tags.includes(query) || cats.includes(query);
      card.style.display = match ? '' : 'none';
      if (match) visible++;
    });

    if (searchCount) {
      if (query) {
        searchCount.textContent = currentLang === 'ko'
          ? `"${query}" 검색 결과: ${visible}건`
          : `${visible} results for "${query}"`;
        searchCount.classList.add('visible');
      } else {
        searchCount.classList.remove('visible');
      }
    }
  }

  if (searchInput) {
    let debounce;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(performSearch, 200);
    });
  }

  // ── Filter Buttons ──
  const filterBtns = document.querySelectorAll('.filter-btn');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Clear search when filter changes
      if (searchInput) searchInput.value = '';
      if (searchCount) searchCount.classList.remove('visible');

      allCards.forEach(card => {
        if (filter === 'all') {
          card.style.display = '';
        } else {
          const cats = card.dataset.categories || '';
          card.style.display = cats.includes(filter) ? '' : 'none';
        }
      });
    });
  });

  // ── Smooth Scroll Navigation (anchor links only) ──
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    // Only intercept anchor links (#daily, #weekly, etc.), not page URLs
    if (href && href.startsWith('#')) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          const navHeight = document.querySelector('.section-nav')?.offsetHeight || 0;
          const y = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 8;
          window.scrollTo({ top: y, behavior: 'smooth' });
          navLinks.forEach(l => l.classList.remove('active'));
          link.classList.add('active');
        }
      });
    }
    // Non-anchor links (archive pages) work normally as <a> tags
  });

  // ── Scroll Spy (only on pages with sections) ──
  const sections = document.querySelectorAll('.content-section[id]');
  if (sections.length > 1) {
    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === `#${id}`));
        }
      });
    }, { threshold: 0.2, rootMargin: '-80px 0px -50% 0px' });
    sections.forEach(s => navObserver.observe(s));
  }

  // ── Back to Top ──
  const backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      backToTop.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // ── Like & Share ──
  const LIKES_KEY = 'ai-trend-hub-likes';

  function getLikes() {
    try { return JSON.parse(localStorage.getItem(LIKES_KEY) || '{}'); } catch { return {}; }
  }

  function saveLikes(likes) {
    try { localStorage.setItem(LIKES_KEY, JSON.stringify(likes)); } catch {}
  }

  // Restore saved likes on page load
  function restoreLikes() {
    const likes = getLikes();
    document.querySelectorAll('.social-actions').forEach(bar => {
      const cardId = bar.dataset.cardId;
      if (likes[cardId]) {
        const btn = bar.querySelector('.like-btn');
        const icon = btn.querySelector('.like-icon');
        const count = btn.querySelector('.like-count');
        btn.classList.add('liked');
        icon.textContent = '♥';
        count.textContent = likes[cardId];
      }
    });
  }
  restoreLikes();

  // Share toast element
  const shareToast = document.createElement('div');
  shareToast.className = 'share-toast';
  document.body.appendChild(shareToast);

  function showToast(msg) {
    shareToast.textContent = msg;
    shareToast.classList.add('visible');
    setTimeout(() => shareToast.classList.remove('visible'), 2000);
  }

  // Event delegation for like & share
  document.addEventListener('click', (e) => {
    const likeBtn = e.target.closest('.like-btn');
    if (likeBtn) {
      const bar = likeBtn.closest('.social-actions');
      const cardId = bar.dataset.cardId;
      const likes = getLikes();
      const icon = likeBtn.querySelector('.like-icon');
      const count = likeBtn.querySelector('.like-count');

      if (likeBtn.classList.contains('liked')) {
        // Unlike
        likeBtn.classList.remove('liked');
        likes[cardId] = Math.max(0, (likes[cardId] || 1) - 1);
        if (likes[cardId] === 0) delete likes[cardId];
        icon.textContent = '♡';
      } else {
        // Like
        likeBtn.classList.add('liked');
        likes[cardId] = (likes[cardId] || 0) + 1;
        icon.textContent = '♥';
      }
      count.textContent = likes[cardId] || 0;
      saveLikes(likes);
      return;
    }

    const shareBtn = e.target.closest('.share-btn');
    if (shareBtn) {
      const title = shareBtn.dataset.title || 'LG AI Trend Hub';
      const url = shareBtn.dataset.url || window.location.href;
      const shareUrl = url || window.location.href;

      // Try Web Share API first (mobile-friendly)
      if (navigator.share) {
        navigator.share({ title, url: shareUrl }).catch(() => {});
      } else {
        // Fallback: copy link to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
          shareBtn.classList.add('copied');
          showToast(currentLang === 'ko' ? '링크가 복사되었습니다!' : 'Link copied to clipboard!');
          setTimeout(() => shareBtn.classList.remove('copied'), 2000);
        }).catch(() => {
          // Final fallback
          const ta = document.createElement('textarea');
          ta.value = shareUrl;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          showToast(currentLang === 'ko' ? '링크가 복사되었습니다!' : 'Link copied to clipboard!');
        });
      }
      return;
    }
  });

  // ── Global Archive Search (search page only) ──
  const globalSearchInput = document.getElementById('globalSearchInput');
  const searchResults = document.getElementById('searchResults');
  const searchStats = document.getElementById('searchStats');

  if (globalSearchInput && searchResults) {
    let searchIndex = null;
    let activeType = 'all';
    let activeCat = 'all';
    let activeSort = 'relevance';

    // Load search index
    const basePath = (document.querySelector('link[rel="stylesheet"]')?.href || '').split('assets/')[0] || '../';
    const indexUrl = new URL('search-index.json', window.location.href.replace(/archive\/search\.html.*$/, ''));

    fetch(indexUrl).then(r => r.json()).then(data => {
      searchIndex = data;
      // Check URL params for initial query
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      if (q) {
        globalSearchInput.value = q;
        performGlobalSearch();
      }
    }).catch(() => {
      searchResults.innerHTML = '<p class="empty-state">검색 인덱스를 불러올 수 없습니다.</p>';
    });

    // Type filters
    document.querySelectorAll('.search-filter-btn[data-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.search-filter-btn[data-type]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeType = btn.dataset.type;
        performGlobalSearch();
      });
    });

    // Category filters
    document.querySelectorAll('.search-filter-btn[data-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.search-filter-btn[data-cat]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCat = btn.dataset.cat;
        performGlobalSearch();
      });
    });

    // Sort buttons
    document.querySelectorAll('.search-filter-btn[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.search-filter-btn[data-sort]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeSort = btn.dataset.sort;
        performGlobalSearch();
      });
    });

    function highlightText(text, query) {
      if (!query) return text;
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="search-highlight">$1</mark>');
    }

    function scoreItem(item, query) {
      const q = query.toLowerCase();
      let score = 0;
      if ((item.title || '').toLowerCase().includes(q)) score += 10;
      if ((item.title_en || '').toLowerCase().includes(q)) score += 8;
      if ((item.summary_ko || '').toLowerCase().includes(q)) score += 5;
      if ((item.summary_en || '').toLowerCase().includes(q)) score += 5;
      if ((item.so_what_ko || '').toLowerCase().includes(q)) score += 3;
      if ((item.so_what_en || '').toLowerCase().includes(q)) score += 3;
      if ((item.tags || []).some(t => t.toLowerCase().includes(q))) score += 6;
      if ((item.source || '').toLowerCase().includes(q)) score += 4;
      if ((item.body_text || '').toLowerCase().includes(q)) score += 2;
      if ((item.categories || []).some(c => c.toLowerCase().includes(q))) score += 4;
      return score;
    }

    function typeBadge(type) {
      const map = {
        daily: '<span class="search-result-type type-daily">📰 Daily</span>',
        weekly: '<span class="search-result-type type-weekly">📊 Weekly</span>',
        monthly: '<span class="search-result-type type-monthly">📖 Monthly</span>'
      };
      return map[type] || '';
    }

    function renderResultCard(item, query) {
      const title = highlightText(item.title || '', query);
      const titleEn = highlightText(item.title_en || '', query);
      const summary = item.summary_ko
        ? highlightText((item.summary_ko || '').slice(0, 200), query)
        : highlightText((item.body_text || '').slice(0, 200), query);
      const summaryEn = item.summary_en
        ? highlightText((item.summary_en || '').slice(0, 200), query)
        : '';

      const cats = (item.categories || []).map(c =>
        `<span class="tag tag-sub">${c}</span>`
      ).join('');
      const tags = (item.tags || []).slice(0, 5).map(t =>
        `<span class="tag tag-sub">${highlightText(t, query)}</span>`
      ).join('');

      const soWhat = item.so_what_ko
        ? `<div class="search-result-sowhat"><strong>💡 So What:</strong> ${highlightText(item.so_what_ko.slice(0, 150), query)}...</div>`
        : '';

      const pageUrl = item.page_url ? `../${item.page_url}` : '#';
      const sourceHtml = item.source ? `<span class="source-badge">${highlightText(item.source, query)}</span>` : '';

      return `
        <a href="${pageUrl}" class="search-result-card" data-type="${item.type}">
          <div class="search-result-header">
            ${typeBadge(item.type)}
            ${sourceHtml}
            <time>${item.date}</time>
          </div>
          <h3 class="search-result-title">
            <span class="lang-ko">${title}</span>
            <span class="lang-en" style="display:none">${titleEn || title}</span>
          </h3>
          <div class="search-result-summary">
            <span class="lang-ko">${summary}${summary.length >= 200 ? '...' : ''}</span>
            <span class="lang-en" style="display:none">${summaryEn || summary}${(summaryEn || summary).length >= 200 ? '...' : ''}</span>
          </div>
          ${soWhat}
          <div class="search-result-tags">${cats}${tags}</div>
        </a>`;
    }

    function performGlobalSearch() {
      if (!searchIndex) return;
      const query = globalSearchInput.value.trim();

      if (!query) {
        searchResults.innerHTML = `
          <div class="search-initial-state">
            <div class="search-initial-icon">🔮</div>
            <p class="lang-ko">Daily · Weekly · Monthly 전체 콘텐츠를 검색할 수 있습니다.</p>
            <p class="lang-en" style="display:none">Search across all Daily · Weekly · Monthly content.</p>
            <div class="search-initial-hints">
              <span class="lang-ko">예시: agentic commerce, D2C, AI 마케팅, McKinsey</span>
              <span class="lang-en" style="display:none">Examples: agentic commerce, D2C, AI marketing, McKinsey</span>
            </div>
          </div>`;
        searchStats.innerHTML = '';
        // Re-apply current language
        setLanguage(currentLang);
        return;
      }

      // Filter by type
      let results = searchIndex.items.filter(item => {
        if (activeType !== 'all' && item.type !== activeType) return false;
        if (activeCat !== 'all' && !(item.categories || []).includes(activeCat)) return false;
        return true;
      });

      // Score and filter by query
      results = results.map(item => ({ ...item, _score: scoreItem(item, query) }))
        .filter(item => item._score > 0);

      // Sort
      if (activeSort === 'relevance') {
        results.sort((a, b) => b._score - a._score);
      } else if (activeSort === 'newest') {
        results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      } else if (activeSort === 'oldest') {
        results.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      }

      // Render stats
      const dailyCount = results.filter(r => r.type === 'daily').length;
      const weeklyCount = results.filter(r => r.type === 'weekly').length;
      const monthlyCount = results.filter(r => r.type === 'monthly').length;

      searchStats.innerHTML = currentLang === 'ko'
        ? `<strong>"${query}"</strong> 검색 결과 <strong>${results.length}</strong>건 — Daily ${dailyCount} · Weekly ${weeklyCount} · Monthly ${monthlyCount}`
        : `<strong>${results.length}</strong> results for <strong>"${query}"</strong> — Daily ${dailyCount} · Weekly ${weeklyCount} · Monthly ${monthlyCount}`;

      // Render results
      if (results.length === 0) {
        searchResults.innerHTML = `
          <div class="search-empty-state">
            <div class="search-empty-icon">🔍</div>
            <p class="lang-ko">"${query}"에 대한 검색 결과가 없습니다.</p>
            <p class="lang-en" style="display:none">No results found for "${query}".</p>
            <div class="search-empty-tips">
              <p class="lang-ko">다른 키워드로 검색하거나, 필터를 변경해 보세요.</p>
              <p class="lang-en" style="display:none">Try different keywords or change the filters.</p>
            </div>
          </div>`;
      } else {
        searchResults.innerHTML = results.map(item => renderResultCard(item, query)).join('');
      }

      // Re-apply current language to new DOM
      setLanguage(currentLang);
    }

    let globalDebounce;
    globalSearchInput.addEventListener('input', () => {
      clearTimeout(globalDebounce);
      globalDebounce = setTimeout(performGlobalSearch, 250);
    });

    // Enter key support
    globalSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(globalDebounce);
        performGlobalSearch();
      }
    });

    // Update placeholder on lang change
    globalSearchInput.placeholder = currentLang === 'ko'
      ? '키워드로 Daily, Weekly, Monthly 전체 콘텐츠를 검색하세요...'
      : 'Search across all Daily, Weekly, Monthly content...';
  }

  // ── Sources Grid ──
  const sourcesGrid = document.getElementById('sourcesGrid');
  if (sourcesGrid) {
    const sources = [
      { name: 'Retail Dive', category: 'AI Commerce', status: 'active', url: 'https://www.retaildive.com' },
      { name: 'commercetools Blog', category: 'AI Commerce', status: 'active', url: 'https://commercetools.com/blog' },
      { name: 'Digital Commerce 360', category: 'AI Commerce', status: 'active', url: 'https://www.digitalcommerce360.com' },
      { name: 'Shopify Engineering', category: 'AI Commerce', status: 'active', url: 'https://shopify.engineering' },
      { name: 'TechCrunch Commerce', category: 'AI Commerce', status: 'new', url: 'https://techcrunch.com/category/commerce/' },
      { name: 'Marketing AI Institute', category: 'AI Marketing', status: 'active', url: 'https://www.marketingaiinstitute.com' },
      { name: 'Adweek', category: 'AI Marketing', status: 'active', url: 'https://www.adweek.com' },
      { name: 'HubSpot Marketing', category: 'AI Marketing', status: 'active', url: 'https://blog.hubspot.com/marketing' },
      { name: 'MarTech.org', category: 'AI Marketing', status: 'new', url: 'https://martech.org' },
      { name: 'Digiday', category: 'AI Marketing', status: 'new', url: 'https://digiday.com' },
      { name: 'Search Engine Land', category: 'AI Marketing', status: 'new', url: 'https://searchengineland.com' },
      { name: 'Klaviyo Blog', category: 'AI Marketing', status: 'new', url: 'https://www.klaviyo.com/blog' },
      { name: 'MIT Technology Review', category: 'AI General', status: 'active', url: 'https://www.technologyreview.com' },
      { name: 'The Verge (AI)', category: 'AI General', status: 'active', url: 'https://www.theverge.com/ai-artificial-intelligence' },
      { name: 'Anthropic News', category: 'AI General', status: 'active', url: 'https://www.anthropic.com/news' },
      { name: 'Google AI Blog', category: 'AI General', status: 'active', url: 'https://blog.google/technology/ai/' },
      { name: 'OpenAI Blog', category: 'AI General', status: 'active', url: 'https://openai.com/blog' },
      { name: 'Salesforce AI Blog', category: 'Platform', status: 'new', url: 'https://www.salesforce.com/blog/category/ai/' },
      { name: 'Adobe Experience Blog', category: 'Platform', status: 'new', url: 'https://business.adobe.com/blog' },
      { name: 'Segment Blog', category: 'CDP/CRM', status: 'new', url: 'https://segment.com/blog/' },
      { name: 'Bloomreach Blog', category: 'CDP/CRM', status: 'new', url: 'https://www.bloomreach.com/en/blog' },
      { name: 'Forrester DTC Blog', category: 'D2C/DTC', status: 'new', url: 'https://www.forrester.com/blogs/category/direct-to-consumer-dtc/' },
    ];
    sourcesGrid.innerHTML = sources.map(s => `
      <div class="source-item">
        <div class="source-info">
          <h4>${s.name}</h4>
          <span>${s.category}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <a href="${s.url}" target="_blank" rel="noopener" class="source-link">Visit →</a>
          <span class="source-status ${s.status}">${s.status === 'active' ? '✅ Active' : '🆕 New'}</span>
        </div>
      </div>
    `).join('');
  }
})();
