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
    'msg.phoneRequired': 'Вкажіть номер телефону.',
    'msg.phoneInvalid': 'Номер неповний: потрібно 9 цифр після +380, наприклад +380 95 123 45 67.',
    'msg.emailRequired': 'Вкажіть e-mail.',
    'msg.emailInvalid': 'Перевірте e-mail: формат name@company.com.',
    'msg.consentRequired': 'Потрібна згода на обробку даних.',
    'msg.sendFailed': 'Не вдалося надіслати запит.',
    'msg.unavailable': 'Онлайн-форма тимчасово недоступна.',
    'msg.fallback': 'Ваші дані збережено у формі — спробуйте ще раз або зв’яжіться з нами напряму:',
    'msg.successTitle': 'Дякуємо! Запит отримано.',
    'msg.success': 'Ми зв’яжемося з вами найближчим часом.',
    'msg.menuOpen': 'Відкрити меню',
    'msg.menuClose': 'Закрити меню',
    'msg.slideOf': 'Відгук {i} з {n}',
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

  // ---------- Типографіка: короткі слова не лишаються в кінці рядка, тире не починає рядок ----------
  // Працює для обох мов і для будь-яких майбутніх правок текстів (у HTML чи en.js).
  const SHORT_WORDS = {
    uk: 'і|й|в|у|з|із|зі|та|до|на|а|о|не|по|за|від|для|чи|або|як|що|ні|ж|же|би',
    en: 'a|an|the|of|to|in|on|at|by|for|and|or|as|is|we|our|its|with|from|no',
  };
  const NBSP = ' ';
  // Попередній символ перевіряється lookbehind-ом (не «з’їдається»), тож ланцюжки «is an», «і в», «with no» склеюються за один прохід
  const glueRe = {
    uk: new RegExp(`(?<=^|[\\s(«"])(${SHORT_WORDS.uk})\\s+`, 'giu'),
    en: new RegExp(`(?<=^|[\\s(“"])(${SHORT_WORDS.en})\\s+`, 'giu'),
  };
  // Слова з дефісом («self-government», «End-to-end», «e-mail») не розриваються на дефісі
  const HYPHEN_WORD = /[\p{L}\d]+(?:-[\p{L}\d]+)+/gu;
  const keepHyphenated = (t) => {
    if (t.parentElement.classList.contains('nw') || !HYPHEN_WORD.test(t.data)) return;
    HYPHEN_WORD.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    t.data.replace(HYPHEN_WORD, (word, at) => {
      if (at > last) frag.append(t.data.slice(last, at));
      const span = document.createElement('span');
      span.className = 'nw'; span.textContent = word;
      frag.append(span);
      last = at + word.length;
    });
    if (last < t.data.length) frag.append(t.data.slice(last));
    t.replaceWith(frag);
  };
  const typeset = (root, code) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (t) => (t.parentElement.closest('script, style, input, textarea, svg, title') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((t) => {
      let s = t.data;
      s = s.replace(glueRe[code], `$1${NBSP}`);
      s = s.replace(/ ([—–])/g, `${NBSP}$1`); // тире лишається з попереднім словом
      if (s !== t.data) t.data = s;
      keepHyphenated(t);
    });
    // Без «вдів»: у текстах із 3+ слів два останні слова не розриваються
    const blocks = root.matches?.(WIDOW_SEL) ? [root] : [];
    blocks.push(...root.querySelectorAll(WIDOW_SEL));
    blocks.forEach(noWidow);
  };
  const WIDOW_SEL = 'p, dd, h1, h2, h3, h4, blockquote, figcaption span, .tasks__list li span, .principles b, .steps-list b, .intl__rows b';
  function noWidow(el) {
    if (el.querySelector('p, li, div, dd')) return;
    const full = el.textContent.replace(/\s+$/, '');
    if (full.split(/[\s ]+/).length < 3) return;
    // Довгі закінчення («stakeholder engagement», «або створення активу») не склеюємо — інакше рядок вилазить за межі
    // вузької картки. Рахуємо весь нерозривний шматок: слова, вже склеєні з коротким словом, теж входять у довжину.
    if (full.split(/[ \t\n\r]+/).slice(-2).join(' ').length > 18) return;
    // Уже зʼєднано (останній пробіл — нерозривний)? Тоді нічого не робимо — функція ідемпотентна.
    const lastGap = full.search(/[\s ](?=[^\s ]*$)/);
    if (lastGap > -1 && full[lastGap] === NBSP) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      const trimmed = t.data.replace(/[ \t\n\r]+$/, '');
      const idx = trimmed.search(/[ \t\n\r](?=[^ \t\n\r]*$)/);
      if (idx > -1) { t.data = trimmed.slice(0, idx) + NBSP + trimmed.slice(idx + 1) + t.data.slice(trimmed.length); return; }
      if (trimmed.length && i < texts.length - 1) return; // слово в окремому тезі без пробілу — не чіпаємо
    }
  }

  const applyLang = (next) => {
    lang = next === 'en' ? 'en' : 'uk';
    const en = lang === 'en' ? dicts.en : null;
    textNodes.forEach((n) => {
      const value = en && en[n.key] != null ? en[n.key] : n.uk;
      if (n.el.innerHTML !== value) n.el.innerHTML = value;
      typeset(n.el, lang);
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
  typeset(document.body, lang); // також тексти без перекладу (контакти, підписи)

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
  // Висота шапки стала (компактний стан змінює лише тінь і масштаб логотипа), тож відступ = її фактична висота
  const headerOffset = () => document.querySelector('.header').getBoundingClientRect().height;
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

  // ---------- Активний розділ у меню ----------
  // Підсвічується пункт, чий розділ перетнув лінію на 35% висоти екрана. «Контакти» охоплюють і форму звернення.
  const navLinks = [...document.querySelectorAll('.nav__list a[href^="#"]')];
  const regions = navLinks.map((a) => ({
    a, el: a.hash === '#contacts' ? (document.getElementById('contact-form') || document.querySelector(a.hash)) : document.querySelector(a.hash),
  })).filter((r) => r.el);
  let activeLink = null;
  const updateActive = () => {
    const line = window.innerHeight * 0.35;
    let current = null;
    regions.forEach((r) => { if (r.el.getBoundingClientRect().top <= line) current = r.a; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = regions[regions.length - 1]?.a || current;
    if (current === activeLink) return;
    if (activeLink) activeLink.removeAttribute('aria-current');
    if (current) current.setAttribute('aria-current', 'location');
    activeLink = current;
  };
  let navTick = false;
  window.addEventListener('scroll', () => {
    if (!navTick) { navTick = true; requestAnimationFrame(() => { updateActive(); navTick = false; }); }
  }, { passive: true });
  updateActive();

  /* ВИМКНЕНО: плаваюча кнопка CTA (перекривала контент на телефоні; CTA тепер у мобільному меню).
     Щоб повернути — розкоментувати блок і розмітку .sticky-cta в index.html.
  // ---------- Плаваюча кнопка CTA (телефон і планшет) ----------
  // Видима після hero; ховається, коли на екрані форма, футер або відкрите меню. На десктопі прихована в CSS.
  const stickyCta = document.querySelector('.sticky-cta');
  if (stickyCta && 'IntersectionObserver' in window) {
    const watch = { hero: document.querySelector('.hero'), form: document.getElementById('contact-form'), footer: document.querySelector('.footer') };
    const seen = { hero: true, form: false, footer: false };
    const render = () => {
      const show = !seen.hero && !seen.form && !seen.footer && !nav.classList.contains('is-open');
      stickyCta.classList.toggle('is-visible', show);
      stickyCta.setAttribute('aria-hidden', String(!show));
      stickyCta.tabIndex = show ? 0 : -1;
    };
    const ctaIo = new IntersectionObserver((entries) => {
      entries.forEach((e) => { const k = Object.keys(watch).find((key) => watch[key] === e.target); if (k) seen[k] = e.isIntersecting; });
      render();
    }, { threshold: 0 });
    Object.values(watch).forEach((el) => el && ctaIo.observe(el));
    burger.addEventListener('click', () => requestAnimationFrame(render));
    nav.addEventListener('click', () => requestAnimationFrame(render));
  }
  */

  // ---------- Лічильник для 20 / 15 / 25 ----------
  const countUp = (el) => {
    const target = parseInt(el.dataset.target || el.textContent, 10);
    if (!target || reduceMotion) return;
    el.dataset.target = target;
    el.style.minWidth = `${el.getBoundingClientRect().width}px`; // без «стрибків» сусіднього тексту
    const duration = 900;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    el.textContent = '0';
    requestAnimationFrame(tick);
  };

  // ---------- Темні стрічки «Завдання» / «Принципи» ----------
  // Іконки з <use> вбудовуються інлайном з pathLength="1", щоб CSS міг «намалювати» кожну лінію за той самий час.
  // Порядок появи пунктів (--i) і запуск анімації — тут, хореографія — у CSS (.strip). Анімація грає один раз.
  const strips = document.querySelectorAll('.strip');
  strips.forEach((strip) => {
    strip.querySelectorAll('.tasks__list li').forEach((li, i) => li.style.setProperty('--i', i));
    strip.querySelectorAll('svg.ico').forEach((svg) => {
      const use = svg.querySelector('use');
      const symbol = use && document.querySelector(use.getAttribute('href'));
      if (!symbol) return;
      svg.setAttribute('viewBox', symbol.getAttribute('viewBox'));
      svg.replaceChildren(...[...symbol.childNodes].map((n) => n.cloneNode(true)));
      svg.querySelectorAll('path, rect, circle').forEach((shape) => shape.setAttribute('pathLength', '1'));
    });
  });
  if ('IntersectionObserver' in window && !reduceMotion) {
    const stripIo = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        stripIo.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
    strips.forEach((el) => stripIo.observe(el));
  } else {
    strips.forEach((el) => el.classList.add('is-in'));
  }

  // ---------- Слайдер відгуків ----------
  // Фото й текст з однаковим data-slide показуються разом (кросфейд — у CSS). Стрілки, свайп, ←/→ коли фокус у блоці.
  // Автопрогравання ~7s лише коли блок на екрані; пауза при наведенні/фокусі, повна зупинка після будь-якої дії користувача.
  document.querySelectorAll('[data-slider]').forEach((root) => {
    const photos = [...root.querySelectorAll('.reviews__media img')];
    const slides = [...root.querySelectorAll('.reviews__figure')];
    const nav = root.querySelector('.reviews__nav');
    const live = root.querySelector('.reviews__slides');
    const n = slides.length;
    if (n < 2 || !nav) return;
    const pad = (x) => String(x).padStart(2, '0');
    const AUTOPLAY_MS = 7000;
    let index = 0; let timer = null; let stopped = reduceMotion; let paused = false; let visible = false;

    nav.hidden = false;
    root.querySelector('.reviews__total').textContent = pad(n);
    const labelSlides = () => slides.forEach((s, i) => s.setAttribute('aria-label', t('msg.slideOf').replace('{i}', i + 1).replace('{n}', n)));

    const show = (next) => {
      index = (next + n) % n;
      photos.forEach((img, i) => { const on = i === index; img.classList.toggle('is-active', on); img.setAttribute('aria-hidden', String(!on)); });
      slides.forEach((s, i) => { const on = i === index; s.classList.toggle('is-active', on); s.setAttribute('aria-hidden', String(!on)); s.inert = !on; });
      root.querySelector('.reviews__current').textContent = pad(index + 1);
      nav.style.setProperty('--p', (index + 1) / n);
    };

    const schedule = () => {
      clearTimeout(timer);
      if (stopped || paused || !visible || document.hidden) return;
      timer = setTimeout(() => { show(index + 1); schedule(); }, AUTOPLAY_MS);
    };
    // Дія користувача: перейти й назавжди вимкнути автопрогравання; озвучувати зміну лише тоді
    const go = (delta) => { stopped = true; clearTimeout(timer); live.setAttribute('aria-live', 'polite'); show(index + delta); };

    nav.querySelectorAll('[data-dir]').forEach((btn) => btn.addEventListener('click', () => go(Number(btn.dataset.dir))));
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); go(e.key === 'ArrowRight' ? 1 : -1); }
    });
    // Свайп: горизонтальний рух ≥ 40px, переважно вбік (вертикальна прокрутка сторінки не заважає)
    let sx = 0; let sy = 0;
    root.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    root.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - sx; const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    }, { passive: true });

    const pause = (on) => { paused = on; schedule(); };
    root.addEventListener('mouseenter', () => pause(true));
    root.addEventListener('mouseleave', () => pause(false));
    root.addEventListener('focusin', () => pause(true));
    root.addEventListener('focusout', (e) => { if (!root.contains(e.relatedTarget)) pause(false); });
    document.addEventListener('visibilitychange', schedule);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; schedule(); }, { threshold: 0.35 }).observe(root);
    }

    // Під час автопрогравання зміни не озвучуються (aria-live="off"), щоб не перебивати читач екрана
    if (!stopped) live.setAttribute('aria-live', 'off');
    labelSlides();
    document.addEventListener('ugp:lang', labelSlides);
    show(0);
  });

  // ---------- Рух: єдина система ----------
  // Одна крива (--ease у CSS), тривалість 0.5–0.9s, крок між елементами 80ms; кожна анімація грає один раз;
  // анімуються лише transform і opacity. Для «зменшити рух» усе одразу показано без анімацій.
  const STAGGER = 80;
  const animate = 'IntersectionObserver' in window && !reduceMotion;

  // Поява блоків під час прокручування: елементи, що з’являються одночасно, — по черзі (зверху вниз, зліва направо).
  // Затримка передається й дочірнім анімаціям (рядки заголовка, фото) через --rd.
  const reveals = document.querySelectorAll('.reveal');
  if (animate) {
    const io = new IntersectionObserver((entries) => {
      const batch = entries.filter((e) => e.isIntersecting).map((e) => e.target)
        .sort((a, b) => {
          const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();
          return (ra.top - rb.top) || (ra.left - rb.left);
        });
      batch.forEach((el, i) => {
        const delay = Math.min(i, 6) * STAGGER;
        el.style.transitionDelay = `${delay}ms`;
        el.style.setProperty('--rd', `${delay}ms`);
        el.classList.add('is-in');
        // Затримку знімаємо після появи (події дочірніх елементів ігноруємо), щоб наведення реагувало одразу
        const clear = (ev) => { if (ev.target !== el) return; el.style.transitionDelay = ''; el.removeEventListener('transitionend', clear); };
        el.addEventListener('transitionend', clear);
        el.querySelectorAll('.exp__num').forEach((n) => setTimeout(() => countUp(n), delay + 150));
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  // Лінії-розділювачі у списках (.rules) малюються зліва направо по черзі
  document.querySelectorAll('.rules').forEach((list) => [...list.children].forEach((li, i) => li.style.setProperty('--i', i)));

  // Один раз «у полі зору» (без власного зсуву): списки з лініями, фони секцій, з’єднувальна лінія етапів, футер
  const inview = document.querySelectorAll('[data-inview]');
  if (animate) {
    const vio = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      vio.unobserve(e.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    inview.forEach((el) => vio.observe(el));
  } else {
    inview.forEach((el) => el.classList.add('is-in'));
  }

  // Заголовки: кожен рядок виїжджає з-під маски. Слова загортаються в .w > .wi, номер рядка — у --ln.
  // Розмітка всередині (.tone, .pill, <br>) зберігається; нерозривні пробіли не розбивають слово.
  // Після зміни мови текст замінюється звичайним — заголовок просто видно (анімація вже відбулась).
  const splitHeading = (h) => {
    if (h.classList.contains('split')) return;
    const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach((t) => {
      if (!t.data.trim()) return;
      const frag = document.createDocumentFragment();
      t.data.split(/([ \n\t]+)/).forEach((part) => {
        if (!part) return;
        if (/^[ \n\t]+$/.test(part)) { frag.append(' '); return; }
        const w = document.createElement('span'); w.className = 'w';
        const wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = part;
        w.append(wi); frag.append(w);
      });
      t.replaceWith(frag);
    });
    let lastTop = null; let ln = -1;
    h.querySelectorAll('.w').forEach((w) => {
      const top = w.getBoundingClientRect().top;
      if (lastTop === null || top > lastTop + 4) { ln += 1; lastTop = top; }
      w.style.setProperty('--ln', ln);
    });
    h.classList.add('split');
  };

  // Hero: послідовність при завантаженні — заголовок (по рядках) → теги → текст → кнопка → фото → картка.
  // Стартує, коли завантажено шрифти (рядки рахуються за остаточною версткою), але не пізніше ніж за 1.2s.
  const heroTitle = document.querySelector('.hero__title');
  const startMotion = () => {
    if (root.classList.contains('hero-go')) return;
    if (animate) document.querySelectorAll('main h2:not(.visually-hidden), .hero__title').forEach(splitHeading);
    else if (heroTitle) heroTitle.classList.add('split'); // без анімації заголовок просто видно
    // Браузер має «побачити» початковий стан рядків (під маскою) до старту — інакше переходу не буде
    if (heroTitle) getComputedStyle(heroTitle.querySelector('.wi') || heroTitle).transform;
    requestAnimationFrame(() => {
      root.classList.add('hero-go');
      if (heroTitle) heroTitle.classList.add('is-in');
      // Після вступу прибираємо службовий клас: кнопка й фото hero отримують звичайні (швидші) переходи для наведення
      setTimeout(() => document.querySelectorAll('.hi').forEach((el) => el.classList.remove('hi')), 2400);
    });
  };
  if (document.fonts && document.fonts.ready && animate) {
    document.fonts.ready.then(startMotion);
    setTimeout(startMotion, 1200);
  } else {
    startMotion();
  }

  // ---------- Форма звернення ----------
  const form = document.getElementById('lead-form');
  if (!form) return;

  const STORE_KEY = 'ugp-lead-draft';
  const startedAt = Date.now();
  const status = form.querySelector('.form__status');
  const submitBtn = form.querySelector('.form__submit');
  const contactField = form.querySelector('.field--contact');
  const fields = {
    name: form.elements.name,
    contact: form.elements.contact,
    message: form.elements.message,
    consent: form.elements.consent,
  };

  // ---------- Спосіб зв’язку: «Телефон | E-mail» ----------
  // Для кожного способу — свій тип поля (потрібна клавіатура на телефоні), підказка, автозаповнення й перевірка.
  // Значення кожного способу зберігається окремо й повертається при перемиканні назад.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const MODES = {
    phone: { type: 'tel', inputmode: 'tel', autocomplete: 'tel', maxlength: '17', placeholder: '+380 XX XXX XX XX' },
    email: { type: 'email', inputmode: 'email', autocomplete: 'email', maxlength: '120', placeholder: 'name@company.com' },
  };
  let mode = 'phone';
  const values = { phone: '', email: '' };

  // Маска +380 XX XXX XX XX: зберігаються лише 9 цифр номера після коду країни
  const PHONE_GROUPS = [2, 3, 2, 2];
  const phoneDigits = (raw) => {
    let d = raw.replace(/\D/g, '');
    if (d.startsWith('380')) d = d.slice(3);
    if (d.startsWith('0')) d = d.slice(1); // 095… → 95…
    return d.slice(0, 9);
  };
  const formatPhone = (d) => {
    let out = '+380'; let i = 0;
    for (const len of PHONE_GROUPS) { if (i >= d.length) break; out += ` ${d.slice(i, i + len)}`; i += len; }
    return out;
  };
  // Позиція курсора після n-ї цифри номера у відформатованому рядку
  const caretAfter = (formatted, n) => {
    if (n === 0) return Math.min(formatted.length, 5);
    let seen = 0;
    for (let i = 4; i < formatted.length; i += 1) if (/\d/.test(formatted[i]) && (seen += 1) === n) return i + 1;
    return formatted.length;
  };
  let lastPhone = '';
  const applyPhoneMask = (e) => {
    const input = fields.contact;
    const caret = input.selectionStart ?? input.value.length;
    let digits = phoneDigits(input.value);
    let before = phoneDigits(input.value.slice(0, caret)).length;
    // Backspace по пробілу: цифри не змінились — видаляємо цифру перед курсором
    if (e && e.inputType === 'deleteContentBackward' && digits === phoneDigits(lastPhone) && before > 0) {
      digits = digits.slice(0, before - 1) + digits.slice(before); before -= 1;
    }
    const deleting = e && e.inputType && e.inputType.startsWith('delete');
    const next = digits || !deleting ? formatPhone(digits) : '';
    input.value = next; lastPhone = next;
    if (document.activeElement === input) { const pos = caretAfter(next, before); input.setSelectionRange(pos, pos); }
  };

  // Помилки зберігаються як ключі, щоб перекладатися при зміні мови
  function setError(input, key) {
    const field = input.closest('.field');
    const err = field.querySelector('.field__err');
    field.classList.toggle('is-invalid', Boolean(key));
    input.setAttribute('aria-invalid', key ? 'true' : 'false');
    if (err) { err.dataset.msg = key || ''; err.textContent = key ? t(key) : ''; }
  }

  const setMode = (next, { focus = false } = {}) => {
    values[mode] = fields.contact.value;
    mode = next;
    contactField.dataset.mode = mode;
    Object.entries(MODES[mode]).forEach(([attr, val]) => fields.contact.setAttribute(attr, val));
    contactField.querySelectorAll('[data-mode-label]').forEach((el) => { el.hidden = el.dataset.modeLabel !== mode; });
    form.querySelector(`input[name="contactType"][value="${mode}"]`).checked = true;
    fields.contact.value = values[mode];
    lastPhone = mode === 'phone' ? fields.contact.value : '';
    setError(fields.contact, '');
    if (focus) fields.contact.focus();
  };

  const contactError = () => {
    const v = fields.contact.value.trim();
    if (mode === 'phone') {
      const n = phoneDigits(v).length;
      if (n === 0) return 'msg.phoneRequired';
      return n === 9 ? '' : 'msg.phoneInvalid';
    }
    if (!v) return 'msg.emailRequired';
    return EMAIL_RE.test(v) ? '' : 'msg.emailInvalid';
  };

  const validate = () => {
    let firstBad = null;
    if (fields.name.value.trim().length < 2) { setError(fields.name, 'msg.nameRequired'); firstBad ||= fields.name; }
    else setError(fields.name, '');

    const contactErr = contactError();
    setError(fields.contact, contactErr);
    if (contactErr) firstBad ||= fields.contact;

    if (!fields.consent.checked) { setError(fields.consent, 'msg.consentRequired'); firstBad ||= fields.consent; }
    else setError(fields.consent, '');

    return firstBad;
  };

  // Чернетка зберігається, щоб дані не губилися при помилці чи перезавантаженні
  const saveDraft = () => {
    values[mode] = fields.contact.value;
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({
        name: fields.name.value, phone: values.phone, email: values.email, mode, message: fields.message.value,
      }));
    } catch (_) { /* сховище недоступне */ }
  };
  try {
    const draft = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
    if (draft) {
      fields.name.value = draft.name || '';
      fields.message.value = draft.message || '';
      values.phone = draft.phone || ''; values.email = draft.email || '';
      mode = draft.mode === 'email' ? 'email' : 'phone';
      fields.contact.value = values[mode];
    }
  } catch (_) { /* ігноруємо */ }
  setMode(mode);

  // Після кліку/тапу курсор переходить у поле; з клавіатури фокус лишається на перемикачі (стрілки працюють далі)
  let pointerSwitch = false;
  contactField.querySelector('.seg').addEventListener('pointerdown', () => { pointerSwitch = true; });
  form.querySelectorAll('input[name="contactType"]').forEach((radio) => radio.addEventListener('change', () => {
    if (radio.checked) { setMode(radio.value, { focus: pointerSwitch }); saveDraft(); }
    pointerSwitch = false;
  }));
  fields.contact.addEventListener('focus', () => {
    if (mode === 'phone' && !fields.contact.value) { fields.contact.value = '+380 '; lastPhone = fields.contact.value; }
  });
  fields.contact.addEventListener('input', (e) => { if (mode === 'phone') applyPhoneMask(e); });
  ['name', 'contact', 'message'].forEach((k) => fields[k].addEventListener('input', saveDraft));
  // Порожній префікс не лишаємо; помилку показуємо при виході з поля, а виправлену прибираємо одразу під час введення
  fields.contact.addEventListener('blur', () => {
    if (mode === 'phone' && phoneDigits(fields.contact.value).length === 0) { fields.contact.value = ''; lastPhone = ''; }
    if (fields.contact.value.trim()) setError(fields.contact, contactError());
  });
  fields.name.addEventListener('blur', () => { if (fields.name.closest('.field').classList.contains('is-invalid')) validate(); });
  ['name', 'contact'].forEach((k) => fields[k].addEventListener('input', () => {
    if (!fields[k].closest('.field').classList.contains('is-invalid')) return;
    if (k === 'name' ? fields.name.value.trim().length >= 2 : !contactError()) setError(fields[k], '');
  }));
  fields.consent.addEventListener('change', () => { if (fields.consent.checked) setError(fields.consent, ''); });

  let statusState = null; // { type, keys }
  const renderStatus = () => {
    if (!statusState) { status.className = 'form__status'; status.textContent = ''; return; }
    const { type, keys } = statusState;
    status.className = `form__status is-${type}`;
    const contacts = '<a href="tel:+380952707611">+380 95 270 7611</a> · <a href="mailto:hello@ugp.ua">hello@ugp.ua</a>';
    const [title, ...rest] = keys.map(t);
    status.innerHTML = `<svg class="ico" aria-hidden="true"><use href="#i-${type === 'ok' ? 'check' : 'alert'}"/></svg>`
      + `<div><strong>${title}</strong>${rest.join(' ')}${type === 'error' ? ` ${contacts}` : ''}</div>`;
  };
  const showStatus = (type, ...keys) => { statusState = { type, keys }; renderStatus(); };

  // Під час надсилання кнопка вимкнена й показує спінер
  const setSending = (on) => {
    submitBtn.disabled = on;
    submitBtn.querySelector('.form__submit-idle').hidden = on;
    submitBtn.querySelector('.form__submit-busy').hidden = !on;
    if (on) form.setAttribute('aria-busy', 'true'); else form.removeAttribute('aria-busy');
  };

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

    setSending(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: fields.name.value.trim(),
          contact: mode === 'phone' ? `+380${phoneDigits(fields.contact.value)}` : fields.contact.value.trim(),
          contactType: mode,
          message: fields.message.value.trim(),
          consent: true,
          lang,
          page: location.href,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      form.reset();
      values.phone = ''; values.email = ''; setMode('phone');
      try { sessionStorage.removeItem(STORE_KEY); } catch (_) { /* ігноруємо */ }
      showStatus('ok', 'msg.successTitle', 'msg.success');
    } catch (_) {
      // Введені дані лишаються у формі
      showStatus('error', 'msg.sendFailed', 'msg.fallback');
    } finally {
      setSending(false);
    }
  });
})();
