import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, Plane } from "lucide-react";

type Difficulty = "easy" | "normal" | "hard";
type Operation = "addition" | "subtraction";
type UnitSet = "hourMinute" | "minuteSecond" | "all";
type Status = "start" | "playing" | "clear" | "gameOver";
type Phase = "enemyReady" | "missileHit" | "playerHit";
type Field = "hours" | "minutes" | "seconds" | "processHours" | "processMinutes" | "processSeconds";
type ProcessWorkStatus = "notRequired" | "blank" | "correct" | "incorrect";

type Problem = {
  id: string;
  operation: Operation;
  difficulty: Difficulty;
  unitSet: UnitSet;
  topHours: number;
  topMinutes: number;
  topSeconds: number;
  bottomHours: number;
  bottomMinutes: number;
  bottomSeconds: number;
  answerHours: number;
  answerMinutes: number;
  answerSeconds: number;
  transformationCount: number;
  secondTransformation: boolean;
  minuteTransformation: boolean;
};

type Attempt = { id: string; operation: Operation; transformationCount: number; mistakes: number };
type Ranking = { id: string; name: string; score: number; correct: number; wrong: number; combo: number; difficulty: Difficulty };

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
let audioContext: AudioContext | null = null;

const labels: Record<Difficulty, string> = { easy: "쉬움", normal: "보통", hard: "어려움" };
const unitChoices = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const emptyAnswer = { hours: "", minutes: "", seconds: "", processHours: "", processMinutes: "", processSeconds: "" };

function randomInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(items: T[]) { return items[randomInt(0, items.length - 1)]; }
function toTotalSeconds(hours: number, minutes: number, seconds: number) { return hours * 3600 + minutes * 60 + seconds; }
function fromTotalSeconds(total: number) {
  const safeTotal = Math.max(0, total);
  return {
    hours: Math.floor(safeTotal / 3600),
    minutes: Math.floor((safeTotal % 3600) / 60),
    seconds: safeTotal % 60,
  };
}
function fmt(problem: Problem, hours: number, minutes: number, seconds: number) {
  if (problem.unitSet === "hourMinute") return `${hours}시간 ${minutes}분`;
  if (problem.unitSet === "minuteSecond") return `${minutes}분 ${seconds}초`;
  return `${hours}시간 ${minutes}분 ${seconds}초`;
}
function onlyDigits(value: string) { return value.replace(/\D/g, "").slice(0, 2); }

function checkProcessWork(problem: Problem, answer: typeof emptyAnswer): ProcessWorkStatus {
  if (problem.transformationCount === 0) return "notRequired";
  const processFields: Field[] = ["processHours", "processMinutes", "processSeconds"];
  if (!processFields.some((field) => answer[field] !== "")) return "blank";

  const expected: Partial<Record<Field, number>> = {};
  if (problem.operation === "addition") {
    if (problem.minuteTransformation) expected.processHours = 1;
    if (problem.secondTransformation) expected.processMinutes = 1;
  } else {
    if (problem.minuteTransformation) {
      expected.processHours = problem.topHours - 1;
      expected.processMinutes = 60;
    }
    if (problem.secondTransformation) {
      expected.processMinutes = problem.topMinutes - 1;
      expected.processSeconds = 60;
    }
  }

  const requiredFields = Object.keys(expected) as Field[];
  const requiredCorrect = requiredFields.every((field) => answer[field] !== "" && Number(answer[field]) === expected[field]);
  const unusedFieldsBlank = processFields.filter((field) => expected[field] === undefined).every((field) => answer[field] === "");
  return requiredCorrect && unusedFieldsBlank ? "correct" : "incorrect";
}

function processWorkScore(status: ProcessWorkStatus, difficulty: Difficulty) {
  if (status === "correct") return difficulty === "hard" ? 650 : 350;
  if (status === "incorrect") return -60;
  return 0;
}

function targetTransformationCount(difficulty: Difficulty) { return difficulty === "easy" ? 0 : 1; }

