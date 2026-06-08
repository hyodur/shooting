import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, Plane } from "lucide-react";

type Difficulty = "easy" | "normal" | "hard";
type Operation = "addition" | "subtraction";
type Status = "start" | "playing" | "clear" | "gameOver";
type Phase = "enemyReady" | "missileHit" | "playerHit";
type Field = "hours" | "minutes" | "carryA" | "carryB";

type Problem = {
  id: string;
  operation: Operation;
  difficulty: Difficulty;
  topHours: number;
  topMinutes: number;
  bottomHours: number;
  bottomMinutes: number;
  answerHours: number;
  answerMinutes: number;
  requiresCarryOrBorrow: boolean;
};

type Attempt = { id: string; operation: Operation; requiresCarryOrBorrow: boolean; mistakes: number };
type Ranking = { id: string; name: string; score: number; correct: number; wrong: number; combo: number; difficulty: Difficulty };

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
let audioContext: AudioContext | null = null;

const labels: Record<Difficulty, string> = { easy: "쉬움", normal: "보통", hard: "어려움" };
const minuteChoices = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const emptyAnswer = { hours: "", minutes: "", carryA: "", carryB: "" };

function randomInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(items: T[]) { return items[randomInt(0, items.length - 1)]; }
function toTotal(hours: number, minutes: number) { return hours * 60 + minutes; }
function fromTotal(total: number) { return { hours: Math.floor(Math.max(0, total) / 60), minutes: Math.max(0, total) % 60 }; }
function fmt(hours: number, minutes: number) { return `${hours}시간 ${minutes}분`; }
function onlyDigits(value: string) { return value.replace(/\D/g, "").slice(0, 2); }

function generateProblem(difficulty: Difficulty): Problem {
  const operation = pick<Operation>(["addition", "subtraction"]);
  if (operation === "addition") {
    const carry = difficulty !== "easy";
    const topMinutes = carry ? pick(minuteChoices.filter((m) => m >= 25)) : pick(minuteChoices.filter((m) => m <= 45));
    const bottomMinutes = carry
      ? pick(minuteChoices.filter((m) => topMinutes + m >= 60))
      : pick(minuteChoices.filter((m) => topMinutes + m < 60));
    const topHours = difficulty === "hard" ? randomInt(4, 9) : randomInt(1, 5);
    const bottomHours = difficulty === "hard" ? randomInt(2, 5) : randomInt(1, 3);
    const answer = fromTotal(toTotal(topHours, topMinutes) + toTotal(bottomHours, bottomMinutes));
    return { id: crypto.randomUUID(), operation, difficulty, topHours, topMinutes, bottomHours, bottomMinutes, answerHours: answer.hours, answerMinutes: answer.minutes, requiresCarryOrBorrow: topMinutes + bottomMinutes >= 60 };
  }

  for (let i = 0; i < 80; i += 1) {
    const borrow = difficulty !== "easy";
    const topMinutes = borrow ? pick(minuteChoices.filter((m) => m <= 35)) : pick(minuteChoices);
    const bottomMinutes = borrow ? pick(minuteChoices.filter((m) => m > topMinutes)) : pick(minuteChoices.filter((m) => m <= topMinutes));
    const topHours = difficulty === "hard" ? randomInt(6, 12) : randomInt(3, 8);
    const bottomHours = difficulty === "hard" ? randomInt(2, topHours - 1) : randomInt(1, topHours - 1);
    const answer = fromTotal(toTotal(topHours, topMinutes) - toTotal(bottomHours, bottomMinutes));
    if (answer.hours > 0) return { id: crypto.randomUUID(), operation, difficulty, topHours, topMinutes, bottomHours, bottomMinutes, answerHours: answer.hours, answerMinutes: answer.minutes, requiresCarryOrBorrow: topMinutes < bottomMinutes };
  }

  return { id: crypto.randomUUID(), operation, difficulty, topHours: 5, topMinutes: 40, bottomHours: 2, bottomMinutes: 10, answerHours: 3, answerMinutes: 30, requiresCarryOrBorrow: false };
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
  const ctx = context();
  if (!ctx) return;
  const start = ctx.currentTime + offset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (end) osc.frequency.exponentialRampToValueAtTime(end, start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration);
}

