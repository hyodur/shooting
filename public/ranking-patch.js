(() => {
  const LIMIT = 100;
  const difficulties = [
    ["easy", "쉬움"],
    ["normal", "보통"],
    ["hard", "어려움"],
  ];
  const nativeSetItem = Storage.prototype.setItem;

  Storage.prototype.setItem = function setItem(key, value) {
    if (typeof key === "string" && key.startsWith("time-flight-rankings-")) {
      try {
        const current = JSON.parse(this.getItem(key) || "[]");
        const incoming = JSON.parse(value || "[]");
        const merged = [...incoming, ...current]
          .filter((entry, index, items) => items.findIndex((item) => item.id === entry.id) === index)
          .sort((a, b) => b.score - a.score)
          .slice(0, LIMIT);
        return nativeSetItem.call(this, key, JSON.stringify(merged));
      } catch {
        return nativeSetItem.call(this, key, value);
      }
    }
    return nativeSetItem.call(this, key, value);
  };

  function load(difficulty) {
    try {
      return JSON.parse(localStorage.getItem(`time-flight-rankings-${difficulty}`) || "[]")
        .sort((a, b) => b.score - a.score)
        .slice(0, LIMIT);
    } catch {
      return [];
    }
  }

  function openRanking(initial = "easy") {
    document.getElementById("ranking-patch-modal")?.remove();
    let selected = initial;
    const overlay = document.createElement("div");
    overlay.id = "ranking-patch-modal";
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.72);padding:20px;overflow:auto;display:flex;align-items:flex-start;justify-content:center";
    const panel = document.createElement("section");
    panel.style.cssText = "width:min(680px,100%);background:#eef2ff;border:4px solid #c7d2fe;border-radius:8px;padding:20px;color:#1e1b4b;box-shadow:0 20px 50px rgba(15,23,42,.3)";
    panel.innerHTML = `
      <div style="display:flex;align-items:start;justify-content:space-between;gap:12px">
        <div><h2 style="font-size:28px;font-weight:900;margin:0">랭킹 TOP 100</h2><p style="font-weight:700;color:#4338ca;margin:6px 0 0">이 기기의 브라우저에 난이도별로 저장돼요.</p></div>
        <button data-close style="border:0;border-radius:8px;background:#1e293b;color:white;padding:10px 18px;font-size:16px;font-weight:900;cursor:pointer">닫기</button>
      </div>
      <div data-tabs style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:18px"></div>
      <ol data-list style="list-style:none;padding:0;margin:16px 0 0;max-height:55vh;overflow:auto"></ol>`;
    overlay.append(panel);
    document.body.append(overlay);

    const tabs = panel.querySelector("[data-tabs]");
    const list = panel.querySelector("[data-list]");
    const render = () => {
      tabs.innerHTML = difficulties.map(([id, label]) => `<button data-difficulty="${id}" style="height:46px;border:2px solid #4f46e5;border-radius:8px;background:${selected === id ? "#4f46e5" : "white"};color:${selected === id ? "white" : "#312e81"};font-size:17px;font-weight:900;cursor:pointer">${label}</button>`).join("");
      const rows = load(selected);
      list.innerHTML = rows.length
        ? rows.map((entry, index) => `<li style="display:grid;grid-template-columns:44px 1fr auto;gap:8px;background:white;border-radius:8px;padding:12px;margin-top:8px;font-size:17px;font-weight:900"><span style="color:#4f46e5">${index + 1}</span><span style="overflow:hidden;text-overflow:ellipsis">${String(entry.name || "이름 없음").replace(/[<>]/g, "")}</span><span>${Number(entry.score) || 0}점</span></li>`).join("")
        : `<li style="background:white;border-radius:8px;padding:18px;font-weight:800;color:#475569">아직 기록이 없어요.</li>`;
      tabs.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { selected = button.dataset.difficulty; render(); }));
    };
    panel.querySelector("[data-close]").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
    render();
  }

  function addRankingButton() {
    if (document.getElementById("ranking-patch-button")) return;
    const buttons = [...document.querySelectorAll("button")];
    const startButton = buttons.find((button) => button.textContent?.trim() === "게임 시작");
    const heading = [...document.querySelectorAll("h1")].find((item) => item.textContent?.includes("시간 비행 드릴"));
    if (!startButton || !heading) return;
    const button = document.createElement("button");
    button.id = "ranking-patch-button";
    button.type = "button";
    button.textContent = "랭킹 보기";
    button.style.cssText = "position:fixed;top:20px;right:20px;z-index:1000;height:52px;border:0;border-radius:8px;background:#4f46e5;color:white;padding:0 22px;font-size:19px;font-weight:900;cursor:pointer;box-shadow:0 6px 16px rgba(49,46,129,.3)";
    button.addEventListener("click", () => openRanking("easy"));
    document.body.append(button);
  }

  new MutationObserver(addRankingButton).observe(document.documentElement, { childList: true, subtree: true });
  addRankingButton();
})();
