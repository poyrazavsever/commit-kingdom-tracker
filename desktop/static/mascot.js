// Shows the mood Tudi Desktop's main process sends (src/main/mascot.ts) and, once, the hello bubble.
(() => {
  const intro = {
    en: 'I’m here! I nap when you stop coding. Hide me from the tray.',
    tr: 'Buradayım! Kod durunca uyurum. Tepsiden gizleyebilirsin.',
  };
  const INTRO_MS = 7000;
  const tudi = document.querySelector('.tudi');
  const bubble = document.querySelector('.bubble');
  let introShown = false;

  window.mascot.onView(view => {
    tudi.dataset.mood = view.mood;
    if (view.intro && !introShown) {
      introShown = true;
      bubble.querySelector('p').textContent = intro[view.locale] || intro.en;
      // After Tudi has landed.
      setTimeout(() => bubble.classList.add('on'), 700);
      setTimeout(() => bubble.classList.remove('on'), 700 + INTRO_MS);
    }
  });
})();