function generateProblem(difficulty: Difficulty, _enemyIndex = 0): Problem {
  const targetCount = targetTransformationCount(difficulty);
  const operation = pick<Operation>(["addition", "subtraction"]);
  const unitSet: UnitSet = difficulty === "hard" ? "all" : pick<UnitSet>(["hourMinute", "minuteSecond"]);

  for (let attempt = 0; attempt < 1200; attempt += 1) {
    const topHours = unitSet === "minuteSecond" ? 0 : operation === "subtraction" ? randomInt(3, 12) : randomInt(1, 8);
    const bottomHours = unitSet === "minuteSecond" ? 0 : operation === "subtraction" ? randomInt(1, topHours - 1) : randomInt(1, 6);
    const topMinutes = pick(unitChoices);
    const bottomMinutes = pick(unitChoices);
    const topSeconds = unitSet === "hourMinute" ? 0 : pick(unitChoices);
    const bottomSeconds = unitSet === "hourMinute" ? 0 : pick(unitChoices);

    let secondTransformation: boolean;
    let minuteTransformation: boolean;
    if (operation === "addition") {
      secondTransformation = unitSet !== "hourMinute" && topSeconds + bottomSeconds >= 60;
      const secondCarry = secondTransformation ? 1 : 0;
      minuteTransformation = unitSet !== "minuteSecond" && topMinutes + bottomMinutes + secondCarry >= 60;
      if (unitSet === "minuteSecond" && topMinutes + bottomMinutes + secondCarry >= 60) continue;
    } else {
      secondTransformation = unitSet !== "hourMinute" && topSeconds < bottomSeconds;
      const adjustedTopMinutes = topMinutes - (secondTransformation ? 1 : 0);
      minuteTransformation = unitSet !== "minuteSecond" && adjustedTopMinutes < bottomMinutes;
      if (unitSet === "minuteSecond" && adjustedTopMinutes < bottomMinutes) continue;
    }

    const transformationCount = Number(secondTransformation) + Number(minuteTransformation);
    if (transformationCount !== targetCount) continue;
    const topTotal = toTotalSeconds(topHours, topMinutes, topSeconds);
    const bottomTotal = toTotalSeconds(bottomHours, bottomMinutes, bottomSeconds);
    if (operation === "subtraction" && topTotal <= bottomTotal) continue;
    const result = fromTotalSeconds(operation === "addition" ? topTotal + bottomTotal : topTotal - bottomTotal);
    if (unitSet !== "minuteSecond" && result.hours <= 0) continue;

    return {
      id: crypto.randomUUID(), operation, difficulty, unitSet,
      topHours, topMinutes, topSeconds, bottomHours, bottomMinutes, bottomSeconds,
      answerHours: result.hours, answerMinutes: result.minutes, answerSeconds: result.seconds,
      transformationCount, secondTransformation, minuteTransformation,
    };
  }

  return {
    id: crypto.randomUUID(), operation: "addition", difficulty, unitSet,
    topHours: unitSet === "minuteSecond" ? 0 : 2,
    topMinutes: unitSet === "hourMinute" ? 40 : 20,
    topSeconds: unitSet === "hourMinute" ? 0 : 40,
    bottomHours: unitSet === "minuteSecond" ? 0 : 1,
    bottomMinutes: unitSet === "hourMinute" ? 30 : 15,
    bottomSeconds: unitSet === "hourMinute" ? 0 : 35,
    answerHours: unitSet === "hourMinute" ? 4 : unitSet === "all" ? 3 : 0,
    answerMinutes: unitSet === "hourMinute" ? 10 : 36,
    answerSeconds: unitSet === "hourMinute" ? 0 : 15,
    transformationCount: targetCount,
    secondTransformation: targetCount === 1 && unitSet !== "hourMinute",
    minuteTransformation: targetCount === 1 && unitSet === "hourMinute",
  };
}

function context() {
  const win = window as AudioWindow;
  const AudioContextClass = win.AudioContext || win.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext || audioContext.state === "closed") audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

function tone(freq: number, offset: number, duration: number, type: OscillatorType, volume: number, end?: number) {
  const ctx = context(); if (!ctx) return;
  const start = ctx.currentTime + offset; const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, start);
  if (end) osc.frequency.exponentialRampToValueAtTime(end, start + duration);
  gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain); gain.connect(ctx.destination); osc.start(start); osc.stop(start + duration);
}

