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

  if (langToggle) langToggle.addEventListener('click', () => setLanguage(currentLang === 'ko' ? 'en' : 'ko'));

  // ── Theme Toggle ──
  const themeToggle = document.getElementById('themeToggle');
  let isDark = true;

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      isDark = !isDark;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      themeToggle.textContent = isDark ? '🌙' : '☀️';
    });
  }

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

  // ── Smooth Scroll Navigation ──
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        const navHeight = document.querySelector('.section-nav')?.offsetHeight || 0;
        const y = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 8;
        window.scrollTo({ top: y, behavior: 'smooth' });
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  });

  // ── Scroll Spy ──
  const sections = document.querySelectorAll('.content-section');
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === `#${id}`));
      }
    });
  }, { threshold: 0.2, rootMargin: '-80px 0px -50% 0px' });
  sections.forEach(s => navObserver.observe(s));

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
