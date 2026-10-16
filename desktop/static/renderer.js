// Draws the state Tudi Desktop's main process sends (src/main/main.ts). Plain DOM, no frameworks.
(() => {
  const text = {
    en: {
      title: 'Tudi Desktop',
      signedOutBody: 'Sign in with your Tudi Daily account. Your coding on this computer then powers your Tudi.',
      signIn: 'Sign in',
      waitingTitle: 'Approve in your browser',
      waitingBody: 'A Tudi Daily page opened in your browser. Approve this computer there.',
      cancel: 'Cancel',
      computer: 'This computer',
      save: 'Save',
      today: 'Today',
      you: 'you',
      ai: 'AI',
      reward: "Today's reward",
      week: 'Last 7 days',
      openApp: 'Open the app',
      signOut: 'Sign out',
      min: 'min',
      editors: 'Editors',
      install: 'Install',
      installAll: 'Install in all',
      noCodeYet: 'No coding yet today.',
      installing: 'Installing…',
      installed: 'Installed',
      noEditors: 'No VS Code, Cursor, Windsurf, VSCodium or Antigravity found on this computer.',
      errors: {
        install: 'The extension could not be installed. Try again.',
        cli: 'Tudi’s tracker could not be set up on this computer. Reinstall Tudi Desktop.',
        signIn: 'The sign-in did not finish. Try again.',
        offline: 'Tudi Daily cannot be reached. Your coding is kept and sent later.',
        keyStore: 'This computer has no secure key store, so Tudi Desktop cannot keep your sign-in.',
        rename: 'The name could not be saved.',
      },
    },
    tr: {
      title: 'Tudi Desktop',
      signedOutBody: 'Tudi Daily hesabınla giriş yap. Bu bilgisayarda yazdığın kod Tudi’nin gücü olur.',
      signIn: 'Giriş yap',
      waitingTitle: 'Tarayıcında onayla',
      waitingBody: 'Tarayıcında bir Tudi Daily sayfası açıldı. Bu bilgisayarı orada onayla.',
      cancel: 'Vazgeç',
      computer: 'Bu bilgisayar',
      save: 'Kaydet',
      today: 'Bugün',
      you: 'sen',
      ai: 'AI',
      reward: 'Günün ödülü',
      week: 'Son 7 gün',
      openApp: 'Uygulamayı aç',
      signOut: 'Çıkış yap',
      min: 'dk',
      editors: 'Editörler',
      install: 'Kur',
      installAll: 'Hepsine kur',
      noCodeYet: 'Bugün henüz kod yazılmadı.',
      installing: 'Kuruluyor…',
      installed: 'Kurulu',
      noEditors: 'Bu bilgisayarda VS Code, Cursor, Windsurf, VSCodium ya da Antigravity bulunamadı.',
      errors: {
        install: 'Eklenti kurulamadı. Yeniden dene.',
        cli: 'Tudi’nin sayacı bu bilgisayara kurulamadı. Tudi Desktop’ı yeniden kur.',
        signIn: 'Giriş tamamlanmadı. Yeniden dene.',
        offline: 'Tudi Daily’ye ulaşılamıyor. Kodun saklanıyor, sonra gönderilecek.',
        keyStore: 'Bu bilgisayarda güvenli anahtar deposu yok; Tudi Desktop girişini saklayamıyor.',
        rename: 'Ad kaydedilemedi.',
      },
    },
  };

  const app = document.getElementById('app');

  function el(tag, attributes = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      // CSSOM, not the style attribute: the page's CSP allows no inline styles.
      else if (key === 'style') node.style.cssText = value;
      else node[key] = value;
    }
    node.append(...children.filter(child => child !== null && child !== undefined));
    return node;
  }

  /** Puts the nodes on the page; null stands for a part this state does not have. */
  function show(...nodes) {
    app.replaceChildren(...nodes.filter(node => node !== null));
  }

  let lastPhase = null;

  function render(state) {
    const t = text[state.locale] || text.en;
    document.documentElement.lang = state.locale;
    // Entrance motion plays when the view changes, not on every minute's refresh.
    app.className = `${state.phase}${state.phase !== lastPhase ? ' fresh' : ''}`;
    lastPhase = state.phase;
    const error = state.error ? el('p', { className: `notice ${state.error === 'offline' ? 'info' : 'error'}`, role: state.error === 'offline' ? 'status' : 'alert' }, t.errors[state.error]) : null;
    const button = (label, onclick, kind = '') => el('button', { className: `button ${kind}`.trim(), onclick }, label);
    const delay = (node, ms) => {
      node.classList.add('appear');
      node.style.animationDelay = `${ms}ms`;
      return node;
    };

    // Signed out and waiting: the laptop on the left, the words and the one action on the right.
    if (state.phase !== 'signedIn') {
      const waiting = state.phase === 'waiting';
      show(
        el(
          'div',
          { className: 'welcome appear' },
          el('img', { src: 'art/tracker-laptop.webp', alt: '' }),
          el(
            'div',
            { className: 'welcome-text' },
            el('h1', {}, waiting ? t.waitingTitle : t.title),
            el('p', {}, waiting ? t.waitingBody : t.signedOutBody),
            waiting ? el('div', { className: 'dots', ariaHidden: true }, el('i'), el('i'), el('i')) : null,
            error,
            waiting ? button(t.cancel, () => window.tudi.cancelSignIn(), 'secondary') : button(t.signIn, () => window.tudi.signIn()),
          ),
        ),
      );
      return;
    }

    // A refresh never throws away a name the member is typing.
    const typing = document.activeElement?.id === 'device-name' ? document.activeElement.value : null;
    const name = el('input', { id: 'device-name', className: 'field', value: typing ?? state.deviceName, maxLength: 48 });
    const save = () => window.tudi.rename(name.value);
    name.addEventListener('keydown', event => event.key === 'Enter' && save());

    const summary = state.summary;
    const today = summary?.today;
    const cap = today?.dailyCap ?? 240;
    const rewarded = Math.min(today?.rewardedMinutes ?? 0, cap);
    const week = summary?.week ?? [];
    const tallest = Math.max(60, ...week.map(day => day.weightedMinutes));
    const weekday = new Intl.DateTimeFormat(state.locale, { weekday: 'short', timeZone: 'UTC' });
    const languages = Object.entries(today?.languages ?? {})
      .filter(([, minutes]) => minutes >= 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const metric = (art, value, label) =>
      el('div', { className: 'metric', ariaLabel: `${value} ${t.min} ${label}` }, el('img', { src: art, alt: '' }), el('div', { className: 'well' }, el('span', { className: 'value' }, String(value)), el('span', { className: 'name' }, label)));

    // While setup is unfinished (an editor without the extension, or none found) the editors take the week's place;
    // afterwards they become a line of badges under the week.
    const editors = state.editors ?? [];
    const missing = editors.filter(editor => !editor.hasExtension && !editor.installing);
    const setup = state.editors !== null && (editors.length === 0 || editors.some(editor => !editor.hasExtension));
    const right = setup
      ? el(
          'div',
          { className: 'card grow' },
          el('div', { className: 'card-head' }, el('h2', {}, t.editors), missing.length > 1 ? button(t.installAll, () => window.tudi.installAll(), 'small') : null),
          ...(editors.length === 0
            ? [el('p', { className: 'muted' }, t.noEditors)]
            : editors.map(editor =>
                el(
                  'div',
                  { className: 'editor' },
                  el('span', { className: 'editor-name' }, editor.name),
                  editor.hasExtension
                    ? el('span', { className: 'badge success' }, t.installed)
                    : editor.installing
                      ? el('span', { className: 'badge info' }, t.installing)
                      : button(t.install, () => window.tudi.installExtension(editor.id), missing.length > 1 ? 'secondary small' : 'small'),
                ),
              )),
        )
      : el(
          'div',
          { className: 'card grow' },
          el('h2', {}, t.week),
          el(
            'div',
            { className: 'week' },
            ...week.map((day, index) =>
              el(
                'div',
                { className: `day${index === week.length - 1 ? ' today' : ''}${day.weightedMinutes < 1 ? ' empty' : ''}`, title: `${Math.floor(day.weightedMinutes)} ${t.min}` },
                el('span', { className: 'minutes' }, String(Math.floor(day.weightedMinutes))),
                el('div', { className: 'bar', style: `height:${Math.max(4, (day.weightedMinutes / tallest) * 100)}%;animation-delay:${200 + index * 40}ms` }),
                el('span', {}, weekday.format(new Date(`${day.date}T00:00:00Z`))),
              ),
            ),
          ),
          editors.length > 0 ? el('div', { className: 'badges', ariaLabel: t.editors }, ...editors.map(editor => el('span', { className: 'badge success' }, editor.name))) : null,
        );

    const focused = typing !== null;
    show(
      el('header', { className: 'top' }, el('h1', {}, t.title), el('div', { className: 'device' }, el('label', { className: 'label', htmlFor: 'device-name' }, t.computer), name, button(t.save, save, 'secondary small'))),
      error,
      el(
        'div',
        { className: 'columns' },
        el(
          'section',
          { className: 'col' },
          delay(el('div', { className: 'metrics' }, metric('art/stat-human.webp', Math.floor(today?.humanMinutes ?? 0), t.you), metric('art/stat-ai.webp', Math.floor(today?.aiMinutes ?? 0), t.ai)), 0),
          delay(
            el(
              'div',
              { className: 'card' },
              el('h2', {}, t.reward),
              el(
                'div',
                { className: 'progress', role: 'progressbar', ariaValueNow: rewarded, ariaValueMin: 0, ariaValueMax: cap, ariaLabel: `${t.reward}: ${rewarded} / ${cap} ${t.min}` },
                el('div', { className: 'track' }, rewarded > 0 ? el('div', { className: `fill${rewarded >= cap ? ' done' : ''}`, style: `width:${(rewarded / cap) * 100}%` }) : null),
                el('span', { className: 'count' }, `${rewarded}/${cap}`),
              ),
              // Today's languages, as in the app's Code Tower.
              languages.length > 0
                ? el('div', { className: 'badges' }, ...languages.map(([language, minutes]) => el('span', { className: 'badge info' }, `${language} · ${Math.floor(minutes)} ${t.min}`)))
                : el('p', { className: 'muted' }, t.noCodeYet),
            ),
            60,
          ),
          el('div', { className: 'spacer' }),
          el('div', { className: 'actions' }, button(t.signOut, () => window.tudi.signOut(), 'secondary'), button(t.openApp, () => window.tudi.openApp())),
        ),
        el('section', { className: 'col' }, delay(right, 120)),
      ),
    );
    if (focused) name.focus();
  }

  window.tudi.onState(render);
  window.tudi.state().then(render);
})();
