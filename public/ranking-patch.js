(() => {
  const LIMIT = 100;
  const SUPABASE_URL = "https://wxnjmtstgrxvrvaevena.supabase.co";
  const SUPABASE_KEY = "sb_publishable_lpham2Fm3kYdUeTrDyKelg_g0rbhce0";
  const difficulties = [
    ["easy", "쉬움"],
    ["normal", "보통"],
    ["hard", "어려움"],
  ];
  const nativeSetItem = Storage.prototype.setItem;
  const submittedIds = new Set();

  function showToast(message, success = true) {
    document.getElementById("ranking-server-toast")?.remove();
    const toast = document.createElement("div");
    toast.id = "ranking-server-toast";
    toast.textContent = message;
    toast.style.cssText = `position:fixed;left:50%;bottom:24px;z-index:10001;transform:translateX(-50%);max-width:calc(100% - 32px);border-radius:8px;background:${success ? "#047857" : "#be123c"};color:white;padding:13px 20px;font-size:17px;font-weight:900;box-shadow:0 8px 24px rgba(15,23,42,.3);text-align:center`;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 3200);
  }

  async function submitNationalRanking(entry) {
    if (!entry?.id || submittedIds.has(entry.id)) return;
    submittedIds.add(entry.id);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/time_rankings`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        nickname: String(entry.name || "이름 없음").trim().slice(0, 12),
        difficulty: entry.difficulty,
        score: Number(entry.score) || 0,
        correct_count: Number(entry.correct) || 0,
        wrong_count: Number(entry.wrong) || 0,
        best_combo: Number(entry.combo) || 0,
      }),
    });
    if (!response.ok) {
      submittedIds.delete(entry.id);
      throw new Error(`ranking insert failed: ${response.status}`);
    }
  }

  Storage.prototype.setItem = function setItem(key, value) {
    if (typeof key === "string" && key.startsWith("time-flight-rankings-")) {
      try {
        const current = JSON.parse(this.getItem(key) || "[]");
        const incoming = JSON.parse(value || "[]");
        const currentIds = new Set(current.map((entry) => entry.id));
        const newEntries = incoming.filter((entry) => entry.id && !currentIds.has(entry.id));
        const merged = [...incoming, ...current]
          .filter((entry, index, items) => items.findIndex((item) => item.id === entry.id) === index)
          .sort((a, b) => b.score - a.score)
          .slice(0, LIMIT);
        const result = nativeSetItem.call(this, key, JSON.stringify(merged));
        newEntries.forEach((entry) => {
          submitNationalRanking(entry)
            .then(() => showToast("전국 랭킹에 등록됐어요!"))
            .catch(() => showToast("기기에는 저장됐지만 서버 등록에 실패했어요.", false));
        });
        return result;
      } catch {
        return nativeSetItem.call(this, key, value);
      }
    }
    return nativeSetItem.call(this, key, value);
  };

  function loadLocal(difficulty) {
    try {
      return JSON.parse(localStorage.getItem(`time-flight-rankings-${difficulty}`) || "[]")
        .sort((a, b) => b.score - a.score)
        .slice(0, LIMIT)
        .map((entry) => ({ id: entry.id, nickname: entry.name, score: entry.score }));
    } catch {
      return [];
    }
  }

  async function loadNational(difficulty) {
    const query = new URLSearchParams({
      select: "id,nickname,difficulty,score,correct_count,wrong_count,best_combo,created_at",
      difficulty: `eq.${difficulty}`,
      order: "score.desc,created_at.asc",
      limit: String(LIMIT),
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/time_rankings?${query}`, {
      headers: { apikey: SUPABASE_KEY },
    });
    if (!response.ok) throw new Error(`ranking fetch failed: ${response.status}`);
    return response.json();
  }

  function safeText(value) {
    return String(value || "이름 없음").replace(/[<>]/g, "");
  }

  function openRanking(initial = "easy") {
    document.getElementById("ranking-patch-modal")?.remove();
    let selected = initial;
    let renderSequence = 0;
    const overlay = document.createElement("div");
    overlay.id = "ranking-patch-modal";
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.72);padding:20px;overflow:auto;display:flex;align-items:flex-start;justify-content:center";
    const panel = document.createElement("section");
    panel.style.cssText = "width:min(680px,100%);background:#eef2ff;border:4px solid #c7d2fe;border-radius:8px;padding:20px;color:#1e1b4b;box-shadow:0 20px 50px rgba(15,23,42,.3)";
    panel.innerHTML = `
      <div style="display:flex;align-items:start;justify-content:space-between;gap:12px">
        <div><h2 style="font-size:28px;font-weight:900;margin:0">전국 랭킹 TOP 100</h2><p data-status style="font-weight:700;color:#4338ca;margin:6px 0 0">전국 기록을 불러오고 있어요.</p></div>
        <button data-close style="border:0;border-radius:8px;background:#1e293b;color:white;padding:10px 18px;font-size:16px;font-weight:900;cursor:pointer">닫기</button>
      </div>
      <div data-tabs style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:18px"></div>
      <ol data-list style="list-style:none;padding:0;margin:16px 0 0;max-height:55vh;overflow:auto"></ol>`;
    overlay.append(panel);
    document.body.append(overlay);

    const tabs = panel.querySelector("[data-tabs]");
    const list = panel.querySelector("[data-list]");
    const status = panel.querySelector("[data-status]");
    const renderTabs = () => {
      tabs.innerHTML = difficulties.map(([id, label]) => `<button data-difficulty="${id}" style="height:46px;border:2px solid #4f46e5;border-radius:8px;background:${selected === id ? "#4f46e5" : "white"};color:${selected === id ? "white" : "#312e81"};font-size:17px;font-weight:900;cursor:pointer">${label}</button>`).join("");
      tabs.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { selected = button.dataset.difficulty; render(); }));
    };
    const renderRows = (rows) => {
      list.innerHTML = rows.length
        ? rows.map((entry, index) => `<li style="display:grid;grid-template-columns:44px 1fr auto;gap:8px;background:white;border-radius:8px;padding:12px;margin-top:8px;font-size:17px;font-weight:900"><span style="color:#4f46e5">${index + 1}</span><span style="overflow:hidden;text-overflow:ellipsis">${safeText(entry.nickname)}</span><span>${Number(entry.score) || 0}점</span></li>`).join("")
        : `<li style="background:white;border-radius:8px;padding:18px;font-weight:800;color:#475569">아직 ${difficulties.find(([id]) => id === selected)?.[1]} 기록이 없어요.</li>`;
    };
    const render = async () => {
      const sequence = ++renderSequence;
      renderTabs();
      status.textContent = "전국 기록을 불러오고 있어요.";
      list.innerHTML = `<li style="background:white;border-radius:8px;padding:18px;font-weight:800;color:#475569">잠시만 기다려 주세요.</li>`;
      try {
        const rows = await loadNational(selected);
        if (sequence !== renderSequence) return;
        status.textContent = "전국 사용자의 기록을 난이도별로 보여줘요.";
        renderRows(rows);
      } catch {
        if (sequence !== renderSequence) return;
        status.textContent = "서버 연결이 어려워 이 기기의 기록을 보여줘요.";
        renderRows(loadLocal(selected));
      }
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
    button.textContent = "전국 랭킹";
    button.style.cssText = "position:fixed;top:20px;right:20px;z-index:1000;height:52px;border:0;border-radius:8px;background:#4f46e5;color:white;padding:0 22px;font-size:19px;font-weight:900;cursor:pointer;box-shadow:0 6px 16px rgba(49,46,129,.3)";
    button.addEventListener("click", () => openRanking("easy"));
    document.body.append(button);
  }

  new MutationObserver(addRankingButton).observe(document.documentElement, { childList: true, subtree: true });
  addRankingButton();
})();
