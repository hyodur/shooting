(() => {
  const NEW_TITLE = "시간비행대: 60분 작전";
  document.title = NEW_TITLE;

  const style = document.createElement("style");
  style.textContent = `
    body[data-first-warning="true"] .animate-enemy-shot { display: none !important; }
    body[data-first-warning="true"] .player-ship {
      animation: none !important;
      border-color: rgb(34 211 238) !important;
      background: rgb(224 242 254) !important;
    }
  `;
  document.head.append(style);

  function showRealHit(paragraph) {
    document.body.removeAttribute("data-first-warning");
    paragraph.textContent = paragraph.textContent
      .replace("위험!", "피격!")
      .replace("한 번 더 틀리면 피격돼요. ", "");
    document.querySelectorAll("div").forEach((element) => {
      if (element.textContent?.trim() === "위험! 한 번 남음" && element.children.length === 0) {
        element.textContent = "피격!";
        element.style.width = "8rem";
        element.style.background = "#ffe4e6";
        element.style.color = "#be123c";
      }
    });
  }

  function patchScreen() {
    if (document.getElementById("ranking-patch-button")) {
      document.querySelectorAll("h1").forEach((heading) => {
        if (heading.textContent?.trim() === "시간 비행 드릴") heading.textContent = NEW_TITLE;
      });
    }

    const paragraphs = [...document.querySelectorAll("p")];
    const completedHit = paragraphs.find((paragraph) => {
      const text = paragraph.textContent?.trim() || "";
      return text.startsWith("위험! -") && text.includes("정답은");
    });
    if (completedHit) {
      showRealHit(completedHit);
      return;
    }

    const firstWarning = paragraphs.find((paragraph) => {
      const text = paragraph.textContent?.trim() || "";
      return text.startsWith("피격! -") && !text.includes("정답은") && !text.includes("두 번째 오답");
    });

    if (!firstWarning) {
      document.body.removeAttribute("data-first-warning");
      return;
    }

    document.body.dataset.firstWarning = "true";
    firstWarning.textContent = firstWarning.textContent
      .replace("피격!", "위험!")
      .replace("점. ", "점. 한 번 더 틀리면 피격돼요. ");

    document.querySelectorAll("div").forEach((element) => {
      if (element.textContent?.trim() === "피격!" && element.children.length === 0) {
        element.textContent = "위험! 한 번 남음";
        element.style.width = "12rem";
        element.style.background = "#fef3c7";
        element.style.color = "#92400e";
      }
    });
  }

  new MutationObserver(patchScreen).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  patchScreen();
})();
