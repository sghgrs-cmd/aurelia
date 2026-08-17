/**
 * ============================================================
 * AURELIA SMILE ATELIER — engine.js
 * Senior UI/UX Engine | Beverly Hills Design Agency
 *
 * Modules:
 *  1.  Noise Overlay
 *  2.  Custom Cursor (Lerp)
 *  3.  Magnetic Buttons
 *  4.  SPA Router
 *  5.  Navigation
 *  6.  Scroll Reveals (IntersectionObserver + kinetic typography)
 *  7.  Marquee
 *  8.  Treatment Calculator (rAF number animation)
 *  9.  Multi-Step Booking Form
 * 10.  Video Modal
 * 11.  Sticky-Scroll Studio
 * 12.  Init Orchestrator
 * ============================================================
 */

'use strict';

/* ── CONSTANTS ─────────────────────────────────────────── */
const LERP_FACTOR   = 0.15;    // ring follow speed
const MAGNET_RANGE  = 96;      // px radius for magnetic pull
const MAGNET_PULL   = 0.38;    // shell displacement factor
const MAGNET_TEXT   = 0.18;    // inner text parallax factor
const STAGGER_WORD  = 30;      // ms delay per word in reveal
const STAGGER_CHAR  = 18;      // ms delay per char in reveal
const CALC_DURATION = 600;     // ms for price counter animation
const WIPE_DURATION = 720;     // ms for full page wipe in+out

/* ── REDUCED MOTION GATE ────────────────────────────────── */
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

/* ═══════════════════════════════════════════════════════════
   1. NOISE OVERLAY
   Injects an SVG feTurbulence filter as a background on the
   fixed .noise-overlay element for tactile paper texture.
   ═══════════════════════════════════════════════════════════ */