function noise(duration: number, volume: number) {
  const ctx = context(); if (!ctx) return;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate); const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const source = ctx.createBufferSource(); const gain = ctx.createGain(); source.buffer = buffer; gain.gain.value = volume;
  source.connect(gain); gain.connect(ctx.destination); source.start();
}

function sound(kind: "start" | "hit" | "damage" | "clear") {
  if (kind === "start") { tone(330, 0, 0.08, "triangle", 0.06, 440); tone(660, 0.08, 0.1, "triangle", 0.06, 880); return; }
  if (kind === "hit") { noise(0.12, 0.16); tone(90, 0, 0.16, "sawtooth", 0.12, 42); tone(520, 0.02, 0.08, "square", 0.08, 180); return; }
  if (kind === "clear") { tone(523, 0, 0.09, "triangle", 0.07, 659); tone(659, 0.1, 0.09, "triangle", 0.07, 784); tone(784, 0.2, 0.16, "triangle", 0.08, 1046); return; }
  noise(0.1, 0.12); tone(160, 0, 0.18, "sawtooth", 0.11, 70); tone(55, 0.05, 0.22, "square", 0.08, 35);
}

function bgm(step: number) {
  const bass = [82, 82, 110, 98, 82, 123, 110, 98]; const lead = [330, 392, 440, 392, 494, 440, 392, 330];
  tone(bass[step % bass.length], 0, 0.16, "square", 0.035, bass[step % bass.length] * 0.98);
  if (step % 2 === 0) tone(lead[step % lead.length], 0.03, 0.1, "triangle", 0.025);
}

function scoreFor(elapsed: number, streak: number, mistakes: number, difficulty: Difficulty) {
  const elapsedSeconds = elapsed / 1000;
  const speed = elapsedSeconds <= 5 ? 150 : elapsedSeconds <= 10 ? 110 : elapsedSeconds <= 15 ? 70 : elapsedSeconds <= 20 ? 35 : 0;
  const combo = Math.min(160, Math.max(0, streak - 1) * 20); const accuracyPenalty = mistakes * 60;
  const difficultyMultiplier = difficulty === "hard" ? 1.8 : difficulty === "normal" ? 1.4 : 1;
  const total = Math.max(20, Math.round((100 + speed + combo - accuracyPenalty) * difficultyMultiplier));
  return { total, speed, combo, accuracyPenalty, difficultyMultiplier };
}

function GameCanvas({ hearts, shot, phase, streak, score }: { hearts: number; shot: number; phase: Phase; streak: number; score: number }) {
  return <section className="overflow-hidden rounded-lg border-4 border-indigo-300 bg-slate-950 p-4 shadow-soft">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-1">{[0, 1, 2].map((i) => <Heart key={i} size={30} className={i < hearts ? "fill-rose-500 text-rose-500" : "text-slate-500"} />)}</div>
      <div className="flex gap-4 text-lg font-black text-cyan-50"><span>점수 {score}</span><span>격추 {shot}/10</span><span>콤보 {streak}</span></div>
    </div>
    <div className="space-field relative h-[34rem] overflow-hidden rounded-lg border-2 border-cyan-200/60 bg-slate-950">
      <div className="stars-layer stars-layer-a" /><div className="stars-layer stars-layer-b" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-slate-950 via-slate-950/90 to-transparent" />
      <div className="absolute inset-x-0 top-4 flex justify-center"><div key={`${shot}-${phase}`} className={`enemy-ship flex h-20 w-24 items-center justify-center rounded-lg border-4 border-orange-300 bg-orange-100 shadow-md ${phase === "missileHit" ? "scale-110 border-rose-400 bg-rose-100" : ""}`}><Plane className="rotate-180 fill-orange-400 text-orange-700" size={58} /></div></div>
      {phase === "missileHit" && <><div className="absolute inset-x-0 bottom-28 mx-auto h-72 w-3 animate-missile rounded-full bg-cyan-300 shadow-[0_0_28px_rgba(103,232,249,0.9)]" /><div className="absolute inset-x-0 top-24 mx-auto flex h-24 w-24 animate-pop items-center justify-center rounded-full bg-amber-300 text-2xl font-black text-rose-700 shadow-[0_0_34px_rgba(251,191,36,0.9)]">성공!</div></>}
      {phase === "playerHit" && <><div className="absolute inset-x-0 top-24 mx-auto h-72 w-3 animate-enemy-shot rounded-full bg-orange-500 shadow-[0_0_24px_rgba(249,115,22,0.8)]" /><div className="absolute inset-x-0 bottom-32 mx-auto flex h-20 w-32 animate-shake items-center justify-center rounded-lg bg-rose-100 text-2xl font-black text-rose-700 shadow-md">피격!</div></>}
      <div className="absolute inset-x-0 bottom-8 flex justify-center"><div className={`player-ship flex h-24 w-28 items-center justify-center rounded-lg border-4 border-cyan-300 bg-sky-100 shadow-[0_0_30px_rgba(34,211,238,0.45)] ${phase === "playerHit" ? "animate-shake border-rose-400 bg-rose-50" : ""}`}><Plane className="fill-sky-500 text-sky-800" size={74} /></div></div>
      <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-slate-900/80 px-3 py-2 text-center text-lg font-black text-cyan-50">적이 위에서 내려오면 오른쪽 문제를 풀어 미사일을 발사해요.</div>
    </div>
  </section>;
}

