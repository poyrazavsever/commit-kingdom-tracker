// Draws the state Commit Kingdom Desktop's main process sends (src/main/main.ts). Plain DOM, no frameworks.
(() => {
  const text = {
    en: {
      title: 'Commit Kingdom Desktop',
      signedOutBody: 'Sign in with your Commit Kingdom account. Your coding on this computer then powers your kingdom.',
      signIn: 'Sign in',
      waitingTitle: 'Approve in your browser',
      waitingBody: 'A Commit Kingdom page opened in your browser. Approve this computer there.',
      cancel: 'Cancel',
      pages: { today: 'Today', tools: 'Editors and AI', plus: 'Kingdom Plus' },
      computer: 'This computer',
      save: 'Save',
      signOut: 'Sign out',
      openApp: 'Open the app',
      kingdomTime: 'Kingdom time',
      you: 'You',
      ai: 'AI-assisted',
      reward: "Today's reward",
      week: 'Last 7 days',
      noCodeYet: 'No coding yet today.',
      setupTitle: (count) => (count === 1 ? 'One editor has no extension yet' : `${count} editors have no extension yet`),
      setupAction: 'Set up',
      explorePlus: 'Explore Plus',
      editors: 'Editors',
      install: 'Install',
      installAll: 'Install in all',
      installing: 'Installing…',
      installed: 'Installed',
      restartIde: 'Restart the IDE to start counting',
      noEditors: 'No VS Code, Cursor, Windsurf, VSCodium, Antigravity or JetBrains IDE found on this computer.',
      agents: 'AI agents',
      counting: 'Counting',
      agentsNote: 'Agents need nothing installed: their work counts as AI-assisted, at half the reward, and trains Intelligence.',
      noAgents: 'No Claude Code, Codex, Gemini CLI or other agent logs on this computer yet. They show up here once you use one.',
      plusActive: 'Kingdom Plus is on',
      plusUntil: (date, renews) => (renews ? `Renews on ${date}` : `Until ${date}`),
      plusForever: 'Yours with no end date',
      plusPitch: 'The full picture of your code',
      plusPitchBody: 'All of your reports, and small perks for your kingdom. It never sells power.',
      plusWhere: 'Kingdom Plus is bought in the Commit Kingdom app. The perks belong to your account, so they work here too.',
      perks: [
        ['nav-reports.webp', 'Detailed reports', 'Hourly breakdown, focus blocks and editors; monthly and yearly reports, CSV.'],
        ['reports-share.webp', 'Every README card', 'Daily, weekly, monthly and yearly cards and themes on your GitHub profile.'],
        ['chest-gold.webp', 'A 4th chest slot', 'One more slot and 25% shorter opening; the same odds for everyone.'],
        ['room-barracks.webp', '20% faster training', 'Troops are ready sooner. Troops are never sold.'],
        ['hud-freeze.webp', '+2 freezes a month', 'Keeps your flame on days you cannot code.'],
        ['item-cape-frost-mantle.webp', 'A monthly exclusive', 'A permanent cape and the Plus badge every month.'],
      ],
      min: 'min',
      hour: 'h',
      errors: {
        install: 'The extension could not be installed. Try again.',
        cli: 'The Commit Kingdom tracker could not be set up on this computer. Reinstall Commit Kingdom Desktop.',
        signIn: 'The sign-in did not finish. Try again.',
        offline: 'Commit Kingdom cannot be reached. Your coding is kept and sent later.',
        keyStore: 'This computer has no secure key store, so Commit Kingdom Desktop cannot keep your sign-in.',
        rename: 'The name could not be saved.',
      },
    },
    tr: {
      title: 'Commit Kingdom Desktop',
      signedOutBody: 'Commit Kingdom hesabınla giriş yap. Bu bilgisayarda yazdığın kod krallığının gücü olur.',
      signIn: 'Giriş yap',
      waitingTitle: 'Tarayıcında onayla',
      waitingBody: 'Tarayıcında bir Commit Kingdom sayfası açıldı. Bu bilgisayarı orada onayla.',
      cancel: 'Vazgeç',
      pages: { today: 'Bugün', tools: 'Editörler ve AI', plus: 'Kingdom Plus' },
      computer: 'Bu bilgisayar',
      save: 'Kaydet',
      signOut: 'Çıkış yap',
      openApp: 'Uygulamayı aç',
      kingdomTime: 'Krallık süresi',
      you: 'Sen',
      ai: 'AI destekli',
      reward: 'Günün ödülü',
      week: 'Son 7 gün',
      noCodeYet: 'Bugün henüz kod yazılmadı.',
      setupTitle: (count) => (count === 1 ? 'Bir editörde eklenti eksik' : `${count} editörde eklenti eksik`),
      setupAction: 'Kur',
      explorePlus: 'Plus’ı keşfet',
      editors: 'Editörler',
      install: 'Kur',
      installAll: 'Hepsine kur',
      installing: 'Kuruluyor…',
      installed: 'Kurulu',
      restartIde: 'Saymaya başlaması için IDE’yi yeniden başlat',
      noEditors: 'Bu bilgisayarda VS Code, Cursor, Windsurf, VSCodium, Antigravity ya da JetBrains IDE bulunamadı.',
      agents: 'AI ajanları',
      counting: 'Sayılıyor',
      agentsNote: 'Ajanlar için bir şey kurman gerekmez: çalışmaları AI destekli sayılır, yarım ödül verir ve Zekâ’yı eğitir.',
      noAgents: 'Bu bilgisayarda henüz Claude Code, Codex, Gemini CLI ya da başka bir ajan kaydı yok. Kullanmaya başlayınca burada görünür.',
      plusActive: 'Kingdom Plus açık',
      plusUntil: (date, renews) => (renews ? `${date} tarihinde yenilenir` : `${date} tarihine kadar`),
      plusForever: 'Süresiz senin',
      plusPitch: 'Kodunun tam resmi',
      plusPitchBody: 'Raporlarının tamamı ve krallığına küçük ayrıcalıklar. Oyunda güç satmaz.',
      plusWhere: 'Kingdom Plus, Commit Kingdom uygulamasından alınır. Ayrıcalıklar hesabına bağlıdır; burada da çalışır.',
      perks: [
        ['nav-reports.webp', 'Ayrıntılı raporlar', 'Saatlik dağılım, odak blokları ve editörler; aylık ve yıllık rapor, CSV.'],
        ['reports-share.webp', 'Tüm README kartları', 'Günlük, haftalık, aylık ve yıllık kartlar ve temalar GitHub profilinde.'],
        ['chest-gold.webp', '4. sandık yuvası', 'Bir yuva daha ve %25 kısa açılış; oranlar herkesle aynı.'],
        ['room-barracks.webp', '%20 hızlı eğitim', 'Askerlerin daha erken hazır. Asker satılmaz.'],
        ['hud-freeze.webp', 'Her ay +2 freeze', 'Kod yazamadığın günlerde alevini korur.'],
        ['item-cape-frost-mantle.webp', 'Aylık özel eşya', 'Her ay kalıcı bir pelerin ve Plus rozeti.'],
      ],
      min: 'dk',
      hour: 'sa',
      errors: {
        install: 'Eklenti kurulamadı. Yeniden dene.',
        cli: 'Commit Kingdom sayacı bu bilgisayara kurulamadı. Commit Kingdom Desktop’ı yeniden kur.',
        signIn: 'Giriş tamamlanmadı. Yeniden dene.',
        offline: 'Commit Kingdom’a ulaşılamıyor. Kodun saklanıyor, sonra gönderilecek.',
        keyStore: 'Bu bilgisayarda güvenli anahtar deposu yok; Commit Kingdom Desktop girişini saklayamıyor.',
        rename: 'Ad kaydedilemedi.',
      },
    },
  };

  /** The app's sticker for each page in the menu (design-system assets). */
  const pageArt = { today: 'art/nav-today.webp', tools: 'art/tracker-laptop.webp', plus: 'art/badge-kingdom-plus.webp' };
  const languageArt = { typescript: 'language-typescript', javascript: 'language-javascript', 'c#': 'language-csharp', css: 'language-css', python: 'language-python' };
  const app = document.getElementById('app');
  const toastHost = document.getElementById('toasts');
  let toastId = 0;
  let lastErrorId = 0;
  let page = 'today';
  let lastState = null;

  function el(tag, attributes = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      // CSSOM, not the style attribute: the page's CSP allows no inline styles.
      else if (key === 'style') node.style.cssText = value;
      else node[key] = value;
    }
    node.append(...children.filter(child => child !== null && child !== undefined && child !== false));
    return node;
  }

  /** Puts the nodes on the page; null stands for a part this state does not have. */
  function show(...nodes) {
    app.replaceChildren(...nodes.filter(node => node !== null));
  }

  function toast(message, tone) {
    const id = ++toastId;
    const closeLabel = document.documentElement.lang === 'tr' ? 'Bildirimi kapat' : 'Dismiss notification';
    const node = el(
      'div',
      { className: `toast notice ${tone}`, role: tone === 'error' ? 'alert' : 'status' },
      el('span', { className: 'toast-message' }, message),
      el('button', { className: 'toast-close', ariaLabel: closeLabel, onclick: () => closeToast(node) }, '×'),
    );
    node.dataset.toastId = String(id);
    toastHost.append(node);
    restackToasts();
  }

  function closeToast(node) {
    if (node._dismissTimer) clearTimeout(node._dismissTimer);
    node.remove();
    restackToasts();
  }

  function restackToasts() {
    const items = [...toastHost.children];
    const visibleDepth = Math.min(Math.max(items.length - 1, 0), 2);
    toastHost.style.setProperty('--stack-depth', String(visibleDepth));
    items.forEach((item, index) => {
      const depth = Math.min(index, 2);
      item.style.setProperty('--stack-inset', `${depth * 7}px`);
      item.style.setProperty('--stack-offset', `${(visibleDepth - depth) * 10}px`);
      item.style.setProperty('--stack-z', String(100 - index));
      item.style.setProperty('--stack-opacity', String(1 - depth * 0.1));
      item.toggleAttribute('aria-hidden', index > 0);
      item.querySelector('.toast-close').tabIndex = index === 0 ? 0 : -1;
      if (index === 0 && !item._dismissTimer) item._dismissTimer = setTimeout(() => closeToast(item), 5000);
    });
  }

  let lastView = null;

  function render(state) {
    lastState = state;
    const t = text[state.locale] || text.en;
    document.documentElement.lang = state.locale;
    // Entrance motion plays when the view changes, not on every minute's refresh.
    const viewKey = state.phase === 'signedIn' ? `signedIn:${page}` : state.phase;
    app.className = `${state.phase}${viewKey !== lastView ? ' fresh' : ''}`;
    lastView = viewKey;
    if (state.error && state.errorId !== lastErrorId) {
      lastErrorId = state.errorId;
      toast(t.errors[state.error], state.error === 'offline' ? 'info' : 'error');
    }
    const button = (label, onclick, kind = '') => el('button', { className: `button ${kind}`.trim(), onclick }, label);

    // Signed out and waiting: the laptop on top, the centred title and words, the one action at the bottom.
    if (state.phase !== 'signedIn') {
      const waiting = state.phase === 'waiting';
      show(
        el(
          'div',
          { className: 'welcome appear' },
          el('img', { src: 'art/tracker-laptop.webp', alt: '' }),
          el('h1', {}, waiting ? t.waitingTitle : t.title),
          el('p', {}, waiting ? t.waitingBody : t.signedOutBody),
          waiting ? el('div', { className: 'dots', ariaHidden: true }, el('i'), el('i'), el('i')) : null,
        ),
        el('div', { className: 'welcome-action' }, waiting ? button(t.cancel, () => window.tudi.cancelSignIn(), 'secondary') : button(t.signIn, () => window.tudi.signIn())),
      );
      return;
    }

    const duration = (minutes) => {
      const whole = Math.floor(minutes ?? 0);
      return whole < 60 ? `${whole} ${t.min}` : `${Math.floor(whole / 60)} ${t.hour} ${whole % 60} ${t.min}`;
    };
    const dayName = new Intl.DateTimeFormat(state.locale, { weekday: 'short', timeZone: 'UTC' });
    const longDate = new Intl.DateTimeFormat(state.locale, { day: 'numeric', month: 'long', year: 'numeric' });
    const utc = (iso) => new Date(`${iso}T00:00:00Z`);

    /** A card whose sticker rests on its top-left corner, as in the app's Reports. */
    const card = (art, title, ...children) =>
      el('div', { className: `card${art ? ' stickered' : ''}` }, art ? el('img', { className: 'card-art', src: art, alt: '' }) : null, title ? el('div', { className: 'card-head' }, ...(Array.isArray(title) ? title : [el('h2', {}, title)])) : null, ...children);

    /** The human / AI split: one striped bar, then the two numbers with their stickers. */
    const split = (human, ai) => {
      const total = human + ai;
      return [
        el('div', { className: 'split-track' }, total > 0 ? el('div', { className: 'split-human', style: `width:${(human / total) * 100}%` }) : null, total > 0 && ai > 0 ? el('div', { className: 'split-ai', style: `width:${(ai / total) * 100}%` }) : null),
        el(
          'div',
          { className: 'split-legend' },
          el('div', { className: 'legend' }, el('img', { src: 'art/stat-human.webp', alt: '' }), el('div', {}, el('small', {}, t.you), el('strong', {}, duration(human)))),
          el('div', { className: 'legend' }, el('img', { src: 'art/stat-ai.webp', alt: '' }), el('div', {}, el('small', {}, t.ai), el('strong', {}, duration(ai)))),
        ),
      ];
    };

    /** Seven pill bars, a value above each and the short day name below. */
    const bars = (days, value) => {
      const tallest = Math.max(60, ...days.map(value));
      return el(
        'div',
        { className: 'week' },
        ...days.map((day, index) =>
          el(
            'div',
            { className: `day${index === days.length - 1 ? ' today' : ''}${value(day) < 1 ? ' empty' : ''}`, title: duration(value(day)) },
            el('span', { className: 'minutes' }, String(Math.floor(value(day)))),
            el('div', { className: 'pill' }, el('div', { className: 'bar', style: `height:${Math.max(0, (value(day) / tallest) * 100)}%;animation-delay:${120 + index * 40}ms` })),
            el('span', {}, dayName.format(utc(day.date))),
          ),
        ),
      );
    };

    const languageIcon = (name) => {
      const art = languageArt[name.toLowerCase()];
      return art ? el('img', { className: 'row-icon', src: `art/${art}.webp`, alt: '' }) : el('span', { className: 'row-icon letter' }, name.slice(0, 1).toUpperCase());
    };
    const editors = state.editors ?? [];
    const missing = editors.filter(editor => !editor.hasExtension && !editor.installing);
    const pages = {
      today() {
        const today = state.summary?.today;
        const cap = today?.dailyCap ?? 240;
        const rewarded = Math.min(today?.rewardedMinutes ?? 0, cap);
        const languages = Object.entries(today?.languages ?? {}).filter(([, minutes]) => minutes >= 1).sort((a, b) => b[1] - a[1]).slice(0, 4);
        return el(
          'div',
          { className: 'grid' },
          el(
            'div',
            { className: 'col' },
            card('art/hud-clock.webp', t.kingdomTime, el('div', { className: 'big' }, duration(today?.weightedMinutes)), ...split(today?.humanMinutes ?? 0, today?.aiMinutes ?? 0)),
            card(
              null,
              t.reward,
              el(
                'div',
                { className: 'progress', role: 'progressbar', ariaValueNow: rewarded, ariaValueMin: 0, ariaValueMax: cap, ariaLabel: `${t.reward}: ${rewarded} / ${cap} ${t.min}` },
                el('div', { className: 'track' }, rewarded > 0 ? el('div', { className: `fill${rewarded >= cap ? ' done' : ''}`, style: `width:${(rewarded / cap) * 100}%` }) : null),
                el('span', { className: 'count' }, `${rewarded}/${cap}`),
              ),
              languages.length > 0
                ? el('div', { className: 'badges' }, ...languages.map(([language, minutes]) => el('span', { className: 'badge info with-icon' }, languageIcon(language), `${language} · ${duration(minutes)}`)))
                : el('p', { className: 'muted' }, t.noCodeYet),
            ),
          ),
          el(
            'div',
            { className: 'col' },
            card('art/nav-reports.webp', t.week, bars(state.summary?.week ?? [], day => day.weightedMinutes)),
            missing.length > 0 || editors.length === 0
              ? el('div', { className: 'nudge' }, el('img', { src: 'art/tracker-laptop.webp', alt: '' }), el('strong', {}, editors.length === 0 ? t.noEditors : t.setupTitle(missing.length)), button(t.setupAction, () => go('tools'), 'small'))
              : null,
          ),
        );
      },

      tools() {
        const agents = state.aiTools ?? [];
        return el(
          'div',
          { className: 'grid' },
          el(
            'div',
            { className: 'col' },
            card(
              null,
              [el('h2', {}, t.editors), missing.length > 1 ? button(t.installAll, () => window.tudi.installAll(), 'small') : null],
              ...(state.editors === null
                ? []
                : editors.length === 0
                  ? [el('p', { className: 'muted' }, t.noEditors)]
                  : editors.map(editor =>
                      el(
                        'div',
                        { className: 'editor' },
                        editor.icon ? el('img', { className: 'editor-icon', src: editor.icon, alt: '' }) : el('span', { className: 'editor-icon blank' }),
                        el('span', { className: 'editor-name' }, editor.name, editor.restart ? el('small', { className: 'editor-note' }, t.restartIde) : null),
                        editor.hasExtension
                          ? el('span', { className: 'badge success' }, t.installed)
                          : editor.installing
                            ? el('span', { className: 'badge info' }, t.installing)
                            : button(t.install, () => window.tudi.installExtension(editor.id), missing.length > 1 ? 'secondary small' : 'small'),
                      ),
                    )),
            ),
          ),
          el(
            'div',
            { className: 'col' },
            card(
              null,
              t.agents,
              ...(agents.length === 0
                ? [el('p', { className: 'muted' }, t.noAgents)]
                : agents.map(agent =>
                    el('div', { className: 'editor' }, el('img', { className: 'editor-icon', src: `art/agents/${agent.id}.webp`, alt: '' }), el('span', { className: 'editor-name' }, agent.name), el('span', { className: 'badge success' }, t.counting)),
                  )),
              el('p', { className: 'note' }, el('img', { src: 'art/stat-ai.webp', alt: '' }), t.agentsNote),
            ),
          ),
        );
      },

      plus() {
        const plus = state.plus;
        const head = plus?.active
          ? el(
              'div',
              { className: 'plus-card' },
              el('img', { className: 'plus-logo', src: 'art/plus-logo.webp', alt: 'Kingdom Plus' }),
              el('div', { className: 'plus-face' }, el('h3', {}, t.plusActive), el('p', {}, plus.expiresAt ? t.plusUntil(longDate.format(new Date(plus.expiresAt)), plus.renews) : t.plusForever)),
            )
          : plusCard(t.plusPitch, t.plusPitchBody);
        return el(
          'div',
          { className: 'stack' },
          head,
          el('div', { className: 'perks' }, ...t.perks.map(([art, title, body]) => el('div', { className: 'perk' }, el('img', { src: `art/${art}`, alt: '' }), el('div', {}, el('strong', {}, title), el('p', {}, body))))),
          el('p', { className: 'muted center plus-note' }, t.plusWhere),
        );
      },
    };

    /** The app's shared Kingdom Plus card: gold frame, ribbon title, one line and the green action. */
    function plusCard(title, body) {
      return el(
        'div',
        { className: 'plus-card' },
        el('img', { className: 'plus-logo', src: 'art/plus-logo.webp', alt: 'Kingdom Plus' }),
        el(
          'div',
          { className: 'plus-face' },
          el('h3', {}, title),
          body ? el('p', {}, body) : null,
          el('button', { className: 'button go', onclick: () => window.tudi.openLink('plus') }, el('img', { src: 'art/plus-star-white.webp', alt: '' }), t.explorePlus),
        ),
      );
    }

    // A refresh never throws away a name the member is typing.
    const typing = document.activeElement?.id === 'device-name' ? document.activeElement.value : null;
    const name = el('input', { id: 'device-name', className: 'field', value: typing ?? state.deviceName, maxLength: 48, ariaLabel: t.computer });
    const save = () => window.tudi.rename(name.value);
    name.addEventListener('keydown', event => event.key === 'Enter' && save());
    const scroll = app.querySelector('.page-body')?.scrollTop ?? 0;

    show(
      el(
        'div',
        { className: 'shell' },
        el(
          'nav',
          { className: 'side' },
          el('img', { className: 'wordmark', src: 'art/wordmark.webp', alt: 'Commit Kingdom' }),
          ...Object.keys(pages).map(id =>
            el(
              'button',
              { className: `nav-item${page === id ? ' active' : ''}${id === 'tools' && missing.length > 0 ? ' alert' : ''}`, ariaCurrent: page === id ? 'page' : null, onclick: () => go(id) },
              el('img', { src: pageArt[id], alt: '' }),
              t.pages[id],
            ),
          ),
          el('div', { className: 'spacer' }),
          el('div', { className: 'device-box' }, el('label', { className: 'label', htmlFor: 'device-name' }, t.computer), el('div', { className: 'row' }, name, el('button', { className: 'icon-button', ariaLabel: t.save, title: t.save, onclick: save }, el('img', { src: 'art/icon-edit.webp', alt: '' })))),
          el('button', { className: 'button secondary small', onclick: () => window.tudi.signOut() }, t.signOut),
        ),
        el(
          'section',
          { className: 'page' },
          el('header', { className: 'page-head' }, el('h1', {}, t.pages[page]), button(t.openApp, () => window.tudi.openApp(), 'small')),
          el('div', { className: 'page-body' }, pages[page]()),
        ),
      ),
    );
    const body = app.querySelector('.page-body');
    if (body && viewKey === lastView && !app.classList.contains('fresh')) body.scrollTop = scroll;
    if (typing !== null) name.focus();
  }

  function go(id) {
    page = id;
    if (lastState) render(lastState);
  }

  window.tudi.onState(render);
  window.tudi.state().then(render);
})();
