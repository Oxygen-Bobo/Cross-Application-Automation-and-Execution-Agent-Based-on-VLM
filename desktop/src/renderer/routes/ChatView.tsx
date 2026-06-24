import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import type { AgentEvent } from "../types/agent";
import type { AgentRun } from "../types/agent";
import type { HistoryRun } from "../types/agent";
import { inferCompactPlanFromInstruction } from "../lib/compactPlan";
import { parseAgentStdoutLine, applyAgentEventToRun } from "../lib/agentNormalize";
import { TaskPlanBubble } from "../components/TaskPlanBubble";
import { AgentTimeline } from "../components/AgentTimeline";
import "../styles/agent-dashboard.css";

type ViewMode = "new" | "history" | "running";

let defaultOutputDir = "";
const RECS = [
  { t: "打开微信发消息", d: "找到联系人、输入内容并发送", p: "打开微信，找到指定联系人，发送消息" },
  { t: "整理桌面文件", d: "识别文件类型，按文档、图片分类整理", p: "帮我整理桌面上的文件，按类型放进不同文件夹" },
  { t: "查找最近下载文件", d: "打开下载目录查找最近保存的文件", p: "帮我查找最近下载的文件" },
  { t: "打开浏览器搜索", d: "自动打开浏览器搜索指定内容", p: "打开浏览器，搜索指定信息" },
];