function initNoise() {
  let el = document.querySelector('.noise-overlay');
  if (!el) {
    el = document.createElement('div');
    el.className = 'noise-overlay';
    document.body.insertAdjacentElement('afterbegin', el);
  }

  // Encode the SVG as a data URI so no external fetch is needed
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>
    <filter id='noise'>
      <feTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4'
                    stitchTiles='stitch' result='noiseOut'/>
      <feColorMatrix type='saturate' values='0' in='noiseOut'/>
    </filter>
    <rect width='300' height='300' filter='url(#noise)' opacity='1'/>
  </svg>`;

  const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  el.style.backgroundImage = `url("${encoded}")`;
  el.style.backgroundRepeat = 'repeat';
  el.style.backgroundSize = '300px 300px';
}

/* ═══════════════════════════════════════════════════════════
   2. CUSTOM CURSOR — Lerp Ring + Instant Dot
   Dot tracks exact mouse position via transform.
   Ring lags behind using linear interpolation each rAF frame.
   ═══════════════════════════════════════════════════════════ */
const Cursor = (() => {
  if (prefersReducedMotion) return { init() {} };

  let dot, ring;
  let mouseX = window.innerWidth  / 2;
  let mouseY = window.innerHeight / 2;
  let ringX  = mouseX;
  let ringY  = mouseY;
  let rafId  = null;
  let isHovering = false;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function loop() {
    ringX = lerp(ringX, mouseX, LERP_FACTOR);
    ringY = lerp(ringY, mouseY, LERP_FACTOR);

    if (dot) {
      dot.style.left = `${mouseX}px`;
      dot.style.top  = `${mouseY}px`;
    }

    if (ring) {
      ring.style.left = `${ringX}px`;
      ring.style.top  = `${ringY}px`;
    }

    rafId = requestAnimationFrame(loop);
  }

  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }

  function onMouseDown() { ring && ring.classList.add('is-clicking'); }
  function onMouseUp()   { ring && ring.classList.remove('is-clicking'); }

  function bindHoverTargets() {
    document.querySelectorAll(
      'a, button, [data-cursor="hover"], .treatment-card, .gallery-item, .goal-chip, .luxury-select-trigger, .luxury-select-option'
    ).forEach(el => {
      el.addEventListener('mouseenter', () => {
        isHovering = true;
        ring && ring.classList.add('is-hovering');
      });
      el.addEventListener('mouseleave', () => {
        isHovering = false;
        ring && ring.classList.remove('is-hovering');
      });
    });
  }

  return {
    init() {
      dot  = document.querySelector('.cursor-dot');
      ring = document.querySelector('.cursor-ring');

      if (!dot) {
        dot = document.createElement('div');
        dot.className = 'cursor-dot';
        document.body.appendChild(dot);
      }
      if (!ring) {
        ring = document.createElement('div');
        ring.className = 'cursor-ring';
        document.body.appendChild(ring);
      }

      if (!window._cursorInitialized) {
        document.addEventListener('mousemove', onMouseMove, { passive: true });
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mouseup',   onMouseUp);
        window._cursorInitialized = true;
      }

      bindHoverTargets();

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
    },

    rebindHovers() { bindHoverTargets(); }
  };
})();

/* ═══════════════════════════════════════════════════════════
   3. MAGNETIC BUTTONS
   On mousemove within MAGNET_RANGE, translate the button shell
   toward the cursor. Inner .btn-magnetic__text moves at a
   reduced factor for parallax depth. Resets on mouseleave.
   ═══════════════════════════════════════════════════════════ */
const MagneticButtons = (() => {
  if (prefersReducedMotion) return { init() {}, rebind() {} };

  function bind(el) {
    if (el._magnetBound) return;
    el._magnetBound = true;

    const textEl = el.querySelector('.btn-magnetic__text');

    function onMove(e) {
      const rect   = el.getBoundingClientRect();
      const cx     = rect.left + rect.width  / 2;
      const cy     = rect.top  + rect.height / 2;
      const dx     = e.clientX - cx;
      const dy     = e.clientY - cy;
      const dist   = Math.hypot(dx, dy);

      if (dist > MAGNET_RANGE) {
        el.style.transform   = '';
        if (textEl) textEl.style.transform = '';
        return;
      }

      // Ease: closer = stronger pull
      const strength = 1 - dist / MAGNET_RANGE;
      const tx = dx * MAGNET_PULL * strength;
      const ty = dy * MAGNET_PULL * strength;

      el.style.transform = `translate(${tx}px, ${ty}px)`;
      if (textEl) {
        textEl.style.transform = `translate(${dx * MAGNET_TEXT * strength}px, ${dy * MAGNET_TEXT * strength}px)`;
      }
    }

    function onLeave() {
      el.style.transform = '';
      if (textEl) textEl.style.transform = '';
    }

    // Listen on document to catch cursor from outside rect
    document.addEventListener('mousemove', onMove, { passive: true });
    el.addEventListener('mouseleave', onLeave);
    el._magnetCleanup = () => {
      document.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }

  return {
    init()   { document.querySelectorAll('.btn-magnetic').forEach(bind); },
    rebind() { document.querySelectorAll('.btn-magnetic').forEach(bind); }
  };
})();

/* ═══════════════════════════════════════════════════════════
   4. SPA ROUTER
   - Intercept internal <a> clicks
   - Trigger espresso/gold 5-panel wipe animation (wipe-in)
   - Fetch the HTML of the target page
   - Parse with DOMParser, swap <main> content
   - Update pushState, set <title>
   - Reverse wipe (wipe-out)
   - Re-initialize all observers on new content
   ═══════════════════════════════════════════════════════════ */
const Router = (() => {
  let wipeEl = null;

  function buildWipe() {
    if (document.querySelector('.page-wipe')) return;
    const wrap = document.createElement('div');
    wrap.className = 'page-wipe';
    for (let i = 0; i < 5; i++) {
      const p = document.createElement('div');
      p.className = 'page-wipe__panel';
      wrap.appendChild(p);
    }
    const accent = document.createElement('div');
    accent.className = 'page-wipe__accent';
    document.body.appendChild(wrap);
    document.body.appendChild(accent);
    wipeEl = wrap;
  }

  function wipeIn() {
    return new Promise(resolve => {
      if (prefersReducedMotion) return resolve();
      buildWipe();
      wipeEl.classList.remove('wipe-out');
      // Force reflow
      void wipeEl.offsetHeight;
      wipeEl.classList.add('wipe-in');
      document.querySelector('.page-wipe__accent')?.classList.add('wipe-in');
      setTimeout(resolve, WIPE_DURATION);
    });
  }

  function wipeOut() {
    return new Promise(resolve => {
      if (prefersReducedMotion) return resolve();
      if (!wipeEl) return resolve();
      wipeEl.classList.remove('wipe-in');
      wipeEl.classList.add('wipe-out');
      document.querySelector('.page-wipe__accent')?.classList.remove('wipe-in');
      document.querySelector('.page-wipe__accent')?.classList.add('wipe-out');
      setTimeout(resolve, WIPE_DURATION);
    });
  }

  async function navigate(href) {
    try {
      await wipeIn();

      const res  = await fetch(href);
      const html = await res.text();
      const doc  = new DOMParser().parseFromString(html, 'text/html');

      // Swap <main>
      const newMain = doc.querySelector('main');
      const curMain = document.querySelector('main');
      if (newMain && curMain) {
        curMain.innerHTML = newMain.innerHTML;
      }

      // Swap <title>
      document.title = doc.title || document.title;

      // Update URL
      history.pushState({ href }, '', href);

      // Update active nav link
      document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('is-active');
        if (link.getAttribute('href') === href) {
          link.classList.add('is-active');
        }
      });

      // Re-init all page observers on fresh content
      initPageModules();

      // Scroll to top
      window.scrollTo(0, 0);

      await wipeOut();
    } catch (err) {
      // Graceful fallback: hard navigate
      window.location.href = href;
    }
  }

  function isInternal(href) {
    try {
      const url = new URL(href, window.location.origin);
      return (
        url.origin === window.location.origin &&
        /\.html$|^\/$|^\/[^.]+$/.test(url.pathname)
      );
    } catch { return false; }
  }

  function bindLinks() {
    document.addEventListener('click', e => {
      const a = e.target.closest('a');
      if (!a || !a.href) return;
      if (a.target === '_blank') return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!isInternal(a.href)) return;
      const href = a.getAttribute('href');
      if (href && href !== '#') {
        e.preventDefault();
        navigate(href);
      }
    });
  }

  function bindPopState() {
    window.addEventListener('popstate', e => {
      const href = e.state?.href || window.location.pathname;
      navigate(href);
    });
  }

  return {
    init() {
      buildWipe();
      bindLinks();
      bindPopState();
    }
  };
})();

/* ═══════════════════════════════════════════════════════════
   5. NAVIGATION
   - Adds .is-scrolled class after 20px scroll
   - Marks active nav link based on current pathname
   ═══════════════════════════════════════════════════════════ */
function initNav() {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;
  let lastScroll = 0;
  if (!window._navInitialized) {
    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;
      nav.classList.toggle('is-scrolled', currentScroll > 20);
      if (currentScroll <= 0) { nav.classList.remove('is-hidden'); }
      else if (currentScroll > lastScroll && currentScroll > 100) { nav.classList.add('is-hidden'); }
      else if (currentScroll < lastScroll) { nav.classList.remove('is-hidden'); }
      lastScroll = currentScroll;
    }, { passive: true });
    window._navInitialized = true;
  }
}

/* ═══════════════════════════════════════════════════════════
   6. SCROLL REVEALS — Kinetic Typography + Fade-ups
   Elements with [data-reveal="words"] get each word wrapped
   in .reveal-mask > .reveal-word with staggered delays.
   Elements with .fade-up / .scale-up get IntersectionObserver.
   ═══════════════════════════════════════════════════════════ */
function initScrollReveals() {
  if (prefersReducedMotion) {
    // Instantly reveal everything
    document.querySelectorAll(
      '.reveal-word, .reveal-char, .fade-up, .fade-in, .scale-up, [data-reveal]'
    ).forEach(el => el.classList.add('is-revealed'));
    return;
  }

  /* ── Kinetic Typography ── */
  document.querySelectorAll('[data-reveal="words"]').forEach(el => {
    if (el._revealBound) return;
    el._revealBound = true;

    const text = el.textContent.trim();
    const words = text.split(/\s+/);
    el.innerHTML = words.map((w, i) =>
      `<span class="reveal-mask" style="display:inline-block;overflow:hidden;vertical-align:bottom;">` +
      `<span class="reveal-word" style="transition-delay:${i * STAGGER_WORD}ms">${w}</span>` +
      `</span>`
    ).join(' ');
  });

  document.querySelectorAll('[data-reveal="chars"]').forEach(el => {
    if (el._revealBound) return;
    el._revealBound = true;

    const text = el.textContent.trim();
    el.innerHTML = [...text].map((ch, i) => {
      if (ch === ' ') return ' ';
      return `<span class="reveal-mask" style="display:inline-block;overflow:hidden;vertical-align:bottom;">` +
             `<span class="reveal-char" style="transition-delay:${i * STAGGER_CHAR}ms">${ch}</span>` +
             `</span>`;
    }).join('');
  });

  /* ── Auto-stagger: children inside [data-stagger] ── */
  document.querySelectorAll('[data-stagger]').forEach(parent => {
    const base   = parseInt(parent.dataset.stagger) || 80;
    const rawTarget = parent.dataset.staggerTarget;
    // Use Array.from(children) for default case — avoids invalid '> *' selector
    const children = rawTarget
      ? Array.from(parent.querySelectorAll(rawTarget))
      : Array.from(parent.children);

    children.forEach((child, i) => {
      // Only add reveal class if not already animated
      if (!child.classList.contains('fade-up') &&
          !child.classList.contains('fade-in') &&
          !child.classList.contains('scale-up') &&
          !child.dataset.reveal) {
        child.classList.add('fade-up');
      }
      // Only set delay if not already defined inline
      if (!child.style.transitionDelay) {
        child.style.transitionDelay = `${i * base}ms`;
      }
    });
  });

  /* ── IntersectionObserver ── */
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      // Reveal words/chars inside
      el.querySelectorAll('.reveal-word, .reveal-char').forEach(s => {
        s.classList.add('is-revealed');
      });
      // Reveal the element itself
      el.classList.add('is-revealed');
      io.unobserve(el);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -56px 0px' });

  document.querySelectorAll(
    '[data-reveal], .fade-up, .fade-in, .scale-up'
  ).forEach(el => io.observe(el));
}

/* ═══════════════════════════════════════════════════════════
   7. MARQUEE
   Duplicates the .marquee-track so the marquee loops
   seamlessly without a visible reset jump.
   ═══════════════════════════════════════════════════════════ */
function initMarquee() {
  const inner = document.querySelector('.marquee-inner');
  if (!inner) return;
  // Already duplicated on previous init
  if (inner.children.length > 1) return;
  const track = inner.querySelector('.marquee-track');
  if (!track) return;
  const clone = track.cloneNode(true);
  inner.appendChild(clone);
}

/* ═══════════════════════════════════════════════════════════
   8. TREATMENT CALCULATOR
   - Toggle .is-selected on treatment cards
   - Animate displayed total from old value → new value
     over CALC_DURATION ms using rAF + easeOutQuart
   ═══════════════════════════════════════════════════════════ */
function initCalculator() {
  const cards = document.querySelectorAll('.treatment-card');
  const bar   = document.querySelector('.calculator-bar');
  const amountEl = document.querySelector('.calculator-bar__amount');

  if (!cards.length || !bar || !amountEl) return;

  let currentTotal = 0;
  let animRafId    = null;

  /* Easing fn: easeOutQuart */
  function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

  /* Animated number counter */
  function animateTo(from, to) {
    if (animRafId) cancelAnimationFrame(animRafId);
    const startTime = performance.now();

    function tick(now) {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / CALC_DURATION, 1);
      const eased    = easeOutQuart(progress);
      const value    = Math.round(from + (to - from) * eased);

      amountEl.textContent = formatCurrency(value);

      if (progress < 1) {
        animRafId = requestAnimationFrame(tick);
      } else {
        currentTotal = to;
      }
    }

    animRafId = requestAnimationFrame(tick);
  }

  function formatCurrency(n) {
    return '$' + n.toLocaleString('en-US');
  }

  function recalculate() {
    let total = 0;
    cards.forEach(card => {
      if (card.classList.contains('is-selected')) {
        total += Number(card.dataset.price || 0);
      }
    });
    const oldTotal = currentTotal;
    if (total === 0) {
      bar.classList.remove('is-visible');
    } else {
      bar.classList.add('is-visible');
    }
    if (total !== oldTotal) {
      animateTo(oldTotal, total);
    }
  }

  cards.forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('is-selected');
      recalculate();
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   8b. LUXURY CUSTOM SELECT DROPDOWNS
   Replaces native <select> with fully custom, cursor-clean
   accessible dropdown components.
   ═══════════════════════════════════════════════════════════ */
function initLuxurySelects() {
  document.querySelectorAll('.luxury-select-wrap').forEach(wrap => {
    const trigger  = wrap.querySelector('.luxury-select-trigger');
    const dropdown = wrap.querySelector('.luxury-select-dropdown');
    const options  = wrap.querySelectorAll('.luxury-select-option');
    const hidden   = wrap.querySelector('select.luxury-select-hidden');
    if (!trigger || !dropdown) return;

    let isOpen = false;
    let focusedIdx = -1;

    function openDropdown() {
      isOpen = true;
      trigger.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      dropdown.classList.add('is-open');
      focusedIdx = -1;
    }

    function closeDropdown() {
      isOpen = false;
      trigger.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      dropdown.classList.remove('is-open');
      options.forEach(o => o.classList.remove('is-focused'));
    }

    function selectOption(opt) {
      const value = opt.dataset.value;
      const label = opt.textContent;
      trigger.querySelector('.luxury-select-trigger__text').textContent = label;
      trigger.classList.add('has-value');
      if (hidden) hidden.value = value;
      options.forEach(o => {
        o.classList.remove('is-selected');
        o.setAttribute('aria-selected', 'false');
      });
      opt.classList.add('is-selected');
      opt.setAttribute('aria-selected', 'true');
      closeDropdown();
    }

    trigger.addEventListener('click', e => {
      e.stopPropagation();
      isOpen ? closeDropdown() : openDropdown();
    });

    options.forEach((opt, i) => {
      opt.addEventListener('click', e => {
        e.stopPropagation();
        selectOption(opt);
      });
      opt.addEventListener('mouseenter', () => {
        options.forEach(o => o.classList.remove('is-focused'));
        opt.classList.add('is-focused');
        focusedIdx = i;
      });
      opt.addEventListener('mouseleave', () => {
        opt.classList.remove('is-focused');
      });
    });

    trigger.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        isOpen ? closeDropdown() : openDropdown();
      } else if (e.key === 'Escape') {
        closeDropdown();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isOpen) openDropdown();
        focusedIdx = Math.min(focusedIdx + 1, options.length - 1);
        options.forEach(o => o.classList.remove('is-focused'));
        if (options[focusedIdx]) options[focusedIdx].classList.add('is-focused');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusedIdx = Math.max(focusedIdx - 1, 0);
        options.forEach(o => o.classList.remove('is-focused'));
        if (options[focusedIdx]) options[focusedIdx].classList.add('is-focused');
      } else if (e.key === 'Tab') {
        closeDropdown();
      }
    });

    document.addEventListener('click', e => {
      if (!wrap.contains(e.target)) closeDropdown();
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   9. MULTI-STEP BOOKING FORM
   State machine: step 1 → 2 → 3 with slide transitions.
   Progress indicators animate in sync.
   ═══════════════════════════════════════════════════════════ */
function initBookingForm() {
  const form = document.querySelector('#booking-form');
  if (!form) return;

  const panels   = form.querySelectorAll('.form-panel');
  const dots     = document.querySelectorAll('.progress-step__dot');
  const labels   = document.querySelectorAll('.progress-step');
  const fills    = document.querySelectorAll('.progress-line__fill');
  const btnNext  = form.querySelectorAll('[data-form-next]');
  const btnBack  = form.querySelectorAll('[data-form-back]');
  const goalChips = form.querySelectorAll('.goal-chip');

  let currentStep = 0; // 0-indexed

  function goTo(step, direction = 'forward') {
    if (step < 0 || step >= panels.length) return;

    const prev = currentStep;
    currentStep = step;

    // Animate out old panel
    panels[prev].classList.remove('is-active');
    panels[prev].classList.add(direction === 'forward' ? 'is-exiting-left' : 'is-exiting-right');

    setTimeout(() => {
      panels[prev].classList.remove('is-exiting-left', 'is-exiting-right');
    }, 450);

    // Slide in new panel
    panels[step].style.transform = direction === 'forward' ? 'translateX(60px)' : 'translateX(-60px)';
    // force reflow
    void panels[step].offsetHeight;
    panels[step].classList.add('is-active');
    panels[step].style.transform = '';

    updateProgress(step);
  }

  function updateProgress(step) {
    dots.forEach((dot, i) => {
      dot.classList.remove('is-active', 'is-done');
      if (i < step)  dot.classList.add('is-done');
      if (i === step) dot.classList.add('is-active');
    });

    labels.forEach((lbl, i) => {
      lbl.classList.toggle('is-active', i === step);
    });

    fills.forEach((fill, i) => {
      fill.style.width = i < step ? '100%' : '0%';
    });
  }

  btnNext.forEach(btn => {
    btn.addEventListener('click', () => {
      if (validate(currentStep)) goTo(currentStep + 1, 'forward');
    });
  });

  btnBack.forEach(btn => {
    btn.addEventListener('click', () => {
      goTo(currentStep - 1, 'backward');
    });
  });

  // Goal chips toggle
  goalChips.forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('is-selected');
      // Check icon SVG
      const icon = chip.querySelector('.goal-chip__icon');
      if (icon) {
        if (chip.classList.contains('is-selected')) {
          icon.innerHTML = `<svg width="12" height="9" viewBox="0 0 12 9" fill="none">
            <path d="M1 4l3.5 3.5L11 1" stroke="#FDFCF8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>`;
        } else {
          icon.innerHTML = '';
        }
      }
    });
  });

  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    
    // trigger reflow
    void toast.offsetHeight;
    toast.classList.add('is-visible');

    setTimeout(() => {
      toast.classList.remove('is-visible');
      toast.addEventListener('transitionend', () => toast.remove());
    }, 4000);
  }

  // Basic validation
  function validate(step) {
    const panel = panels[step];
    if (!panel) return true;
    let valid = true;

    if (step === 0) {
      const emailInput = panel.querySelector('input[type="email"]');
      const textInputs = panel.querySelectorAll('input[type="text"]');
      
      let allFilled = true;
      textInputs.forEach(input => {
        if (!input.value.trim()) allFilled = false;
      });
      if (emailInput && !emailInput.value.trim()) allFilled = false;
      
      if (!allFilled) {
        showToast("Please complete all required fields.");
        valid = false;
      } else if (emailInput) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailInput.value.trim())) {
          showToast("Please enter a valid email address.");
          valid = false;
        }
      }
    }

    if (!valid) {
      panel.querySelectorAll('input, select').forEach(input => {
        if (!input.value.trim()) {
          input.style.borderColor = '#c0392b';
          input.style.boxShadow   = '0 0 0 3px rgba(192,57,43,0.15)';
          setTimeout(() => {
            input.style.borderColor = '';
            input.style.boxShadow   = '';
          }, 2400);
        }
      });
    }

    return valid;
  }

  // Intercept form submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (validate(currentStep)) {
      const formPanels = document.querySelector('.form-panels');
      const formSuccess = document.getElementById('form-success');
      if (formPanels) formPanels.style.display = 'none';
      if (formSuccess) formSuccess.style.display = 'block';
    }
  });

  // Init first panel
  if (panels.length) {
    panels[0].classList.add('is-active');
    updateProgress(0);
  }
}

