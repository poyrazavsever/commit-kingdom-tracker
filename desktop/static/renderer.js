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
      openApp: 'Open Tudi Daily',
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
      openApp: 'Tudi Daily’yi aç',
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

  function render(state) {
    const t = text[state.locale] || text.en;
    document.documentElement.lang = state.locale;
    const error = state.error ? el('p', { className: 'error', role: 'alert' }, t.errors[state.error]) : null;

    if (state.phase === 'signedOut') {
      show(
        el('h1', {}, t.title),
        el('p', {}, t.signedOutBody),
        error,
        el('div', { className: 'spacer' }),
        el('button', { className: 'primary', onclick: () => window.tudi.signIn() }, t.signIn),
      );
      return;
    }

    if (state.phase === 'waiting') {
      show(
        el('h1', {}, t.waitingTitle),
        el('p', {}, t.waitingBody),
        el('div', { className: 'spacer' }),
        el('button', { onclick: () => window.tudi.cancelSignIn() }, t.cancel),
      );
      return;
    }

    const name = el('input', { value: state.deviceName, maxLength: 48, ariaLabel: t.computer });
    const save = () => window.tudi.rename(name.value);
    name.addEventListener('keydown', event => event.key === 'Enter' && save());

    const summary = state.summary;
    const today = summary?.today;
    const minutes = value => `${Math.floor(value ?? 0)} ${t.min}`;
    const cap = today?.dailyCap ?? 240;
    const rewarded = today?.rewardedMinutes ?? 0;
    const tallest = Math.max(60, ...(summary?.week ?? []).map(day => day.weightedMinutes));
    const weekday = new Intl.DateTimeFormat(state.locale, { weekday: 'narrow', timeZone: 'UTC' });

    show(
      el('h1', {}, t.title),
      error,
      el('div', { className: 'box' }, el('span', { className: 'label' }, t.computer), el('div', { className: 'row' }, name, el('button', { onclick: save, style: 'flex:0' }, t.save))),
      el(
        'div',
        { className: 'box' },
        el('span', { className: 'label' }, t.today),
        el(
          'div',
          { className: 'row' },
          el('div', {}, el('div', { className: 'big' }, minutes(today?.humanMinutes)), el('span', { className: 'label' }, t.you)),
          el('div', {}, el('div', { className: 'big' }, minutes(today?.aiMinutes)), el('span', { className: 'label' }, t.ai)),
        ),
        el('span', { className: 'label' }, `${t.reward}: ${rewarded} / ${cap} ${t.min}`),
        el('div', { className: 'bar', role: 'progressbar', ariaValueNow: rewarded, ariaValueMax: cap, ariaLabel: t.reward }, el('div', { style: `width:${Math.min(100, (rewarded / cap) * 100)}%` })),
      ),
      el(
        'div',
        { className: 'box' },
        el('span', { className: 'label' }, t.week),
        el(
          'div',
          { className: 'week' },
          ...(summary?.week ?? []).map(day =>
            el(
              'div',
              { title: minutes(day.weightedMinutes) },
              el('span', { style: `height:${(day.weightedMinutes / tallest) * 100}%` }),
              weekday.format(new Date(`${day.date}T00:00:00Z`)),
            ),
          ),
        ),
      ),
      el('div', { className: 'spacer' }),
      el('div', { className: 'row' }, el('button', { onclick: () => window.tudi.signOut() }, t.signOut), el('button', { className: 'primary', onclick: () => window.tudi.openApp() }, t.openApp)),
    );
  }

  window.tudi.onState(render);
  window.tudi.state().then(render);
})();