function noise(duration: number, volume: number) {
  const ctx = context();
  if (!ctx) return;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

function sound(kind: "start" | "hit" | "damage" | "clear") {
  if (kind === "start") { tone(330, 0, 0.08, "triangle", 0.06, 440); tone(660, 0.08, 0.1, "triangle", 0.06, 880); return; }
  if (kind === "hit") { noise(0.12, 0.16); tone(90, 0, 0.16, "sawtooth", 0.12, 42); tone(520, 0.02, 0.08, "square", 0.08, 180); return; }
  if (kind === "clear") { tone(523, 0, 0.09, "triangle", 0.07, 659); tone(659, 0.1, 0.09, "triangle", 0.07, 784); tone(784, 0.2, 0.16, "triangle", 0.08, 1046); return; }
  noise(0.1, 0.12); tone(160, 0, 0.18, "sawtooth", 0.11, 70); tone(55, 0.05, 0.22, "square", 0.08, 35);
}

function bgm(step: number) {
  const bass = [82, 82, 110, 98, 82, 123, 110, 98];
  const lead = [330, 392, 440, 392, 494, 440, 392, 330];
  tone(bass[step % bass.length], 0, 0.16, "square", 0.035, bass[step % bass.length] * 0.98);
  if (step % 2 === 0) tone(lead[step % lead.length], 0.03, 0.1, "triangle", 0.025);
}

function scoreFor(elapsed: number, streak: number, mistakes: number) {
  const speed = Math.max(0, 120 - Math.floor((elapsed / 1000) * 6));
  const combo = Math.min(120, streak * 15);
  return Math.max(20, 100 + speed + combo - mistakes * 35);
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
  const add = problem.operation === "addition";
  const input = (field: Field, label: string, small = false) => <input aria-label={label} className={`rounded-lg border-2 bg-white text-center font-black text-slate-800 outline-none focus:border-sky-500 ${small ? "h-10 w-16 text-xl" : "h-16 w-24 text-3xl"} ${active === field ? "border-sky-500 ring-4 ring-sky-100" : "border-slate-200"}`} inputMode="numeric" maxLength={2} value={answer[field]} onChange={(e) => setAnswer(field, e.target.value)} onFocus={() => setActive(field)} />;
  return <section className="rounded-lg border-4 border-sky-200 bg-white p-5 shadow-soft">
    <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-2xl font-black text-slate-800">세로셈 문제</h2><span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-bold text-sky-800">60분 = 1시간</span></div>
    <div className="mx-auto max-w-md rounded-lg bg-slate-50 p-4">
      <div className="grid grid-cols-[2.5rem_1fr_1fr] items-end gap-2 text-center text-sm font-bold text-slate-500"><span /><span>시간</span><span>분</span></div>
      <div className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-2 py-1"><span />{add ? <>{input("carryA", "받아올림 칸", true)}<span /></> : <>{input("carryA", "바뀐 시간 칸", true)}{input("carryB", "바뀐 분 칸", true)}</>}</div>
      <div className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-2 py-2 text-center text-3xl font-black text-slate-800"><span /><span>{problem.topHours}시간</span><span>{problem.topMinutes}분</span></div>
      <div className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-2 py-2 text-center text-3xl font-black text-slate-800"><span className="text-4xl text-rose-500">{add ? "+" : "-"}</span><span>{problem.bottomHours}시간</span><span>{problem.bottomMinutes}분</span></div>
      <div className="my-2 border-t-4 border-slate-700" />
      <div className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-2 pt-2"><span /><label className="flex items-center justify-center gap-2 text-xl font-black text-slate-700">{input("hours", "정답 시간")}시간</label><label className="flex items-center justify-center gap-2 text-xl font-black text-slate-700">{input("minutes", "정답 분")}분</label></div>
    </div>
  </section>;
}

function NumberPad({ press, back, clear, submit }: { press: (n: string) => void; back: () => void; clear: () => void; submit: () => void }) {
  return <div className="grid grid-cols-3 gap-2">{"1234567890".split("").map((n) => <button key={n} className="h-14 rounded-lg border-2 border-sky-200 bg-white text-2xl font-black text-sky-800 shadow-sm hover:bg-sky-50" onClick={() => press(n)}>{n}</button>)}<button className="h-14 rounded-lg border-2 border-amber-200 bg-amber-50 text-lg font-black text-amber-800" onClick={back}>지움</button><button className="h-14 rounded-lg border-2 border-rose-200 bg-rose-50 text-lg font-black text-rose-800" onClick={clear}>비움</button><button className="col-span-3 h-14 rounded-lg bg-emerald-500 text-xl font-black text-white shadow-md hover:bg-emerald-600" onClick={submit}>정답 확인</button></div>;
}

function StartScreen({ difficulty, setDifficulty, start }: { difficulty: Difficulty; setDifficulty: (d: Difficulty) => void; start: () => void }) {
  return <main className="min-h-screen bg-cyan-50 px-4 py-8 text-slate-800"><section className="mx-auto flex max-w-4xl flex-col gap-6 rounded-lg border-4 border-sky-200 bg-white p-6 shadow-soft"><p className="text-lg font-bold text-sky-700">초등학교 3학년 시간 계산</p><h1 className="text-5xl font-black text-slate-900">시간 비행 드릴</h1><div className="grid gap-4 text-xl font-bold sm:grid-cols-3">{(["easy", "normal", "hard"] as Difficulty[]).map((d) => <button key={d} className={`rounded-lg border-4 p-4 text-left ${difficulty === d ? "border-sky-500 bg-sky-100" : "border-slate-200 bg-slate-50"}`} onClick={() => setDifficulty(d)}><span className="block text-2xl font-black">{labels[d]}</span><span className="mt-2 block text-base text-slate-600">{d === "easy" ? "받아올림, 받아내림 없이 계산해요." : d === "normal" ? "한 번 받아올림이나 받아내림을 연습해요." : "60분과 1시간 관계를 더 꼼꼼히 살펴봐요."}</span></button>)}</div><div className="rounded-lg bg-amber-50 p-4 text-lg font-bold text-amber-900">적 비행기가 나타나면 문제를 풀어요. 정답이면 미사일이 발사되고, 두 번 틀리면 내 비행기가 피격됩니다.</div><button className="h-16 rounded-lg bg-emerald-500 text-2xl font-black text-white shadow-md hover:bg-emerald-600" onClick={start}>게임 시작</button></section></main>;
}

function Result({ status, score, correct, wrong, best, difficulty, attempts, restart, home }: { status: Status; score: number; correct: number; wrong: number; best: number; difficulty: Difficulty; attempts: Attempt[]; restart: () => void; home: () => void }) {
  const key = `time-flight-rankings-${difficulty}`;
  const [name, setName] = useState("");
  const [rankings, setRankings] = useState<Ranking[]>(() => JSON.parse(localStorage.getItem(key) ?? "[]") as Ranking[]);
  const [done, setDone] = useState(false);
  const hard = attempts.some((a) => a.mistakes > 0 && a.requiresCarryOrBorrow) ? "받아올림/받아내림이 있는 문제를 더 연습해 보세요." : "좋아요. 60분 = 1시간 규칙을 잘 떠올렸어요.";
  function register() { const entry = { id: crypto.randomUUID(), name: (name.trim() || "이름 없음").slice(0, 10), score, correct, wrong, combo: best, difficulty }; const next = [...rankings, entry].sort((a, b) => b.score - a.score).slice(0, 5); localStorage.setItem(key, JSON.stringify(next)); setRankings(next); setDone(true); }
  return <main className="min-h-screen bg-cyan-50 px-4 py-8 text-slate-800"><section className="mx-auto max-w-4xl rounded-lg border-4 border-sky-200 bg-white p-6 shadow-soft"><p className="text-lg font-bold text-sky-700">{labels[difficulty]} 스테이지 · {status === "clear" ? "스테이지 클리어" : "게임 오버"}</p><h1 className="mt-1 text-4xl font-black text-slate-900">{status === "clear" ? "적 비행기 10대를 모두 격추했어요!" : "하트를 모두 사용했어요"}</h1><div className="mt-6 grid gap-3 text-xl font-black sm:grid-cols-4"><div className="rounded-lg bg-sky-50 p-4 text-sky-800">점수 {score}</div><div className="rounded-lg bg-emerald-50 p-4 text-emerald-800">맞힌 문제 {correct}</div><div className="rounded-lg bg-rose-50 p-4 text-rose-800">틀린 횟수 {wrong}</div><div className="rounded-lg bg-amber-50 p-4 text-amber-800">최고 콤보 {best}</div></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><section className="rounded-lg bg-slate-50 p-4 text-lg font-bold"><p>{hard}</p><p className="mt-3 text-base text-slate-600">첫 오답은 힌트와 감점, 같은 문제 두 번째 오답은 하트 감소로 처리돼요.</p></section><section className="rounded-lg border-2 border-indigo-100 bg-indigo-50 p-4"><h2 className="text-2xl font-black text-indigo-900">스테이지 랭킹</h2><p className="mt-1 text-sm font-bold text-indigo-700">현재는 서버가 아니라 이 기기의 브라우저에 저장돼요.</p><div className="mt-3 flex gap-2"><input className="h-12 min-w-0 flex-1 rounded-lg border-2 border-indigo-200 bg-white px-3 text-lg font-bold outline-none" disabled={done} maxLength={10} placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} /><button className="h-12 rounded-lg bg-indigo-600 px-4 text-lg font-black text-white disabled:bg-slate-300" disabled={done} onClick={register}>등록</button></div><ol className="mt-4 space-y-2">{rankings.length === 0 ? <li className="rounded-lg bg-white p-3 font-bold text-slate-600">아직 등록된 기록이 없어요.</li> : rankings.map((r, i) => <li key={r.id} className="grid grid-cols-[2rem_1fr_auto] rounded-lg bg-white p-3 font-black"><span>{i + 1}</span><span>{r.name}</span><span>{r.score}점</span></li>)}</ol></section></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><button className="h-14 rounded-lg bg-sky-500 text-xl font-black text-white" onClick={restart}>다시 도전</button><button className="h-14 rounded-lg bg-slate-800 text-xl font-black text-white" onClick={home}>홈으로</button></div></section></main>;
}