/* ═══════════════════════════════════════════════════════════
   11. VIDEO MODAL
   Triggers on any [data-modal-trigger] click.
   Opens .modal-backdrop with frosted glass.
   Closes on backdrop click or .modal-close button.
   ═══════════════════════════════════════════════════════════ */
function initModal() {
  const backdrop = document.querySelector('.modal-backdrop');
  if (!backdrop) return;

  const closeBtn = backdrop.querySelector('.modal-close');
  const triggers = document.querySelectorAll('[data-modal-trigger]');

  function open() {
    backdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    // Autoplay any video inside the modal
    backdrop.querySelectorAll('video').forEach(v => {
      v.play().catch(e => console.warn('Autoplay prevented:', e));
    });
    // Restore iframe src
    backdrop.querySelectorAll('iframe').forEach(f => {
      f.src = f._cachedSrc || f.src;
    });
  }

  function close() {
    backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
    // Pause any video inside
    backdrop.querySelectorAll('video').forEach(v => v.pause());
    // Remove src from iframe to stop playback
    backdrop.querySelectorAll('iframe').forEach(f => {
      f._cachedSrc = f.cachedSrc || f.src;
      f.src = '';
    });
  }

  triggers.forEach(t => t.addEventListener('click', open));
  closeBtn && closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  });
}

