(() => {
  const style = document.createElement("style");
  style.textContent = `
    @media (orientation: landscape) and (min-width: 900px) and (max-width: 1279px) and (min-height: 651px) {
      body[data-game-screen="true"] .problem-actions { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(13rem, 0.9fr) !important; gap: 0.5rem !important; align-items: start; }
      body[data-game-screen="true"] .problem-column > * { margin-top: 0 !important; }
      body[data-game-screen="true"] .problem-column { gap: 0.75rem !important; }
      body[data-game-screen="true"] .mobile-feedback-panel,
      body[data-game-screen="true"] .mobile-number-pad { min-width: 0; }
      body[data-game-screen="true"] .mobile-number-pad { align-self: start; }
      body[data-game-screen="true"] .mobile-number-pad button { height: 2.75rem !important; }
    }
  `;
  document.head.append(style);
})();
