(() => {
  'use strict';

  const DURATION = 1100;

  const sections = Array.from(document.querySelectorAll('.section'));
  const navLinks = document.querySelectorAll('.nav-links a, .side-nav .dot, .mobile-nav a, .nav-logo');
  const progressBar = document.querySelector('.nav-progress-bar');
  const cursorGlow = document.querySelector('.cursor-glow');
  const keyboardHint = document.querySelector('.keyboard-hint');
  const backdrop = document.querySelector('.zoom-backdrop');

  let isNavigating = false;
  let navigationTimer = null;
  let expandedSubpart = null;
  let isAnimating = false;

  function isZoomActive() {
    return expandedSubpart !== null;
  }

  function computeFlip(rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return {
      tx: cx - vw / 2,
      ty: cy - vh / 2,
      sx: Math.max(rect.width / vw, 0.08),
      sy: Math.max(rect.height / vh, 0.08),
      radius: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--radius')) || 20,
    };
  }

  function setFlipTransform(detail, flip, radius) {
    detail.style.borderRadius = `${radius}px`;
    detail.style.transform = `translate3d(${flip.tx}px, ${flip.ty}px, 0) scale(${flip.sx}, ${flip.sy})`;
  }

  function clearFlipStyles(detail) {
    detail.style.transform = '';
    detail.style.transition = '';
    detail.style.borderRadius = '';
  }

  function triggerPageReveal(detail) {
    detail.querySelectorAll('.page-reveal').forEach((el, i) => {
      el.style.setProperty('--reveal-delay', `${0.15 + i * 0.07}s`);
      el.classList.add('is-revealed');
    });
  }

  function resetPageReveal(detail) {
    detail.querySelectorAll('.page-reveal').forEach((el) => {
      el.classList.remove('is-revealed');
    });
  }

  function finishCollapse(subpart) {
    const preview = subpart.querySelector('.subpart-preview');
    const detail = subpart.querySelector('.subpart-detail');
    const section = subpart.closest('.section');

    detail.classList.remove('is-open', 'is-visible', 'is-animating');
    detail.hidden = true;
    clearFlipStyles(detail);
    resetPageReveal(detail);

    subpart.classList.remove('is-expanded');
    section.classList.remove('has-expanded');
    preview.setAttribute('aria-expanded', 'false');

    document.body.classList.remove('is-subpart-zoomed');
    backdrop.classList.remove('is-visible');

    expandedSubpart = null;
    isAnimating = false;
  }

  function collapseSubpart(animate = true) {
    if (!expandedSubpart || isAnimating) return;

    const subpart = expandedSubpart;
    const preview = subpart.querySelector('.subpart-preview');
    const detail = subpart.querySelector('.subpart-detail');

    if (!animate) {
      finishCollapse(subpart);
      return;
    }

    isAnimating = true;
    const flip = computeFlip(preview.getBoundingClientRect());

    detail.classList.remove('is-open');
    detail.classList.add('is-animating');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFlipTransform(detail, flip, flip.radius);
      });
    });

    backdrop.classList.remove('is-visible');

    setTimeout(() => finishCollapse(subpart), DURATION);
  }

  function expandSubpart(subpart) {
    if (isAnimating) return;

    if (expandedSubpart === subpart) {
      collapseSubpart(true);
      return;
    }

    if (expandedSubpart) finishCollapse(expandedSubpart);

    const preview = subpart.querySelector('.subpart-preview');
    const detail = subpart.querySelector('.subpart-detail');
    const section = subpart.closest('.section');
    const flip = computeFlip(preview.getBoundingClientRect());

    isAnimating = true;
    expandedSubpart = subpart;

    detail.hidden = false;
    detail.classList.add('is-visible');
    detail.classList.remove('is-open');

    setFlipTransform(detail, flip, flip.radius);

    section.classList.add('has-expanded');
    subpart.classList.add('is-expanded');
    preview.setAttribute('aria-expanded', 'true');
    document.body.classList.add('is-subpart-zoomed');

    requestAnimationFrame(() => {
      backdrop.classList.add('is-visible');
      detail.classList.add('is-animating');

      requestAnimationFrame(() => {
        detail.style.borderRadius = '0px';
        detail.style.transform = 'translate3d(0, 0, 0) scale(1)';
        detail.classList.add('is-open');
      });
    });

    setTimeout(() => {
      detail.classList.remove('is-animating');
      triggerPageReveal(detail);
      isAnimating = false;
    }, DURATION);
  }

  document.querySelectorAll('.subpart-preview').forEach((preview) => {
    const subpart = preview.closest('.subpart');
    preview.addEventListener('click', () => expandSubpart(subpart));
    preview.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        expandSubpart(subpart);
      }
    });
  });

  document.querySelectorAll('.detail-close, .page-shrink').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      collapseSubpart(true);
    });
  });

  backdrop.addEventListener('click', () => collapseSubpart(true));

  function getActiveSectionIndex() {
    if (isZoomActive()) return sections.indexOf(expandedSubpart.closest('.section'));

    const marker = window.scrollY + window.innerHeight * 0.35;
    let index = 0;
    let minDistance = Infinity;
    sections.forEach((section, i) => {
      const d = Math.abs(section.offsetTop - marker);
      if (d < minDistance) { minDistance = d; index = i; }
    });
    return index;
  }

  function setActiveSection(index) {
    const section = sections[index];
    if (!section) return;
    const color = section.dataset.color || '#FF4D00';
    navLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (href?.startsWith('#')) link.classList.toggle('active', href === `#${section.id}`);
    });
    if (progressBar) progressBar.style.background = color;
    document.documentElement.style.setProperty('--accent', color);
  }

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      if (isZoomActive()) return;
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActiveSection(sections.indexOf(entry.target));
      });
    },
    { threshold: 0.35 }
  );
  sections.forEach((s) => sectionObserver.observe(s));

  function updateProgress() {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    if (progressBar) progressBar.style.width = `${h > 0 ? (window.scrollY / h) * 100 : 0}%`;
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  function goToSection(index, behavior = 'smooth') {
    if (isZoomActive()) collapseSubpart(true);
    const target = sections[Math.max(0, Math.min(index, sections.length - 1))];
    if (!target) return;
    isNavigating = true;
    clearTimeout(navigationTimer);
    setActiveSection(sections.indexOf(target));
    target.scrollIntoView({ behavior, block: 'start' });
    navigationTimer = setTimeout(() => { isNavigating = false; }, behavior === 'smooth' ? 700 : 50);
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href?.startsWith('#')) return;
      e.preventDefault();
      const t = document.querySelector(href);
      if (t) goToSection(sections.indexOf(t));
    });
  });

  function handleKeyboard(e) {
    if (e.target.matches('input, textarea, select, [contenteditable="true"]')) return;
    if (e.key === 'Escape' && isZoomActive()) { e.preventDefault(); collapseSubpart(true); return; }
    if (isZoomActive()) return;

    const next = ['ArrowDown', 'ArrowRight', 'PageDown'];
    const prev = ['ArrowUp', 'ArrowLeft', 'PageUp'];

    if (e.key === 'Home') { e.preventDefault(); goToSection(0); return; }
    if (e.key === 'End') { e.preventDefault(); goToSection(sections.length - 1); return; }
    if (e.key === ' ' && !e.shiftKey) { e.preventDefault(); if (!isNavigating) goToSection(getActiveSectionIndex() + 1); return; }
    if (e.key === ' ' && e.shiftKey) { e.preventDefault(); if (!isNavigating) goToSection(getActiveSectionIndex() - 1); return; }
    if (next.includes(e.key)) { e.preventDefault(); if (!isNavigating) goToSection(getActiveSectionIndex() + 1); return; }
    if (prev.includes(e.key)) { e.preventDefault(); if (!isNavigating) goToSection(getActiveSectionIndex() - 1); }
  }

  document.addEventListener('keydown', handleKeyboard);

  if (cursorGlow && window.matchMedia('(pointer: fine)').matches) {
    let raf;
    document.addEventListener('mousemove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        cursorGlow.style.left = `${e.clientX}px`;
        cursorGlow.style.top = `${e.clientY}px`;
      });
    });
  }

  window.addEventListener('load', () => setActiveSection(0));
  window.addEventListener('resize', () => {
    if (isZoomActive() && !isAnimating) collapseSubpart(false);
  }, { passive: true });
})();