/* ═══════════════════════════════════════════════════════════
   11. STICKY SCROLL — Studio page
   The left .sticky-col has position:sticky via CSS.
   This module adds a subtle parallax fade to right-column
   items as they scroll into view, making them feel cinematic.
   ═══════════════════════════════════════════════════════════ */
function initStickyScroll() {
  const section = document.querySelector('.sticky-scroll-section');
  if (!section || prefersReducedMotion) return;

  const scrollItems = section.querySelectorAll('.scroll-item');
  if (!scrollItems.length) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      entry.target.style.opacity    = entry.isIntersecting ? '1' : '0.4';
      entry.target.style.transform  = entry.isIntersecting
        ? 'translateY(0) scale(1)'
        : 'translateY(20px) scale(0.98)';
      entry.target.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    });
  }, { threshold: 0.3 });

  scrollItems.forEach(el => io.observe(el));
}

/* ═══════════════════════════════════════════════════════════
   12. MOBILE MENU
   Handles the fullscreen mobile menu overlay.
   ═══════════════════════════════════════════════════════════ */
function toggleMenu() {
  const menu = document.getElementById('mobile-menu');
  if (menu) menu.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  const menu = document.getElementById('mobile-menu');
  if (menu) menu.classList.remove('is-open');
  document.body.style.overflow = '';
}

