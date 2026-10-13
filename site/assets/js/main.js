(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Плавна інерційна прокрутка (Lenis) ----------
  // Вимикається для користувачів з налаштуванням «зменшити рух»; тоді працює звичайна прокрутка.
  let lenis = null;
  if (!reduceMotion && typeof window.Lenis === 'function') {
    lenis = new window.Lenis({
      duration: 1.1,
      easing: (x) => Math.min(1, 1.001 - Math.pow(2, -10 * x)),
      smoothWheel: true,
    });
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  // ---------- Мова (UA / EN) ----------
  // Українські тексти беруться з HTML, англійські — з assets/i18n/en.js
  const LANG_KEY = 'ugp-lang';
  const dicts = { uk: {}, en: (window.UGP_I18N && window.UGP_I18N.en) || {} };

  // Службові повідомлення українською (англійські — в en.js, ключі msg.*)
  const UK_MESSAGES = {
    'msg.nameRequired': 'Вкажіть, будь ласка, ваше ім’я.',
    'msg.contactRequired': 'Вкажіть телефон або e-mail.',
    'msg.contactInvalid': 'Перевірте формат: телефон (+380 …) або e-mail (name@company.com).',
    'msg.consentRequired': 'Потрібна згода на обробку даних.',
    'msg.sendFailed': 'Не вдалося надіслати запит.',
    'msg.unavailable': 'Онлайн-форма тимчасово недоступна.',
    'msg.fallback': 'Ваші дані збережено у формі — спробуйте ще раз або зв’яжіться з нами напряму:',
    'msg.success': 'Дякуємо! Запит отримано — ми зв’яжемося з вами найближчим часом.',
    'msg.menuOpen': 'Відкрити меню',
    'msg.menuClose': 'Закрити меню',
  };

  const textNodes = [...document.querySelectorAll('[data-i18n]')].map((el) => ({
    el, key: el.dataset.i18n, uk: el.innerHTML,
  }));
  const attrNodes = [...document.querySelectorAll('[data-i18n-attr]')].map((el) => ({
    el,
    pairs: el.dataset.i18nAttr.split(';').map((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      return { attr, key, uk: el.getAttribute(attr) };
    }),
  }));

  let lang = 'uk';
  const t = (key) => (lang === 'en' && dicts.en[key] != null ? dicts.en[key] : UK_MESSAGES[key] || key);

  const applyLang = (next) => {
    lang = next === 'en' ? 'en' : 'uk';
    const en = lang === 'en' ? dicts.en : null;
    textNodes.forEach((n) => {
      const value = en && en[n.key] != null ? en[n.key] : n.uk;
      if (n.el.innerHTML !== value) n.el.innerHTML = value;
    });
    attrNodes.forEach((n) => n.pairs.forEach((p) => {
      n.el.setAttribute(p.attr, en && en[p.key] != null ? en[p.key] : p.uk);
    }));
    document.documentElement.lang = lang;
    setSwitch(lang);
    document.dispatchEvent(new CustomEvent('ugp:lang', { detail: lang }));
  };

  // Положення індикатора UA/EN
  function setSwitch(code) {
    document.querySelectorAll('.lang').forEach((el) => { el.dataset.active = code; });
    document.querySelectorAll('[data-lang]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.lang === code));
    });
  }

  const readLang = () => {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (fromUrl === 'en' || fromUrl === 'uk') return fromUrl;
    try { return localStorage.getItem(LANG_KEY) || 'uk'; } catch (_) { return 'uk'; }
  };

  // Підказка для редактора перекладу: які ключі ще не перекладено
  const missing = [...new Set([...textNodes.map((n) => n.key), ...attrNodes.flatMap((n) => n.pairs.map((p) => p.key))])]
    .filter((k) => dicts.en[k] == null);
  if (missing.length) console.warn('[UGP i18n] Немає англійського перекладу для ключів:', missing);

  applyLang(readLang());

  // Перемикання мови: індикатор ковзає (CSS transform, 0.32s), тексти згасають (0.2s) → змінюються → з'являються (0.25s).
  // Сторінка не «стрибає»: елемент у центрі екрана лишається на тому ж місці після зміни текстів.
  // Повторне натискання під час анімації не ігнорується — анімація перезапускається до нової мови.
  const root = document.documentElement;
  const FADE_OUT = 200;
  const FADE_IN = 250;
  let timers = [];
  let target = null;

  const swapKeepingPosition = (next) => {
    const probe = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    const before = probe ? probe.getBoundingClientRect().top : 0;
    applyLang(next);
    if (!probe) return;
    const delta = probe.getBoundingClientRect().top - before;
    if (Math.abs(delta) < 1) return;
    if (lenis) lenis.scrollTo(window.scrollY + delta, { immediate: true, force: true });
    else window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' });
  };

  const switchLang = (next) => {
    if (next === (target || lang)) return;
    try { localStorage.setItem(LANG_KEY, next); } catch (_) { /* сховище недоступне */ }
    setSwitch(next); // індикатор починає ковзати одразу
    if (reduceMotion) { swapKeepingPosition(next); return; }

    timers.forEach(clearTimeout);
    timers = [];
    target = next;
    root.classList.remove('lang-in');
    root.classList.add('lang-anim', 'lang-out');
    timers.push(setTimeout(() => {
      if (lang !== target) swapKeepingPosition(target);
      root.classList.remove('lang-anim', 'lang-out');
      root.classList.add('lang-in');
      timers.push(setTimeout(() => { root.classList.remove('lang-in'); target = null; }, FADE_IN + 20));
    }, FADE_OUT + 10));
  };

  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => switchLang(btn.dataset.lang));
  });

  // Актуальний рік у копірайті
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  // Посилання, які замовник ще має надати (політика, месенджери)
  document.addEventListener('click', (e) => {
    if (e.target.closest('a[data-todo]')) e.preventDefault();
  });

  // ---------- Мобільне меню ----------
  const burger = document.querySelector('.burger');
  const nav = document.getElementById('nav');
  const setMenu = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', t(open ? 'msg.menuClose' : 'msg.menuOpen'));
    nav.classList.toggle('is-open', open);
  };
  setMenu(false);
  document.addEventListener('ugp:lang', () => setMenu(burger.getAttribute('aria-expanded') === 'true'));
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); burger.focus(); }
  });

  // ---------- Плавний перехід до секцій з урахуванням шапки ----------
  // Після прокручування шапка стає компактною — відступ рахуємо під її компактну висоту.
  const headerOffset = () => (window.matchMedia('(max-width: 600px)').matches ? 57 : 63);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute('data-todo') || e.defaultPrevented) return;
    const hash = a.getAttribute('href');
    if (hash === '#') return;
    const target = hash === '#top' ? null : document.querySelector(hash);
    if (hash !== '#top' && !target) return;
    e.preventDefault();
    if (target) {
      const y = target.getBoundingClientRect().top + window.scrollY - headerOffset();
      if (lenis) lenis.scrollTo(y, { duration: 1.2 });
      else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
      // Фокус переходить до секції (для клавіатури та читачів екрана), без додаткової прокрутки
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    } else if (lenis) {
      lenis.scrollTo(0, { duration: 1.2 });
    } else {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    history.replaceState(null, '', hash === '#top' ? location.pathname + location.search : hash);
  });

  // ---------- Слайдери (етапи, команда) ----------
  document.querySelectorAll('[data-slider-nav]').forEach((navEl) => {
    const track = document.querySelector(`[data-slider="${navEl.dataset.sliderNav}"]`);
    if (!track) return;
    const [prev, next] = navEl.querySelectorAll('.arrow');
    const step = () => {
      const item = track.querySelector('li');
      return item ? item.getBoundingClientRect().width + 16 : 320;
    };
    const update = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max;
      navEl.hidden = max <= 0;
    };
    navEl.querySelectorAll('.arrow').forEach((btn) => {
      btn.addEventListener('click', () => track.scrollBy({ left: step() * Number(btn.dataset.dir), behavior: 'smooth' }));
    });
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        track.scrollBy({ left: e.key === 'ArrowRight' ? step() : -step(), behavior: 'smooth' });
      }
    });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });


  // ---------- Компактна шапка після прокручування ----------
  const header = document.querySelector('.header');
  let ticking = false;
  const onScroll = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 40);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  // ---------- Лічильник для 20 / 15 / 25 ----------
  const countUp = (el) => {
    const target = parseInt(el.dataset.target || el.textContent, 10);
    if (!target || reduceMotion) return;
    el.dataset.target = target;
    el.style.minWidth = `${el.getBoundingClientRect().width}px`; // без «стрибків» сусіднього тексту
    const duration = 800;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    el.textContent = '0';
    requestAnimationFrame(tick);
  };

  // ---------- Поява блоків під час прокручування ----------
  // Елементи, що з'являються одночасно, отримують невелику затримку один за одним
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      const batch = entries.filter((e) => e.isIntersecting).map((e) => e.target)
        .sort((a, b) => {
          const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();
          return (ra.top - rb.top) || (ra.left - rb.left);
        });
      batch.forEach((el, i) => {
        el.style.transitionDelay = `${Math.min(i, 6) * 90}ms`;
        el.classList.add('is-in');
        el.addEventListener('transitionend', () => { el.style.transitionDelay = ''; }, { once: true });
        el.querySelectorAll('.exp__num').forEach((n) => setTimeout(() => countUp(n), Math.min(i, 6) * 90));
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  // ---------- Форма звернення ----------
  const form = document.getElementById('lead-form');
  if (!form) return;

  const STORE_KEY = 'ugp-lead-draft';
  const startedAt = Date.now();
  const status = form.querySelector('.form__status');
  const fields = {
    name: form.elements.name,
    contact: form.elements.contact,
    message: form.elements.message,
    consent: form.elements.consent,
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const isPhone = (v) => {
    if (!/^[+()\d\s-]+$/.test(v)) return false;
    const digits = v.replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 15;
  };

  // Помилки зберігаються як ключі, щоб перекладатися при зміні мови
  const setError = (input, key) => {
    const field = input.closest('.field');
    const err = field.querySelector('.field__err');
    field.classList.toggle('is-invalid', Boolean(key));
    input.setAttribute('aria-invalid', key ? 'true' : 'false');
    if (err) { err.dataset.msg = key || ''; err.textContent = key ? t(key) : ''; }
  };

  const validate = () => {
    let firstBad = null;
    const name = fields.name.value.trim();
    const contact = fields.contact.value.trim();

    if (name.length < 2) { setError(fields.name, 'msg.nameRequired'); firstBad ||= fields.name; }
    else setError(fields.name, '');

    if (!contact) { setError(fields.contact, 'msg.contactRequired'); firstBad ||= fields.contact; }
    else if (!(EMAIL_RE.test(contact) || isPhone(contact))) { setError(fields.contact, 'msg.contactInvalid'); firstBad ||= fields.contact; }
    else setError(fields.contact, '');

    if (!fields.consent.checked) { setError(fields.consent, 'msg.consentRequired'); firstBad ||= fields.consent; }
    else setError(fields.consent, '');

    return firstBad;
  };

  // Чернетка зберігається, щоб дані не губилися при помилці чи перезавантаженні
  const saveDraft = () => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({
        name: fields.name.value, contact: fields.contact.value, message: fields.message.value,
      }));
    } catch (_) { /* сховище недоступне */ }
  };
  try {
    const draft = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
    if (draft) Object.keys(draft).forEach((k) => { if (fields[k]) fields[k].value = draft[k] || ''; });
  } catch (_) { /* ігноруємо */ }

  ['name', 'contact', 'message'].forEach((k) => fields[k].addEventListener('input', saveDraft));
  ['name', 'contact'].forEach((k) => fields[k].addEventListener('blur', () => {
    if (fields[k].closest('.field').classList.contains('is-invalid')) validate();
  }));
  fields.consent.addEventListener('change', () => { if (fields.consent.checked) setError(fields.consent, ''); });

  let statusState = null; // { type, keys }
  const renderStatus = () => {
    if (!statusState) { status.className = 'form__status'; status.textContent = ''; return; }
    const { type, keys } = statusState;
    status.className = `form__status is-${type}`;
    const contacts = '<a href="tel:+380952707611">+380 95 270 7611</a> · <a href="mailto:hello@ugp.ua">hello@ugp.ua</a>';
    status.innerHTML = keys.map(t).join(' ') + (type === 'error' ? ` ${contacts}.` : '');
  };
  const showStatus = (type, ...keys) => { statusState = { type, keys }; renderStatus(); };

  document.addEventListener('ugp:lang', () => {
    form.querySelectorAll('.field__err').forEach((err) => { if (err.dataset.msg) err.textContent = t(err.dataset.msg); });
    renderStatus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusState = null; renderStatus();

    const firstBad = validate();
    if (firstBad) { firstBad.focus(); return; }

    // Антиспам: заповнене приховане поле або надто швидке надсилання
    if (form.elements.website.value || Date.now() - startedAt < 3000) {
      showStatus('error', 'msg.sendFailed', 'msg.fallback');
      return;
    }

    const endpoint = form.dataset.endpoint;
    if (!endpoint) {
      // Систему прийому заявок ще не підключено — успіх не показуємо
      showStatus('error', 'msg.unavailable', 'msg.fallback');
      return;
    }

    form.classList.add('is-sending');
    form.setAttribute('aria-busy', 'true');
    try {
      const contact = fields.contact.value.trim();
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: fields.name.value.trim(),
          contact,
          contactType: EMAIL_RE.test(contact) ? 'email' : 'phone',
          message: fields.message.value.trim(),
          consent: true,
          lang,
          page: location.href,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      form.reset();
      try { sessionStorage.removeItem(STORE_KEY); } catch (_) { /* ігноруємо */ }
      showStatus('ok', 'msg.success');
    } catch (_) {
      showStatus('error', 'msg.sendFailed', 'msg.fallback');
    } finally {
      form.classList.remove('is-sending');
      form.removeAttribute('aria-busy');
    }
  });
})();