export default function App() {
  const [status, setStatus] = useState<Status>("start");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [problem, setProblem] = useState(() => generateProblem("easy"));
  const [answer, setAnswerState] = useState(emptyAnswer);
  const [active, setActive] = useState<Field>("hours");
  const [hearts, setHearts] = useState(3);
  const [shot, setShot] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("적 비행기가 나타났어요. 문제를 풀어 미사일을 발사해요.");
  const [phase, setPhase] = useState<Phase>("enemyReady");
  const [solved, setSolved] = useState(false);
  const [bgmOn, setBgmOn] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const startedAt = useRef(Date.now());
  const bgmStep = useRef(0);
  const solution = useMemo(() => problem.operation === "addition" ? [`분 계산: ${problem.topMinutes}분 + ${problem.bottomMinutes}분`, `정답: ${fmt(problem.answerHours, problem.answerMinutes)}`] : [`분 계산: ${problem.topMinutes}분 - ${problem.bottomMinutes}분`, problem.requiresCarryOrBorrow ? "1시간을 60분으로 바꾸어 계산해요." : "분끼리 바로 뺄 수 있어요.", `정답: ${fmt(problem.answerHours, problem.answerMinutes)}`], [problem]);

  useEffect(() => { if (status !== "playing" || !bgmOn) return undefined; const id = window.setInterval(() => { bgm(bgmStep.current); bgmStep.current += 1; }, 360); return () => window.clearInterval(id); }, [bgmOn, status]);

  function setAnswer(field: Field, value: string) { if (!solved) setAnswerState((old) => ({ ...old, [field]: onlyDigits(value) })); }
  function reset(newDifficulty = difficulty) { setProblem(generateProblem(newDifficulty)); setAnswerState(emptyAnswer); setActive("hours"); setMistakes(0); setSolved(false); setPhase("enemyReady"); startedAt.current = Date.now(); }
  function start() { sound("start"); setStatus("playing"); setHearts(3); setShot(0); setCorrect(0); setWrong(0); setStreak(0); setBest(0); setScore(0); setAttempts([]); setBgmOn(true); bgmStep.current = 0; setFeedback("적 비행기가 나타났어요. 문제를 풀어 미사일을 발사해요."); reset(difficulty); }
  function home() { setBgmOn(false); setStatus("start"); }
  function record(m: number) { setAttempts((old) => [...old.filter((a) => a.id !== problem.id), { id: problem.id, operation: problem.operation, requiresCarryOrBorrow: problem.requiresCarryOrBorrow, mistakes: m }]); }
  function submit() {
    if (solved) return;
    const h = Number(answer.hours); const m = Number(answer.minutes);
    if (answer.hours === "" || answer.minutes === "" || Number.isNaN(h) || Number.isNaN(m)) { setFeedback("시간과 분을 모두 입력해 주세요."); return; }
    if (m > 59) { setFeedback("60분이 넘으면 시간으로 바꿔야 해요."); return; }
    if (toTotal(h, m) === toTotal(problem.answerHours, problem.answerMinutes)) {
      const nextStreak = streak + 1; const nextShot = shot + 1; const earned = scoreFor(Date.now() - startedAt.current, nextStreak, mistakes);
      setSolved(true); setPhase("missileHit"); setCorrect((v) => v + 1); setShot(nextShot); setScore((v) => v + earned); setStreak(nextStreak); setBest((v) => Math.max(v, nextStreak)); record(mistakes); sound(nextShot >= 10 ? "clear" : "hit"); setFeedback(`격추 성공! +${earned}점`);
      window.setTimeout(() => { if (nextShot >= 10) { setBgmOn(false); setStatus("clear"); } else { reset(); setFeedback("새 적이 나타났어요. 문제를 풀어 미사일을 발사해요."); } }, 900); return;
    }
    const nextMistakes = mistakes + 1; setMistakes(nextMistakes); setWrong((v) => v + 1); setScore((v) => Math.max(0, v - 60)); setStreak(0); setPhase("playerHit"); sound("damage"); record(nextMistakes);
    if (nextMistakes % 2 === 0) { const nextHearts = hearts - 1; setHearts(nextHearts); setSolved(true); setFeedback(`피격! -60점. 정답은 ${fmt(problem.answerHours, problem.answerMinutes)}입니다.`); window.setTimeout(() => { if (nextHearts <= 0) { setBgmOn(false); setStatus("gameOver"); } else { reset(); setFeedback("다음 적이 나타났어요. 다시 도전해요."); } }, 1200); }
    else { setFeedback(problem.operation === "addition" ? "피격! -60점. 분끼리 더했을 때 60분이 넘는지 확인해 보세요." : "피격! -60점. 분끼리 뺄 수 없다면 1시간을 60분으로 바꿔 보세요."); window.setTimeout(() => setPhase("enemyReady"), 650); }
  }

  if (status === "start") return <StartScreen difficulty={difficulty} setDifficulty={setDifficulty} start={start} />;
  if (status !== "playing") return <Result status={status} score={score} correct={correct} wrong={wrong} best={best} difficulty={difficulty} attempts={attempts} restart={start} home={home} />;
  return <main className="min-h-screen bg-cyan-50 px-3 py-4 text-slate-800 sm:px-5"><div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1fr_1.05fr]"><div className="space-y-3"><div className="flex gap-2"><button className="h-11 rounded-lg bg-slate-900 px-4 font-black text-cyan-50" onClick={() => setBgmOn((v) => !v)}>BGM {bgmOn ? "켜짐" : "꺼짐"}</button><button className="h-11 rounded-lg bg-white px-4 font-black text-slate-800 shadow-md" onClick={home}>홈</button></div><GameCanvas hearts={hearts} shot={shot} phase={phase} streak={streak} score={score} /></div><div className="space-y-4"><VerticalProblem problem={problem} answer={answer} active={active} setAnswer={setAnswer} setActive={setActive} /><div className="grid gap-4 xl:grid-cols-[1fr_18rem]"><section className="rounded-lg border-4 border-amber-200 bg-white p-4 shadow-soft"><p className="text-lg font-black text-slate-800">안내</p><p className="mt-2 min-h-14 text-2xl font-black text-amber-800">{feedback}</p>{solved && <ol className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-lg font-bold text-slate-700">{solution.map((s) => <li key={s}>{s}</li>)}</ol>}</section><NumberPad press={(n) => setAnswer(active, `${answer[active]}${n}`)} back={() => setAnswer(active, answer[active].slice(0, -1))} clear={() => setAnswer(active, "")} submit={submit} /></div></div></div></main>;
}
