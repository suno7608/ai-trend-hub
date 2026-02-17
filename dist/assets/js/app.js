/* ── AI Trend Hub — Client-side App ── */
(function() {
  'use strict';

  // ── Language Toggle ──
  let currentLang = 'ko';
  const langToggle = document.getElementById('langToggle');

  function setLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('.lang-ko').forEach(el => {
      el.style.display = lang === 'ko' ? '' : 'none';
    });
    document.querySelectorAll('.lang-en').forEach(el => {
      el.style.display = lang === 'en' ? '' : 'none';
    });
    if (langToggle) {
      langToggle.querySelector('.lang-active').textContent = lang.toUpperCase();
      langToggle.querySelector('.lang-inactive').textContent = lang === 'ko' ? 'EN' : 'KO';
    }
  }

  if (langToggle) {
    langToggle.addEventListener('click', () => {
      setLanguage(currentLang === 'ko' ? 'en' : 'ko');
    });
  }

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

  // ── Filter Buttons ──
  const filterBtns = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.daily-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      cards.forEach(card => {
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
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  });

  // ── Scroll Spy ──
  const sections = document.querySelectorAll('.content-section');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(l => {
          l.classList.toggle('active', l.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { threshold: 0.3 });

  sections.forEach(s => observer.observe(s));

  // ── Load Sources Data ──
  const sourcesGrid = document.getElementById('sourcesGrid');
  if (sourcesGrid) {
    // Embedded sources from build
    const sources = [
      { name: 'Retail Dive', category: 'AI Commerce', status: 'active' },
      { name: 'commercetools Blog', category: 'AI Commerce', status: 'active' },
      { name: 'Marketing AI Institute', category: 'AI Marketing', status: 'active' },
      { name: 'Adweek', category: 'AI Marketing', status: 'active' },
      { name: 'MIT Technology Review', category: 'AI General', status: 'active' },
      { name: 'Anthropic News', category: 'AI General', status: 'active' },
      { name: 'The Verge (AI)', category: 'AI General', status: 'active' },
      { name: 'Digital Commerce 360', category: 'AI Commerce', status: 'active' },
      { name: 'HubSpot Marketing', category: 'AI Marketing', status: 'active' },
      { name: 'MarTech.org', category: 'AI Marketing', status: 'new' },
      { name: 'Digiday', category: 'AI Marketing', status: 'new' },
      { name: 'Search Engine Land', category: 'AI Marketing', status: 'new' },
      { name: 'Shopify Engineering', category: 'AI Commerce', status: 'active' },
      { name: 'TechCrunch Commerce', category: 'AI Commerce', status: 'new' },
      { name: 'Google AI Blog', category: 'AI General', status: 'active' },
      { name: 'OpenAI Blog', category: 'AI General', status: 'active' },
      { name: 'Salesforce AI Blog', category: 'Platform', status: 'new' },
      { name: 'Adobe Experience Blog', category: 'Platform', status: 'new' },
      { name: 'Segment Blog', category: 'CDP/CRM', status: 'new' },
      { name: 'Bloomreach Blog', category: 'CDP/CRM', status: 'new' },
    ];

    sourcesGrid.innerHTML = sources.map(s => `
      <div class="source-item">
        <div class="source-info">
          <h4>${s.name}</h4>
          <span>${s.category}</span>
        </div>
        <span class="source-status ${s.status}">${s.status === 'active' ? '✅ Active' : '🆕 New'}</span>
      </div>
    `).join('');
  }
})();