function VerticalProblem({ problem, answer, active, setAnswer, setActive }: { problem: Problem; answer: typeof emptyAnswer; active: Field; setAnswer: (field: Field, value: string) => void; setActive: (field: Field) => void }) {
  const add = problem.operation === "addition"; const processBonus = problem.difficulty === "hard" ? 650 : 350;
  const showHours = problem.unitSet !== "minuteSecond"; const showSeconds = problem.unitSet !== "hourMinute";
  const gridClass = problem.unitSet === "all" ? "grid-cols-[2rem_repeat(3,minmax(0,1fr))]" : "grid-cols-[2rem_repeat(2,minmax(0,1fr))]";
  const input = (field: Field, label: string, small = false) => <input aria-label={label} className={`min-w-0 rounded-lg border-2 bg-white text-center font-black text-slate-800 outline-none focus:border-sky-500 ${small ? "h-10 w-14 text-xl" : "h-16 w-20 text-3xl"} ${active === field ? "border-sky-500 ring-4 ring-sky-100" : "border-slate-200"}`} inputMode="numeric" maxLength={2} value={answer[field]} onChange={(e) => setAnswer(field, e.target.value)} onFocus={() => setActive(field)} />;
  const processCell = (field: Field, label: string, visible: boolean) => visible ? input(field, label, true) : <span />;
  const processGuide = add ? "받아올린 1을 바로 왼쪽 단위 위에 적어요." : "빌려준 단위에는 1 작은 수, 빌린 단위에는 60을 함께 적어요.";
  return <section className="rounded-lg border-4 border-sky-200 bg-white p-5 shadow-soft">
    <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-2xl font-black text-slate-800">세로셈 문제</h2><span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-bold text-sky-800">60초 = 1분 · 60분 = 1시간</span></div>
    <div className="mx-auto max-w-xl rounded-lg bg-slate-50 p-4">
      <div className={`grid ${gridClass} items-end gap-2 text-center text-sm font-bold text-slate-500`}><span />{showHours && <span>시간</span>}<span>분</span>{showSeconds && <span>초</span>}</div>
      {problem.transformationCount > 0 && <div className={`grid ${gridClass} items-center justify-items-center gap-2 py-1`}><span />
        {add ? <>{showHours && processCell("processHours", "분에서 시간으로 받아올림", problem.minuteTransformation)}{processCell("processMinutes", "초에서 분으로 받아올림", problem.secondTransformation)}{showSeconds && <span />}</>
          : <>{showHours && processCell("processHours", "1 작아진 시간", problem.minuteTransformation)}{processCell("processMinutes", problem.minuteTransformation ? "시간에서 빌려온 60분" : "1 작아진 분", true)}{showSeconds && processCell("processSeconds", "분에서 빌려온 60초", problem.secondTransformation)}</>}
      </div>}
      <div className={`grid ${gridClass} items-center gap-2 py-2 text-center text-2xl font-black text-slate-800 sm:text-3xl`}><span />{showHours && <span>{problem.topHours}시간</span>}<span>{problem.topMinutes}분</span>{showSeconds && <span>{problem.topSeconds}초</span>}</div>
      <div className={`grid ${gridClass} items-center gap-2 py-2 text-center text-2xl font-black text-slate-800 sm:text-3xl`}><span className="text-4xl text-rose-500">{add ? "+" : "-"}</span>{showHours && <span>{problem.bottomHours}시간</span>}<span>{problem.bottomMinutes}분</span>{showSeconds && <span>{problem.bottomSeconds}초</span>}</div>
      <div className="my-2 border-t-4 border-slate-700" />
      <div className={`grid ${gridClass} items-center gap-2 pt-2`}><span />
        {showHours && <label className="flex min-w-0 flex-col items-center justify-center gap-1 text-base font-black text-slate-700 sm:flex-row sm:text-lg">{input("hours", "정답 시간")}<span>시간</span></label>}
        <label className="flex min-w-0 flex-col items-center justify-center gap-1 text-base font-black text-slate-700 sm:flex-row sm:text-lg">{input("minutes", "정답 분")}<span>분</span></label>
        {showSeconds && <label className="flex min-w-0 flex-col items-center justify-center gap-1 text-base font-black text-slate-700 sm:flex-row sm:text-lg">{input("seconds", "정답 초")}<span>초</span></label>}
      </div>
    </div>
    {problem.transformationCount > 0 && <p className="mx-auto mt-3 max-w-xl rounded-lg bg-amber-50 px-3 py-2 text-center text-sm font-black text-amber-900">{processGuide} 정확히 쓰면 +{processBonus}점 · 틀리면 -60점</p>}
  </section>;
}

