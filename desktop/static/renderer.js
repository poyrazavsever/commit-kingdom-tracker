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
      errors: {
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
      errors: {
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
    app.classList.toggle('fresh', state.phase !== lastPhase);
    lastPhase = state.phase;
    const error = state.error ? el('p', { className: `notice ${state.error === 'offline' ? 'info' : 'error'}`, role: state.error === 'offline' ? 'status' : 'alert' }, t.errors[state.error]) : null;
    const button = (label, onclick, kind = '') => el('button', { className: `button ${kind}`.trim(), onclick }, label);

    if (state.phase === 'signedOut') {
      show(
        el('div', { className: 'state appear' }, el('img', { src: 'art/tracker-laptop.webp', alt: '' }), el('h1', {}, t.title), el('p', {}, t.signedOutBody)),
        error,
        el('div', { className: 'spacer' }),
        button(t.signIn, () => window.tudi.signIn()),
      );
      return;
    }

    if (state.phase === 'waiting') {
      show(
        el('div', { className: 'state appear' }, el('img', { src: 'art/tracker-laptop.webp', alt: '' }), el('h1', {}, t.waitingTitle), el('p', {}, t.waitingBody), el('div', { className: 'dots', ariaHidden: true }, el('i'), el('i'), el('i'))),
        el('div', { className: 'spacer' }),
        button(t.cancel, () => window.tudi.cancelSignIn(), 'secondary'),
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
    const weekday = new Intl.DateTimeFormat(state.locale, { weekday: 'narrow', timeZone: 'UTC' });
    const metric = (art, value, label) =>
      el('div', { className: 'metric', ariaLabel: `${value} ${t.min} ${label}` }, el('img', { src: art, alt: '' }), el('div', { className: 'well' }, el('span', { className: 'value' }, String(value)), el('span', { className: 'name' }, label)));
    const delay = (node, ms) => {
      node.classList.add('appear');
      node.style.animationDelay = `${ms}ms`;
      return node;
    };

    const focused = typing !== null;
    show(
      error ?? el('h1', {}, t.title),
      delay(el('div', { className: 'card' }, el('label', { className: 'label', htmlFor: 'device-name' }, t.computer), el('div', { className: 'row' }, name, button(t.save, save, 'secondary small'))), 0),
      delay(el('div', { className: 'metrics' }, metric('art/stat-human.webp', Math.floor(today?.humanMinutes ?? 0), t.you), metric('art/stat-ai.webp', Math.floor(today?.aiMinutes ?? 0), t.ai)), 60),
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
        ),
        120,
      ),
      delay(
        el(
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
                el('div', { className: 'bar', style: `height:${Math.max(6, (day.weightedMinutes / tallest) * 100)}%;animation-delay:${200 + index * 40}ms` }),
                el('span', {}, weekday.format(new Date(`${day.date}T00:00:00Z`))),
              ),
            ),
          ),
        ),
        180,
      ),
      el('div', { className: 'actions' }, button(t.signOut, () => window.tudi.signOut(), 'secondary'), button(t.openApp, () => window.tudi.openApp())),
    );
    if (focused) name.focus();
  }

  window.tudi.onState(render);
  window.tudi.state().then(render);
})();