function initMobileMenu() {
  const toggle = document.getElementById('mobile-menu-btn');
  const closeBtn = document.getElementById('mobile-close');
  const menu = document.getElementById('mobile-menu');
  if (!toggle || !menu) return;

  toggle.removeEventListener('click', toggleMenu);
  toggle.addEventListener('click', toggleMenu);

  if (closeBtn) {
    closeBtn.removeEventListener('click', closeMenu);
    closeBtn.addEventListener('click', closeMenu);
  }

  // Close menu when clicking a link inside it
  menu.querySelectorAll('a').forEach(link => {
    link.removeEventListener('click', closeMenu);
    link.addEventListener('click', closeMenu);
  });
}

/* ═══════════════════════════════════════════════════════════
   13. INIT ORCHESTRATOR
   Runs all modules. Called on DOMContentLoaded and after
   every SPA navigation to re-wire the new DOM content.
   ═══════════════════════════════════════════════════════════ */
function initPageModules() {
  initNoise();
  initNav();
  initScrollReveals();
  initMarquee();
  initCalculator();
  initLuxurySelects();
  initBookingForm();
  initModal();
  initStickyScroll();
  initMobileMenu();
  MagneticButtons.rebind();
  Cursor.rebindHovers();
  initTouchEffects();
}

/* ═══════════════════════════════════════════════════════════
   14. TOUCH EFFECTS
   On pointer:coarse (mobile/tablet) devices, the native
   :hover state "sticks" after a tap. This module adds
   .is-touched instantly on touchstart and removes it after
   a 1.5 s timeout (reset on new touch).

   CSS pattern — combine hover and touch state:
     .card:hover, .card.is-touched { ... }
   ═══════════════════════════════════════════════════════════ */