function NumberPad({ press, back, clear, submit }: { press: (n: string) => void; back: () => void; clear: () => void; submit: () => void }) {
  return <div className="grid grid-cols-3 gap-2">{"1234567890".split("").map((n) => <button key={n} className="h-14 rounded-lg border-2 border-sky-200 bg-white text-2xl font-black text-sky-800 shadow-sm hover:bg-sky-50" onClick={() => press(n)}>{n}</button>)}<button className="h-14 rounded-lg border-2 border-amber-200 bg-amber-50 text-lg font-black text-amber-800" onClick={back}>지움</button><button className="h-14 rounded-lg border-2 border-rose-200 bg-rose-50 text-lg font-black text-rose-800" onClick={clear}>비움</button><button className="col-span-3 h-14 rounded-lg bg-emerald-500 text-xl font-black text-white shadow-md hover:bg-emerald-600" onClick={submit}>정답 확인</button></div>;
}

function StartScreen({ difficulty, setDifficulty, start }: { difficulty: Difficulty; setDifficulty: (d: Difficulty) => void; start: () => void }) {
  return <main className="min-h-screen bg-cyan-50 px-4 py-8 text-slate-800"><section className="mx-auto flex max-w-4xl flex-col gap-6 rounded-lg border-4 border-sky-200 bg-white p-6 shadow-soft"><p className="text-lg font-bold text-sky-700">초등학교 3학년 시간 계산</p><h1 className="text-5xl font-black text-slate-900">시간 비행 드릴</h1><div className="grid gap-4 text-xl font-bold sm:grid-cols-3">{(["easy", "normal", "hard"] as Difficulty[]).map((d) => <button key={d} className={`rounded-lg border-4 p-4 text-left ${difficulty === d ? "border-sky-500 bg-sky-100" : "border-slate-200 bg-slate-50"}`} onClick={() => setDifficulty(d)}><span className="block text-2xl font-black">{labels[d]}</span><span className="mt-2 block text-base text-slate-600">{d === "easy" ? "시간·분 또는 분·초를 변환 없이 계산해요." : d === "normal" ? "두 단위에서 받아올림이나 받아내림이 한 번 있어요." : "시간·분·초 세 단위에서 변환이 한 번 있어요."}</span></button>)}</div><div className="rounded-lg bg-amber-50 p-4 text-lg font-bold text-amber-900">뺄셈에서 받아내리면 1 작아진 수와 빌려온 60을 모두 적어 보세요.</div><button className="h-16 rounded-lg bg-emerald-500 text-2xl font-black text-white shadow-md hover:bg-emerald-600" onClick={start}>게임 시작</button></section></main>;
}