export default function ChatView() {
  const [activeRun, setActiveRun] = createSignal<AgentRun | null>(null);
  const [selectedRun, setSelectedRun] = createSignal<AgentRun | null>(null);
  const [viewMode, setViewMode] = createSignal<ViewMode>("new");
  const [historyItems, setHistoryItems] = createSignal<HistoryRun[]>([]);
  const [elapsed, setElapsed] = createSignal(0);
  let scrollRef: HTMLDivElement | undefined;
  let timer: number | null = null;
  let persistTimer: number | null = null;
  let listeners: (() => void)[] = [];

  // --- History helpers ---
  async function refreshHistory() {
    try { const h = await window.electronAPI.agent.getHistory() || []; setHistoryItems(h); (window as any).__setHistory?.(h); } catch {}
  }
  async function selectHistory(id: string) {
    try {
      const d = await window.electronAPI.agent.loadFullRun(id);
      if (d) { setSelectedRun(d); setViewMode("history"); return; }
    } catch {}
    // Fallback: create minimal run from history list item
    const item = historyItems().find(h => h.id === id);
    if (item) {
      const minimal: AgentRun = {
        id: item.id, instruction: item.instruction, status: item.status as any,
        createdAt: new Date(item.createdAt).getTime(), elapsedMs: item.elapsedMs || 0,
        currentStep: item.stepCount || 0, maxSteps: item.maxSteps || 50,
        currentActionText: item.completed ? "任务已完成" : item.status,
        compactPlan: inferCompactPlanFromInstruction(item.instruction),
        steps: [], rawLogs: [], outputDir: "", modelName: "",
      };
      setSelectedRun(minimal); setViewMode("history");
    }
  }
  function resetToNew() { setViewMode("new"); setSelectedRun(null); setActiveRun(null); setElapsed(0); }
  function persistRun(r: AgentRun) {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = window.setTimeout(async () => {
      persistTimer = null;
      const hr = { id: r.id, instruction: r.instruction, status: r.status, createdAt: new Date(r.createdAt).toISOString(), stepCount: r.steps.length, maxSteps: r.maxSteps, currentStep: r.steps.length, elapsedMs: elapsed(), completed: r.status === "completed" };
      await window.electronAPI.agent.saveHistory(hr as any);
      await window.electronAPI.agent.saveFullRun(r);
      refreshHistory();
    }, 1000);
  }
  async function persistRunNow() {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    const r = activeRun(); if (!r) { refreshHistory(); return; }
    const hr = { id: r.id, instruction: r.instruction, status: r.status, createdAt: new Date(r.createdAt).toISOString(), stepCount: r.steps.length, maxSteps: r.maxSteps, currentStep: r.steps.length, elapsedMs: elapsed(), completed: r.status === "completed" };
    await window.electronAPI.agent.saveHistory(hr as any);
    await window.electronAPI.agent.saveFullRun(r);
    refreshHistory();
  }

  // Expose for App/Sidebar
  (window as any).__loadPastRun = (id: string) => selectHistory(id);
  (window as any).__newTask = () => { persistRunNow().then(() => resetToNew()); };

  // Load initial history and repair if needed
  refreshHistory();
  window.electronAPI.agent.repairHistory?.().catch(() => {});

  const displayRun = () => viewMode() === "running" ? activeRun() : viewMode() === "history" ? selectedRun() : null;
  const isRunning = () => !!activeRun() && ["running","capturing","thinking","acting","waiting"].includes(activeRun()!.status);

  const sd = () => setTimeout(() => scrollRef?.scrollTo({ top: scrollRef.scrollHeight, behavior: "smooth" }), 60);

  createEffect(() => {
    const r = activeRun();
    if (r && ["running","capturing","thinking","acting","waiting"].includes(r.status)) {
      timer = window.setInterval(() => { setElapsed(p => p + 1000); uf(); }, 1000);
    } else { if (timer) { clearInterval(timer); timer = null; } }
  });
  onCleanup(() => { if (timer) clearInterval(timer); if (persistTimer) clearTimeout(persistTimer); listeners.forEach(f => f()); });

  // Register listeners ONCE
  createEffect(() => {
    listeners.forEach(f => f()); listeners = [];
    listeners.push(
      window.electronAPI.agent.onStdout((d: { text: string }) => {
        setActiveRun(p => {
          if (!p) return p;
          const evt = parseAgentStdoutLine(d.text, p.currentStep);
          const next = applyAgentEventToRun(p, evt);
          persistRun(next);
          return next;
        });
        sd(); uf();
      }),
      window.electronAPI.agent.onEvent((evt: AgentEvent) => {
        he(evt); sd(); uf();
      }),
      window.electronAPI.agent.onFinished(d => {
        const s = d.exitCode === 0 ? "completed" : "failed";
        setActiveRun(p => {
          if (!p) return p;
          const now = Date.now();
          const steps = p.steps.map(st => {
            if (["running","capturing","thinking","acting","waiting"].includes(st.status)) {
              return { ...st, status: s === "completed" ? "completed" as any : "failed" as any, endedAt: now, durationMs: now - st.startedAt,
                phases: { ...st.phases,
                  capture: { ...st.phases.capture, status: st.phases.capture.status === "running" ? (s === "completed" ? "success" : "error") as any : st.phases.capture.status },
                  ai: { ...st.phases.ai, status: st.phases.ai.status === "running" ? (s === "completed" ? "success" : "error") as any : st.phases.ai.status },
                  action: { ...st.phases.action, status: st.phases.action.status === "running" ? (s === "completed" ? "success" : "error") as any : st.phases.action.status },
                } };
            }
            return st;
          });
          return { ...p, status: s as any, endedAt: now, steps, currentActionText: s === "completed" ? "任务已完成" : "任务执行失败" };
        });
        persistRunNow();
        setTimeout(() => window.electronAPI.floating.hide(), 3000);
      }),
      window.electronAPI.agent.onError(d => {
        setActiveRun(p => {
          if (!p) return p;
          const now = Date.now();
          const steps = p.steps.map(st => {
            if (["running","capturing","thinking","acting","waiting"].includes(st.status)) {
              return { ...st, status: "failed" as any, endedAt: now, durationMs: now - st.startedAt,
                phases: { ...st.phases, capture: { ...st.phases.capture, status: st.phases.capture.status === "running" ? "error" as any : st.phases.capture.status }, ai: { ...st.phases.ai, status: st.phases.ai.status === "running" ? "error" as any : st.phases.ai.status }, action: { ...st.phases.action, status: st.phases.action.status === "running" ? "error" as any : st.phases.action.status } } };
            }
            return st;
          });
          return { ...p, status: "failed", endedAt: now, steps, currentActionText: "任务执行失败" };
        });
        persistRunNow();
      }),
      (window as any).desktopAgent?.onHistoryUpdated?.(() => refreshHistory()) || (() => {}),
    );
  });
  onCleanup(() => listeners.forEach(f => f()));

  function he(evt: AgentEvent) {
    switch (evt.type) {
      case "run_started":
        setElapsed(0);
        setActiveRun({
          id: evt.runId, instruction: evt.instruction, status: "running",
          createdAt: Date.now(), startedAt: Date.now(), elapsedMs: 0,
          currentStep: 0, maxSteps: evt.maxSteps,
          currentActionText: "正在启动 Agent…",
          compactPlan: inferCompactPlanFromInstruction(evt.instruction),
          steps: [], rawLogs: [], outputDir: evt.outputDir, modelName: evt.modelName,
        });
        setViewMode("running"); setSelectedRun(null);
        window.electronAPI.floating.show(); uf(); persistRun(activeRun()!);
        break;
      case "step_started":
        setActiveRun(p => { if (!p) return p; return applyAgentEventToRun(p, parseAgentStdoutLine(`STEP ${evt.step}`, evt.step)); });
        break;
      case "output":
        setActiveRun(p => {
          if (!p) return p;
          const ui = parseAgentStdoutLine(evt.text, p.currentStep);
          const next = applyAgentEventToRun(p, ui);
          const idx = next.steps.length - 1;
          if (idx >= 0) {
            next.steps[idx].rawModelOutput = (next.steps[idx].rawModelOutput || "") + evt.text + "\n";
            try { const m = evt.text.match(/<tool_call>(.*?)<\/tool_call>/s); if (m) next.steps[idx].rawToolCall = JSON.parse(m[1]); } catch {}
          }
          return next;
        });
        break;
      case "screenshot":
        setActiveRun(p => {
          if (!p) return p;
          const ss = [...p.steps]; const idx = Math.min(p.currentStep, ss.length - 1);
          if (idx >= 0 && idx < ss.length) ss[idx] = { ...ss[idx], screenshotPath: evt.path, phases: { ...ss[idx].phases, capture: { ...ss[idx].phases.capture, status: "success", screenshotPath: evt.path, message: "截图获取：屏幕截图已完成" } } };
          return { ...p, steps: ss, currentActionText: "截图已捕获" };
        });
        break;
      case "annotated_screenshot":
        setActiveRun(p => {
          if (!p) return p;
          const ss = [...p.steps]; const idx = p.currentStep >= 0 && p.currentStep < ss.length ? p.currentStep : ss.length - 1;
          if (idx >= 0) ss[idx] = { ...ss[idx], annotatedPath: evt.path, screenshotPath: ss[idx].screenshotPath || evt.path, status: "completed", durationMs: Date.now() - ss[idx].startedAt, phases: { ...ss[idx].phases, capture: { ...ss[idx].phases.capture, screenshotPath: evt.path, status: "success", message: "截图获取：屏幕截图已完成" }, action: { ...ss[idx].phases.action, status: "success", message: "决策执行：动作执行完成" } } };
          return { ...p, steps: ss, currentActionText: "动作执行完成" };
        });
        break;
      case "run_finished":
        setActiveRun(p => {
          if (!p) return p;
          const s = evt.status === "success" ? "completed" : "failed";
          const now = Date.now();
          const steps = p.steps.map(st => {
            if (["running","capturing","thinking","acting","waiting"].includes(st.status)) {
              return { ...st, status: s === "completed" ? "completed" as any : "failed" as any, endedAt: now, durationMs: now - st.startedAt,
                phases: { ...st.phases, capture: { ...st.phases.capture, status: st.phases.capture.status === "running" ? (s === "completed" ? "success" : "error") as any : st.phases.capture.status }, ai: { ...st.phases.ai, status: st.phases.ai.status === "running" ? (s === "completed" ? "success" : "error") as any : st.phases.ai.status }, action: { ...st.phases.action, status: st.phases.action.status === "running" ? (s === "completed" ? "success" : "error") as any : st.phases.action.status } } };
            }
            return st;
          });
          return { ...p, status: s as any, endedAt: now, steps, currentActionText: s === "completed" ? "任务已完成" : "任务执行失败" };
        });
        persistRunNow();
        break;
    }
  }

  async function uf() { const r = activeRun(); if (!r || !["running","capturing","thinking","acting","waiting"].includes(r.status)) return; await window.electronAPI.floating.update({ status: r.status, currentStep: r.currentStep, maxSteps: r.maxSteps, actionText: r.currentActionText, elapsedMs: elapsed(), instruction: r.instruction }); }

  async function start(instr: string) {
    const ak = await window.electronAPI.config.getApiKey(); if (!ak) { alert("请先在设置中配置 API Key"); return; }
    const cfg = await window.electronAPI.config.get();
    if (!defaultOutputDir) defaultOutputDir = await window.electronAPI.agent.getDefaultOutputDir();
    const dir = `${defaultOutputDir}/run_${Date.now()}`;
    setActiveRun(null); setSelectedRun(null); setElapsed(0); setViewMode("new");
    const res = await window.electronAPI.agent.start({ instruction: instr, apiKey: ak, baseUrl: cfg.baseUrl, modelName: cfg.modelName, maxSteps: 50, outputDir: dir });
    if (!res.ok) alert(res.error);
  }
  async function stop() {
    await window.electronAPI.agent.stop();
    setActiveRun(p => {
      if (!p) return p;
      const now = Date.now();
      const steps = p.steps.map(st => {
        if (["running","capturing","thinking","acting","waiting"].includes(st.status)) {
          return { ...st, status: "stopped" as any, endedAt: now, durationMs: now - st.startedAt,
            phases: { ...st.phases, capture: { ...st.phases.capture, status: st.phases.capture.status === "running" ? "error" as any : st.phases.capture.status }, ai: { ...st.phases.ai, status: st.phases.ai.status === "running" ? "error" as any : st.phases.ai.status }, action: { ...st.phases.action, status: st.phases.action.status === "running" ? "error" as any : st.phases.action.status } } };
        }
        return st;
      });
      return { ...p, status: "stopped", endedAt: now, steps, currentActionText: "任务已被用户停止" };
    });
    window.electronAPI.floating.hide(); persistRunNow();
  }

  return (
    <div class="flex-1 flex flex-col min-h-0" style="background:var(--bg-main)">
      <Show when={displayRun() !== null}>
        <header class="flex items-center justify-between px-5 py-2.5 border-b shrink-0" style="background:var(--bg-sidebar);border-color:var(--border-light)">
          <div class="flex items-center gap-3 text-sm" style="color:var(--text-secondary)">
            <div data-component="status-badge" data-status={displayRun()!.status}>{stLab(displayRun()!.status)}</div>
            <Show when={displayRun()?.modelName}><span class="text-xs" style="color:var(--text-tertiary);font-family:var(--font-family-mono)">{displayRun()?.modelName}</span></Show>
            <Show when={isRunning()}><span>Step {displayRun()?.currentStep}/{displayRun()?.maxSteps}</span></Show>
            <Show when={viewMode() === "history"}><span class="text-xs" style="color:var(--text-tertiary)">[历史记录]</span></Show>
          </div>
          <Show when={isRunning()}>
            <button data-component="button" data-variant="danger" data-size="sm" onClick={stop}>停止</button>
          </Show>
        </header>
      </Show>
      <div ref={scrollRef} class="flex-1 overflow-y-auto" style="padding:24px 32px">
        <div style="max-width:980px;margin:0 auto">
          <Show when={displayRun()} fallback={<Home onStart={start} />}>
            {(r) => <Dash r={r()} />}
          </Show>
        </div>
      </div>
      {viewMode() !== "new" && (
        <div class="shrink-0" style="background:var(--bg-main);padding:0 32px 20px">
          <div style="max-width:980px;margin:0 auto">
            <Composer onRun={start} onStop={stop} running={isRunning()} />
          </div>
        </div>
      )}
    </div>
  );
}