function initTouchEffects() {
  // Only run on real touch devices — skip desktop
  if (!window.matchMedia('(pointer: coarse)').matches) return;

  const TOUCH_SELECTORS = [
    '.treatment-card',
    '.gallery-item',
    '.goal-chip',
    '.info-card',
    '.btn-primary',
    '.btn-ghost',
    '.btn-gold',
    '.nav-cta',
    '.luxury-select-trigger',
    '.luxury-select-option',
    '[data-touch]',
  ].join(', ');

  // Map: element → timeout id
  const timers = new WeakMap();

  function applyTouch(el) {
    // Clear existing timer
    if (timers.has(el)) clearTimeout(timers.get(el));

    el.classList.add('is-touched');

    const id = setTimeout(() => {
      el.classList.remove('is-touched');
      timers.delete(el);
    }, 1500);

    timers.set(el, id);
  }

  // Use event delegation on document — catches dynamically added elements
  document.addEventListener('touchstart', e => {
    const target = e.target.closest(TOUCH_SELECTORS);
    if (target) applyTouch(target);
  }, { passive: true });

  // Also remove on touchend for quick taps (feels crisper)
  document.addEventListener('touchend', e => {
    // Only clear immediately if it's a very quick tap (< 200ms)
    const target = e.target.closest(TOUCH_SELECTORS);
    if (!target) return;
    // Let the timeout handle cleanup — don't force-remove here
    // so ripple/lift effects stay visible long enough to feel good
  }, { passive: true });
}

/* ── BOOTSTRAP ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Global singletons (only once)
  Cursor.init();
  Router.init();

  // Page-specific modules (re-run on SPA nav)
  initPageModules();
});