function Result({ status, score, correct, wrong, best, difficulty, attempts, restart, home }: { status: Status; score: number; correct: number; wrong: number; best: number; difficulty: Difficulty; attempts: Attempt[]; restart: () => void; home: () => void }) {
  const key = `time-flight-rankings-${difficulty}`; const [name, setName] = useState("");
  const [rankings, setRankings] = useState<Ranking[]>(() => JSON.parse(localStorage.getItem(key) ?? "[]") as Ranking[]); const [done, setDone] = useState(false);
  const hard = attempts.some((a) => a.mistakes > 0 && a.transformationCount > 0) ? "60초 = 1분, 60분 = 1시간 변환이 있는 문제를 더 연습해 보세요." : "좋아요. 초·분·시간의 관계를 잘 떠올렸어요.";
  function register() { const entry = { id: crypto.randomUUID(), name: (name.trim() || "이름 없음").slice(0, 10), score, correct, wrong, combo: best, difficulty }; const next = [...rankings, entry].sort((a, b) => b.score - a.score).slice(0, 5); localStorage.setItem(key, JSON.stringify(next)); setRankings(next); setDone(true); }
  return <main className="min-h-screen bg-cyan-50 px-4 py-8 text-slate-800"><section className="mx-auto max-w-4xl rounded-lg border-4 border-sky-200 bg-white p-6 shadow-soft"><p className="text-lg font-bold text-sky-700">{labels[difficulty]} 스테이지 · {status === "clear" ? "스테이지 클리어" : "게임 오버"}</p><h1 className="mt-1 text-4xl font-black text-slate-900">{status === "clear" ? "적 비행기 10대를 모두 격추했어요!" : "하트를 모두 사용했어요"}</h1><div className="mt-6 grid gap-3 text-xl font-black sm:grid-cols-4"><div className="rounded-lg bg-sky-50 p-4 text-sky-800">점수 {score}</div><div className="rounded-lg bg-emerald-50 p-4 text-emerald-800">맞힌 문제 {correct}</div><div className="rounded-lg bg-rose-50 p-4 text-rose-800">틀린 횟수 {wrong}</div><div className="rounded-lg bg-amber-50 p-4 text-amber-800">최고 콤보 {best}</div></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><section className="rounded-lg bg-slate-50 p-4 text-lg font-bold"><p>{hard}</p><p className="mt-3 text-base text-slate-600">첫 오답은 힌트와 감점, 같은 문제 두 번째 오답은 하트 감소로 처리돼요.</p></section><section className="rounded-lg border-2 border-indigo-100 bg-indigo-50 p-4"><h2 className="text-2xl font-black text-indigo-900">스테이지 랭킹</h2><p className="mt-1 text-sm font-bold text-indigo-700">현재는 서버가 아니라 이 기기의 브라우저에 저장돼요.</p><div className="mt-3 flex gap-2"><input className="h-12 min-w-0 flex-1 rounded-lg border-2 border-indigo-200 bg-white px-3 text-lg font-bold outline-none" disabled={done} maxLength={10} placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} /><button className="h-12 rounded-lg bg-indigo-600 px-4 text-lg font-black text-white disabled:bg-slate-300" disabled={done} onClick={register}>등록</button></div><ol className="mt-4 space-y-2">{rankings.length === 0 ? <li className="rounded-lg bg-white p-3 font-bold text-slate-600">아직 등록된 기록이 없어요.</li> : rankings.map((r, i) => <li key={r.id} className="grid grid-cols-[2rem_1fr_auto] rounded-lg bg-white p-3 font-black"><span>{i + 1}</span><span>{r.name}</span><span>{r.score}점</span></li>)}</ol></section></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><button className="h-14 rounded-lg bg-sky-500 text-xl font-black text-white" onClick={restart}>다시 도전</button><button className="h-14 rounded-lg bg-slate-800 text-xl font-black text-white" onClick={home}>홈으로</button></div></section></main>;
}

