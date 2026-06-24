import { createSignal, createMemo, onMount, onCleanup } from "solid-js";

type S = {
  st: string;     // canonical state: idle|capturing|thinking|running|acting|waiting|success|error|stopped
  p: number;      // progress 0-100
  step?: number;
  tot?: number;
  task: string;
  act: string;
  msg: string;
};

const META: Record<string, [string, string]> = {
  idle:      ["\u26A1", "\u7A7A\u95F2"],
  capturing: ["\u{1F4F8}", "\u622A\u56FE\u4E2D"],
  thinking:  ["\u2726", "\u601D\u8003\u4E2D"],
  planning:  ["\u2726", "\u89C4\u5212\u4E2D"],
  observing: ["\u2726", "\u89C2\u5BDF\u4E2D"],
  running:   ["\u25B6", "\u8FD0\u884C\u4E2D"],
  acting:    ["\u{1F5B1}", "\u6267\u884C\u4E2D"],
  waiting:   ["\uFF1F",  "\u7B49\u5F85\u786E\u8BA4"],
  success:   ["\u2713", "\u5DF2\u5B8C\u6210"],
  completed: ["\u2713", "\u5DF2\u5B8C\u6210"],
  error:     ["\u0021", "\u5F02\u5E38"],
  failed:    ["\u0021", "\u5931\u8D25"],
  stopped:   ["\u25A0", "\u5DF2\u505C\u6B62"],
};

const ACCENT: Record<string, string> = {
  idle:"#8b98aa",stopped:"#8b98aa",capturing:"#06b6d4",thinking:"#8b5cf6",
  planning:"#8b5cf6",observing:"#8b5cf6",running:"#4f8cff",acting:"#2563eb",
  waiting:"#ffb020",success:"#35c759",completed:"#35c759",error:"#ff4d4f",failed:"#ff4d4f",
};

function cs(r: string): string {
  const m: Record<string,string>={capturing:"capturing",thinking:"thinking",planning:"planning",observing:"observing",acting:"acting",waiting:"waiting",running:"running",completed:"success",failed:"error",stopped:"stopped",success:"success",error:"error"};
  return m[r]||r||"idle";
}
function cl(v:number){return Math.max(0,Math.min(100,Math.round(v)))}
function fs(st?:number,tot?:number):string{
  if(st==null)return "\u6682\u65E0\u6B65\u9AA4";
  if(tot)return `\u6B65\u9AA4 ${st} / ${tot}`;
  return `\u7B2C ${st} \u6B65`;
}

/* Cache DOM refs */
let orb: HTMLElement, ring: HTMLElement, ico: HTMLElement, pct: HTMLElement;
let popTitle: HTMLElement, popTask: HTMLElement, popAct: HTMLElement, popStep: HTMLElement, popBar: HTMLElement;

/* Apply state to DOM */
function apply(s: S) {
  const m = META[s.st] || META.idle;
  const a = ACCENT[s.st] || "#4f8cff";

  // Orb class (set canonical state class)
  orb.className = `fb is-${s.st}`;

  // Progress ring
  const p = cl(s.p);
  if (p >= 100) ring.style.background = `conic-gradient(${a} 0deg 360deg)`;
  else if (p <= 0) ring.style.background = "none";
  else ring.style.background = `conic-gradient(${a} ${(p/100)*360}deg, rgba(255,255,255,0.08) 0deg)`;
  ring.style.mask = "radial-gradient(circle, transparent 57%, #000 63%)";
  ring.style.webkitMask = "radial-gradient(circle, transparent 57%, #000 63%)";

  // Icon
  ico.textContent = m[0];

  // Percentage
  if (p > 0 && p < 100) { pct.style.display = ""; pct.textContent = `${p}%`; }
  else pct.style.display = "none";

  // Popover
  popTitle.textContent = m[1];
  popTask.textContent = s.task || "\u6682\u65E0\u4EFB\u52A1";
  popAct.textContent = s.act || s.msg || "\u7B49\u5F85\u4E0B\u4E00\u6B65";
  popStep.textContent = fs(s.step, s.tot);

  // Popover bar
  popBar.style.width = `${p}%`;
  popBar.style.background = `linear-gradient(90deg, ${a}, rgba(255,255,255,0.3))`;
}

export default function init() {
  // Get DOM refs
  orb = document.getElementById("orb")!;
  ring = document.getElementById("orb-ring")!;
  ico = document.getElementById("orb-ico")!;
  pct = document.getElementById("orb-pct")!;
  popTitle = document.getElementById("pop-title")!;
  popTask = document.getElementById("pop-task")!;
  popAct = document.getElementById("pop-act")!;
  popStep = document.getElementById("pop-step")!;
  popBar = document.getElementById("pop-bar")!;

  let current: S = { st:"idle", p:0, task:"", act:"", msg:"\u7B49\u5F85\u4EFB\u52A1" };

  function upd(next: any) {
    const rawSt = cs(next.state || next.status || current.st);
    current = {
      st: rawSt,
      p: next.progress ?? next.progressPercent
        ?? (next.currentStep != null && next.maxSteps != null
          ? cl(((next.currentStep ?? 1) / (next.maxSteps ?? 50)) * 100)
          : current.p),
      step: next.step ?? next.currentStep ?? current.step,
      tot: next.totalSteps ?? next.maxSteps ?? current.tot,
      task: next.currentTask ?? next.instruction ?? current.task,
      act: next.currentAction ?? next.currentActionText ?? next.currentPhase ?? current.act,
      msg: next.message ?? current.msg,
    };
    apply(current);
  }

  // Global API
  (window as any).agentStatus = { update: upd };

  // IPC listeners
  let cleanups: (() => void)[] = [];
  const api = (window as any).electronAPI;
  if (api?.floating?.onStatusChanged)
    cleanups.push(api.floating.onStatusChanged((d: any) => upd(d)));
  if (api?.floating?.onStopTask)
    cleanups.push(api.floating.onStopTask(async () => { try { await api.agent?.stop(); } catch {} }));

  // Click handler
  (window as any).__orbClick = async () => {
    try { await api?.floating?.showMainWindow?.(); } catch {}
  };

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    cleanups.forEach(f => f());
    delete (window as any).agentStatus;
    delete (window as any).__orbClick;
  });
}