function stLab(s: string) { const m: Record<string,string>={idle:"空闲",running:"运行中",capturing:"截图中",thinking:"AI分析中",acting:"执行中",waiting:"等待中",completed:"已完成",failed:"失败",stopped:"已停止"};return m[s]||s; }

function Dash(props: { r: AgentRun }) {
  const r = () => props.r;
  return (<div class="agent-dash"><div class="dash-summary"><h2 class="text-xl font-bold text-[#111827] mb-3">{r().instruction}</h2><div class="flex flex-wrap gap-x-5 gap-y-1 text-base" style="color:#475467"><span>Step {r().currentStep}/{r().maxSteps}</span><span style="color:var(--brand)">当前：{r().currentActionText||"准备开始"}</span></div></div><TaskPlanBubble items={r().compactPlan}/><AgentTimeline steps={r().steps} currentStep={r().currentStep}/></div>);
}

function Home(props: { onStart: (s: string) => void }) {
  const [t, st] = createSignal("");
  return (<div class="animate-fade-in" style="padding-top:60px"><h1 class="text-2xl font-bold text-[var(--text-primary)] mb-2">今天想让我帮你做什么？</h1><p class="text-base text-[var(--text-secondary)] mb-8">我可以观察屏幕、理解界面，并帮你完成跨应用操作。</p><div class="dash-summary" style="padding:24px"><textarea class="w-full resize-none border-none outline-none" style="font-family:inherit;font-size:18px;color:var(--text-primary);min-height:80px;background:transparent" placeholder="请输入任务，交给我来帮你完成" value={t()} onInput={e=>st(e.currentTarget.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();props.onStart(t());st("")}}}/><div class="flex items-center justify-between mt-3"><span class="text-xs" style="color:var(--text-tertiary)">Agent 将控制你的鼠标和键盘 · 按 Esc 紧急停止</span><button data-component="button" data-variant="primary" data-size="lg" onClick={()=>{props.onStart(t());st("")}} disabled={!t().trim()}>执行任务</button></div></div><h2 class="text-lg font-semibold text-[var(--text-primary)] mb-3 mt-8">推荐任务</h2><div class="grid grid-cols-2 gap-3">{RECS.map((item,i)=><div key={i} class="dash-summary cursor-pointer hover:translate-y-[-2px] hover:shadow-lg transition-all" style="padding:16px 20px" onClick={()=>st(item.p)}><p class="text-sm font-semibold text-[var(--text-primary)] mb-1">{item.t}</p><p class="text-xs text-[var(--text-tertiary)]">{item.d}</p></div>)}</div></div>);
}

function Composer(props: { onRun: (s: string) => void; onStop: () => void; running: boolean }) {
  const [t, st] = createSignal("");
  function sub() { if (props.running) { props.onStop(); return; } const x = t().trim(); if (!x) return; props.onRun(x); st(""); }
  const isDisabled = () => !props.running && !t().trim();
  return (<div class="composer"><div class="composer-card"><textarea class="composer-textarea" placeholder="请输入任务，交给我来帮你完成" value={t()} onInput={e=>st(e.currentTarget.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sub()}}} disabled={props.running}/><button class="composer-send-btn" classList={{running:props.running}} disabled={isDisabled()} onClick={sub} title={props.running?"停止":"发送"}>{props.running?(<svg viewBox="0 0 24 24" fill="#dc2626"><rect x="5" y="5" width="14" height="14" rx="3"/></svg>):(<svg viewBox="0 0 24 24" fill="none" stroke={isDisabled()?"#cbd5e1":"#2563eb"} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>)}</button></div><p class="composer-hint">Agent 将控制你的鼠标和键盘 · 按 Esc 紧急停止</p></div>);
}
