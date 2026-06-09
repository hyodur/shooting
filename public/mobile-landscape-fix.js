(() => {
  const style = document.createElement("style");
  style.textContent = `
    @media (orientation: landscape) and (max-height: 650px) and (min-width: 640px) {
      body[data-game-screen="true"] > button { top: 0.35rem !important; right: 0.35rem !important; height: 2.25rem !important; padding-inline: 0.65rem !important; font-size: 0.8rem !important; }
      body[data-game-screen="true"] main { padding-top: 0 !important; padding-bottom: 0 !important; }
      body[data-game-screen="true"] .space-field { height: calc(100dvh - 7rem) !important; min-height: 15rem !important; }
      body[data-game-screen="true"] .problem-column { gap: 0.1rem !important; }
      body[data-game-screen="true"] .problem-column > * { margin-top: 0 !important; }
      body[data-game-screen="true"] .mobile-problem-panel > div:first-child { min-height: 1.35rem; margin-bottom: 0 !important; }
      body[data-game-screen="true"] .mobile-problem-panel h2 { display: none; }
      body[data-game-screen="true"] .mobile-problem-panel > div:first-child span { padding: 0.1rem 0.4rem !important; font-size: 0.65rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel > div:last-child { padding: 0.15rem 0.3rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel [class*="grid-cols-"] { column-gap: 0.25rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel input { width: 3.35rem !important; height: 1.9rem !important; font-size: 1rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel .text-3xl { font-size: 1.05rem !important; line-height: 1.15rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel .text-4xl { font-size: 1.3rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel .text-xl { gap: 0.25rem !important; font-size: 0.8rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel [class*="py-2"] { padding-top: 0.12rem !important; padding-bottom: 0.12rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel [class*="py-1"] { padding-top: 0.05rem !important; padding-bottom: 0.05rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel [class*="my-2"] { margin-top: 0.2rem !important; margin-bottom: 0.2rem !important; }
      body[data-game-screen="true"] .mobile-number-pad { align-self: start !important; }
      body[data-game-screen="true"] .mobile-number-pad button { height: 1.8rem !important; }
    }
  `;
  document.head.append(style);

  let gameWasVisible = false;
  function keepGameAtTop() {
    const gameIsVisible = Boolean(document.querySelector(".space-field"));
    if (gameIsVisible && !gameWasVisible) window.scrollTo(0, 0);
    gameWasVisible = gameIsVisible;
  }
  new MutationObserver(keepGameAtTop).observe(document.body, { childList: true, subtree: true });
  keepGameAtTop();
})();