export default function App() {
  const [status, setStatus] = useState<Status>("start"); const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [problem, setProblem] = useState(() => generateProblem("easy", 0)); const [answer, setAnswerState] = useState(emptyAnswer); const [active, setActive] = useState<Field>("hours");
  const [hearts, setHearts] = useState(3); const [shot, setShot] = useState(0); const [correct, setCorrect] = useState(0); const [wrong, setWrong] = useState(0); const [mistakes, setMistakes] = useState(0); const [streak, setStreak] = useState(0); const [best, setBest] = useState(0); const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("적 비행기가 나타났어요. 문제를 풀어 미사일을 발사해요."); const [phase, setPhase] = useState<Phase>("enemyReady"); const [solved, setSolved] = useState(false); const [bgmOn, setBgmOn] = useState(false); const [attempts, setAttempts] = useState<Attempt[]>([]);
  const startedAt = useRef(Date.now()); const bgmStep = useRef(0);
  const solution = useMemo(() => {
    const symbol = problem.operation === "addition" ? "+" : "-"; const steps: string[] = [];
    if (problem.unitSet !== "hourMinute") steps.push(`초 계산: ${problem.topSeconds}초 ${symbol} ${problem.bottomSeconds}초`);
    steps.push(`분 계산: ${problem.topMinutes}분 ${symbol} ${problem.bottomMinutes}분`);
    if (problem.unitSet !== "minuteSecond") steps.push(`시간 계산: ${problem.topHours}시간 ${symbol} ${problem.bottomHours}시간`);
    if (problem.secondTransformation) steps.push(problem.operation === "addition" ? "60초를 1분으로 받아올려요." : "1분을 60초로 받아내려요.");
    if (problem.minuteTransformation) steps.push(problem.operation === "addition" ? "60분을 1시간으로 받아올려요." : "1시간을 60분으로 받아내려요.");
    steps.push(`정답: ${fmt(problem, problem.answerHours, problem.answerMinutes, problem.answerSeconds)}`); return steps;
  }, [problem]);

  useEffect(() => { if (status !== "playing" || !bgmOn) return undefined; const id = window.setInterval(() => { bgm(bgmStep.current); bgmStep.current += 1; }, 360); return () => window.clearInterval(id); }, [bgmOn, status]);
  function setAnswer(field: Field, value: string) { if (!solved) setAnswerState((old) => ({ ...old, [field]: onlyDigits(value) })); }
  function reset(newDifficulty = difficulty, enemyIndex = shot) { setProblem(generateProblem(newDifficulty, enemyIndex)); setAnswerState(emptyAnswer); setActive("hours"); setMistakes(0); setSolved(false); setPhase("enemyReady"); startedAt.current = Date.now(); }
  function start() { sound("start"); setStatus("playing"); setHearts(3); setShot(0); setCorrect(0); setWrong(0); setStreak(0); setBest(0); setScore(0); setAttempts([]); setBgmOn(true); bgmStep.current = 0; setFeedback("적 비행기가 나타났어요. 문제를 풀어 미사일을 발사해요."); reset(difficulty, 0); }
  function home() { setBgmOn(false); setStatus("start"); }
  function record(m: number) { setAttempts((old) => [...old.filter((a) => a.id !== problem.id), { id: problem.id, operation: problem.operation, transformationCount: problem.transformationCount, mistakes: m }]); }
  function submit() {
    if (solved) return;
    const h = Number(answer.hours); const m = Number(answer.minutes); const s = Number(answer.seconds);
    const needsHours = problem.unitSet !== "minuteSecond"; const needsSeconds = problem.unitSet !== "hourMinute";
    if ((needsHours && (answer.hours === "" || Number.isNaN(h))) || answer.minutes === "" || Number.isNaN(m) || (needsSeconds && (answer.seconds === "" || Number.isNaN(s)))) { setFeedback(needsHours && needsSeconds ? "시간, 분, 초를 모두 입력해 주세요." : needsHours ? "시간과 분을 모두 입력해 주세요." : "분과 초를 모두 입력해 주세요."); return; }
    if (m > 59) { setFeedback("60분이 넘으면 시간으로 바꿔야 해요."); return; }
    if (needsSeconds && s > 59) { setFeedback("60초가 넘으면 분으로 바꿔야 해요."); return; }
    const enteredHours = needsHours ? h : 0; const enteredSeconds = needsSeconds ? s : 0;
    if (toTotalSeconds(enteredHours, m, enteredSeconds) === toTotalSeconds(problem.answerHours, problem.answerMinutes, problem.answerSeconds)) {
      const nextStreak = streak + 1; const nextShot = shot + 1; const earned = scoreFor(Date.now() - startedAt.current, nextStreak, mistakes, difficulty);
      const processStatus = checkProcessWork(problem, answer); const processPoints = processWorkScore(processStatus, difficulty); const totalEarned = Math.max(0, earned.total + processPoints);
      const penaltyText = earned.accuracyPenalty > 0 ? ` · 정확도 -${earned.accuracyPenalty}` : "";
      const processText = processStatus === "correct" ? ` · 풀이칸 +${processPoints}` : processStatus === "incorrect" ? " · 풀이칸 -60" : processStatus === "blank" ? " · 풀이칸 미입력" : "";
      setSolved(true); setPhase("missileHit"); setCorrect((v) => v + 1); setShot(nextShot); setScore((v) => v + totalEarned); setStreak(nextStreak); setBest((v) => Math.max(v, nextStreak)); record(mistakes); sound(nextShot >= 10 ? "clear" : "hit"); setFeedback(`격추 성공! +${totalEarned}점 (속도 +${earned.speed} · 콤보 +${earned.combo}${penaltyText}${processText})`);
      window.setTimeout(() => { if (nextShot >= 10) { setBgmOn(false); setStatus("clear"); } else { reset(difficulty, nextShot); setFeedback("새 적이 나타났어요. 문제를 풀어 미사일을 발사해요."); } }, 900); return;
    }
    const nextMistakes = mistakes + 1; setMistakes(nextMistakes); setWrong((v) => v + 1); setScore((v) => Math.max(0, v - 60)); setStreak(0); setPhase("playerHit"); sound("damage"); record(nextMistakes);
    if (nextMistakes % 2 === 0) { const nextHearts = hearts - 1; setHearts(nextHearts); setSolved(true); setFeedback(`피격! -60점. 정답은 ${fmt(problem, problem.answerHours, problem.answerMinutes, problem.answerSeconds)}입니다.`); window.setTimeout(() => { if (nextHearts <= 0) { setBgmOn(false); setStatus("gameOver"); } else { reset(); setFeedback("다음 적이 나타났어요. 다시 도전해요."); } }, 1200); }
    else { setFeedback(problem.operation === "addition" ? "피격! -60점. 초는 60초가 되면 1분, 분은 60분이 되면 1시간으로 올려요." : "피격! -60점. 초나 분끼리 뺄 수 없다면 바로 왼쪽 단위에서 1을 빌려 보세요."); window.setTimeout(() => setPhase("enemyReady"), 650); }
  }

  if (status === "start") return <StartScreen difficulty={difficulty} setDifficulty={setDifficulty} start={start} />;
  if (status !== "playing") return <Result status={status} score={score} correct={correct} wrong={wrong} best={best} difficulty={difficulty} attempts={attempts} restart={start} home={home} />;
  return <main className="min-h-screen bg-cyan-50 px-3 py-4 text-slate-800 sm:px-5"><div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1fr_1.05fr]"><div className="space-y-3"><div className="flex gap-2"><button className="h-11 rounded-lg bg-slate-900 px-4 font-black text-cyan-50" onClick={() => setBgmOn((v) => !v)}>BGM {bgmOn ? "켜짐" : "꺼짐"}</button><button className="h-11 rounded-lg bg-white px-4 font-black text-slate-800 shadow-md" onClick={home}>홈</button></div><GameCanvas hearts={hearts} shot={shot} phase={phase} streak={streak} score={score} /></div><div className="space-y-4"><VerticalProblem problem={problem} answer={answer} active={active} setAnswer={setAnswer} setActive={setActive} /><div className="grid gap-4 xl:grid-cols-[1fr_18rem]"><section className="rounded-lg border-4 border-amber-200 bg-white p-4 shadow-soft"><p className="text-lg font-black text-slate-800">안내</p><p className="mt-2 min-h-14 text-2xl font-black text-amber-800">{feedback}</p>{solved && <ol className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-lg font-bold text-slate-700">{solution.map((s) => <li key={s}>{s}</li>)}</ol>}</section><NumberPad press={(n) => setAnswer(active, `${answer[active]}${n}`)} back={() => setAnswer(active, answer[active].slice(0, -1))} clear={() => setAnswer(active, "")} submit={submit} /></div></div></div></main>;
}
