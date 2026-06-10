(() => {
  const MOBILE_INPUT_SELECTOR = 'input[inputmode="numeric"]';

  const style = document.createElement("style");
  style.textContent = `
    ${MOBILE_INPUT_SELECTOR}[readonly] {
      caret-color: transparent;
      cursor: pointer;
      -webkit-user-select: none;
      user-select: none;
    }

    @media (orientation: landscape) and (max-height: 650px) and (min-width: 640px) {
      body[data-game-screen="true"] { overflow-x: hidden; }
      body[data-game-screen="true"] main { min-height: 100dvh; padding: 0.35rem !important; }
      body[data-game-screen="true"] > button { top: 0.35rem !important; right: 0.35rem !important; height: 2.25rem !important; padding-inline: 0.65rem !important; font-size: 0.8rem !important; }
      body[data-game-screen="true"] main > div.mx-auto.grid { grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr) !important; gap: 0.5rem !important; }
      body[data-game-screen="true"] main > div.mx-auto.grid > div { min-width: 0; }
      body[data-game-screen="true"] .game-toolbar { position: absolute; z-index: 20; margin: 0.35rem; }
      body[data-game-screen="true"] .game-toolbar button { height: 2.25rem !important; padding-inline: 0.65rem !important; font-size: 0.8rem !important; }
      body[data-game-screen="true"] .game-canvas-panel { padding: 0.4rem !important; border-width: 2px !important; }
      body[data-game-screen="true"] .game-canvas-panel > div:first-child { min-height: 2.25rem; margin-bottom: 0.2rem !important; padding-left: 10.5rem; }
      body[data-game-screen="true"] .game-canvas-panel > div:first-child svg { width: 1.35rem; height: 1.35rem; }
      body[data-game-screen="true"] .game-canvas-panel > div:first-child > div:last-child { gap: 0.55rem !important; font-size: 0.85rem !important; }
      body[data-game-screen="true"] .space-field { height: calc(100dvh - 3.4rem) !important; min-height: 18rem; }
      body[data-game-screen="true"] .space-field > div:last-child { display: none; }
      body[data-game-screen="true"] .enemy-ship { width: 5rem !important; height: 5rem !important; }
      body[data-game-screen="true"] .player-ship { width: 6.5rem !important; height: 5.8rem !important; }
      body[data-game-screen="true"] .player-ship-parent { bottom: 1.6rem !important; }
      body[data-game-screen="true"] .problem-column { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 0.4rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel { padding: 0.45rem !important; border-width: 2px !important; }
      body[data-game-screen="true"] .mobile-problem-panel > div:first-child { min-height: 1.35rem; margin-bottom: 0 !important; }
      body[data-game-screen="true"] .mobile-problem-panel h2 { display: none; }
      body[data-game-screen="true"] .mobile-problem-panel > div:first-child span { padding: 0.1rem 0.4rem !important; font-size: 0.65rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel > div:nth-child(2) { max-width: none !important; padding: 0.15rem 0.3rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel > p:last-child { margin-top: 0.15rem !important; padding: 0.15rem 0.3rem !important; font-size: 0.62rem !important; line-height: 1.15 !important; }
      body[data-game-screen="true"] .mobile-problem-panel [class*="grid-cols-"] { column-gap: 0.25rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel input { width: 3.35rem !important; height: 1.9rem !important; font-size: 1rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel .text-3xl { font-size: 1.05rem !important; line-height: 1.15rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel .text-4xl { font-size: 1.3rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel .text-xl { gap: 0.25rem !important; font-size: 0.8rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel [class*="py-2"] { padding-top: 0.12rem !important; padding-bottom: 0.12rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel [class*="py-1"] { padding-top: 0.05rem !important; padding-bottom: 0.05rem !important; }
      body[data-game-screen="true"] .mobile-problem-panel [class*="my-2"] { margin-top: 0.2rem !important; margin-bottom: 0.2rem !important; }
      body[data-game-screen="true"] .problem-actions { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(12rem, 0.78fr) !important; gap: 0.4rem !important; }
      body[data-game-screen="true"] .mobile-feedback-panel { padding: 0.55rem !important; border-width: 2px !important; overflow: auto; }
      body[data-game-screen="true"] .mobile-feedback-panel p:first-child { font-size: 0.85rem !important; }
      body[data-game-screen="true"] .mobile-feedback-panel p:nth-child(2) { min-height: 0 !important; margin-top: 0.2rem !important; font-size: 1rem !important; line-height: 1.3 !important; }
      body[data-game-screen="true"] .mobile-number-pad { gap: 0.25rem !important; }
      body[data-game-screen="true"] .mobile-number-pad button { height: 2rem !important; font-size: 1rem !important; border-width: 1px !important; }
    }
  `;
  document.head.append(style);

  function findButton(text) {
    return [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === text);
  }

  let wasGameScreen = false;
  function patchScreen() {
    const numericInputs = [...document.querySelectorAll(MOBILE_INPUT_SELECTOR)];
    numericInputs.forEach((input) => {
      input.readOnly = true;
      input.setAttribute("inputmode", "none");
      input.setAttribute("autocomplete", "off");
      input.setAttribute("aria-haspopup", "false");
    });

    const gameField = document.querySelector(".space-field");
    if (!gameField) {
      document.body.removeAttribute("data-game-screen");
      wasGameScreen = false;
      return;
    }

    document.body.dataset.gameScreen = "true";
    if (!wasGameScreen) {
      wasGameScreen = true;
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }

    const canvasPanel = gameField.closest("section");
    canvasPanel?.classList.add("game-canvas-panel");
    canvasPanel?.previousElementSibling?.classList.add("game-toolbar");
    const player = document.querySelector(".player-ship");
    player?.parentElement?.classList.add("player-ship-parent");
    const problemPanel = numericInputs[0]?.closest("section");
    problemPanel?.classList.add("mobile-problem-panel");
    const problemColumn = problemPanel?.parentElement;
    problemColumn?.classList.add("problem-column");
    const numberPad = findButton("정답 확인")?.parentElement;
    numberPad?.classList.add("mobile-number-pad");
    const actions = numberPad?.parentElement;
    actions?.classList.add("problem-actions");
    const feedback = actions?.firstElementChild;
    feedback?.classList.add("mobile-feedback-panel");
  }

  document.addEventListener("keydown", (event) => {
    if (!document.body.hasAttribute("data-game-screen")) return;
    if (/^\d$/.test(event.key)) { event.preventDefault(); findButton(event.key)?.click(); return; }
    if (event.key === "Backspace" || event.key === "Delete") { event.preventDefault(); findButton(event.key === "Backspace" ? "지움" : "비움")?.click(); return; }
    if (event.key === "Enter") { event.preventDefault(); findButton("정답 확인")?.click(); }
  });

  let queued = false;
  function queuePatch() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; patchScreen(); });
  }
  new MutationObserver(queuePatch).observe(document.body, { childList: true, subtree: true });
  queuePatch();
})();
