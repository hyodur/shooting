(() => {
  const NEW_TITLE = "시간비행대: 60분 작전";
  document.title = NEW_TITLE;

  const style = document.createElement("style");
  style.textContent = `
    body[data-first-warning="true"] .animate-enemy-shot { display: none !important; }
    body[data-first-warning="true"] .player-ship {
      animation: none !important;
      border-color: rgb(34 211 238) !important;
      background: transparent !important;
    }
    body[data-start-art="true"] main {
      background-image: linear-gradient(rgba(2, 132, 199, 0.08), rgba(15, 23, 42, 0.18)), url('./assets/bg.jpg') !important;
      background-size: cover !important;
      background-position: center !important;
      background-attachment: fixed !important;
    }
    body[data-start-art="true"] main > section {
      background: rgba(255, 255, 255, 0.88) !important;
      backdrop-filter: blur(8px);
    }
    .enemy-ship, .player-ship {
      border-color: transparent !important;
      background: transparent !important;
      box-shadow: none !important;
    }
    .custom-plane-art {
      width: 100%;
      height: 100%;
      object-fit: contain;
      image-rendering: pixelated;
      filter: drop-shadow(0 10px 10px rgba(0, 0, 0, 0.35));
      pointer-events: none;
    }
  `;
  document.head.append(style);

  function patchArtwork() {
    const startHeading = [...document.querySelectorAll("h1")].find((heading) =>
      ["시간 비행 드릴", NEW_TITLE].includes(heading.textContent?.trim() || "")
    );
    const startButton = [...document.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "게임 시작"
    );
    if (startHeading && startButton) {
      startHeading.textContent = NEW_TITLE;
      document.body.dataset.startArt = "true";
    } else {
      document.body.removeAttribute("data-start-art");
    }

    const enemy = document.querySelector(".enemy-ship");
    if (enemy) {
      const hit = enemy.classList.contains("scale-110");
      let image = enemy.querySelector(".custom-plane-art");
      if (!image) {
        image = document.createElement("img");
        image.className = "custom-plane-art";
        image.alt = "적 비행기";
        enemy.replaceChildren(image);
      }
      const nextSource = hit ? "./assets/enemy2.png" : "./assets/enemy1.png";
      if (image.getAttribute("src") !== nextSource) image.setAttribute("src", nextSource);
    }

    const player = document.querySelector(".player-ship");
    if (player) {
      let image = player.querySelector(".custom-plane-art");
      if (!image) {
        image = document.createElement("img");
        image.className = "custom-plane-art";
        image.alt = "내 비행기";
        image.src = "./assets/me.png";
        player.replaceChildren(image);
      }
      if (player.parentElement) player.parentElement.style.bottom = "6rem";
    }
  }

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
    patchArtwork();

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
