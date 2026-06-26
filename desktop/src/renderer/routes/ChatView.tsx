import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { AgentEvent, AgentRun, HistoryRun, RunStatus } from "../types/agent";
import { inferCompactPlanFromInstruction } from "../lib/compactPlan";
import { applyAgentEventToRun, parseAgentStdoutLine } from "../lib/agentNormalize";
import { AgentTimeline } from "../components/AgentTimeline";
import { TaskPlanBubble } from "../components/TaskPlanBubble";
import "../styles/agent-dashboard.css";

type ViewMode = "new" | "history" | "running";
type PromptCard = { id: string; title: string; description: string; prompt: string; accent: string };

const RUNNING_STATUSES: RunStatus[] = ["running", "capturing", "thinking", "acting", "waiting"];
const PROMPT_KEY = "desktop-agent.frequent-prompts.v2";
let defaultOutputDir = "";

const DEFAULT_PROMPTS: PromptCard[] = [
  {
    id: "wechat-report",
    title: "报告发送给微信文件传输助手",
    description: "适合把已生成的报告、表格或文档发送到微信。",
    prompt: "打开微信，搜索并进入文件传输助手，将刚刚生成的报告文件发送过去，发送后确认会话中出现该文件。",
    accent: "mint",
  },
  {
    id: "desktop-cleanup",
    title: "整理桌面文件",
    description: "按文档、图片、压缩包、安装包分类整理。",
    prompt: "请整理桌面上的文件，按文档、图片、压缩包、安装包分类创建文件夹并移动进去，完成后检查整理结果。",
    accent: "clay",
  },
  {
    id: "browser-summary",
    title: "浏览器检索并总结",
    description: "搜索资料，提取重点，再给出简明总结。",
    prompt: "打开浏览器搜索指定主题，阅读可靠结果，提取关键结论并用简洁中文总结给我。",
    accent: "blue",
  },
  {
    id: "downloads-latest",
    title: "查找最近下载文件",
    description: "打开下载目录并定位最新文件。",
    prompt: "打开下载文件夹，按时间排序，找到最近下载的文件并告诉我文件名和位置。",
    accent: "gold",
  },
];

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    idle: "空闲",
    running: "运行中",
    capturing: "观察屏幕",
    thinking: "理解界面",
    acting: "执行操作",
    waiting: "等待响应",
    completed: "已完成",
    failed: "失败",
    stopped: "已停止",
  };
  return labels[status] || status;
}

function running(run: AgentRun | null) {
  return !!run && RUNNING_STATUSES.includes(run.status);
}

function loadPrompts(): PromptCard[] {
  try {
    const raw = localStorage.getItem(PROMPT_KEY);
    if (!raw) return DEFAULT_PROMPTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_PROMPTS;
  } catch {
    return DEFAULT_PROMPTS;
  }
}

function savePrompts(prompts: PromptCard[]) {
  localStorage.setItem(PROMPT_KEY, JSON.stringify(prompts));
}

async function streamToPcmBase64(stream: MediaStream, durationMs = 60000): Promise<string> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContextClass();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const samples: Float32Array[] = [];
  let sampleCount = 0;
  let stopped = false;

  return new Promise((resolve, reject) => {
    const stop = async () => {
      if (stopped) return;
      stopped = true;
      source.disconnect();
      processor.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      await audioContext.close();

      const merged = new Float32Array(sampleCount);
      let offset = 0;
      for (const chunk of samples) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(floatTo16kPcmBase64(merged, audioContext.sampleRate));
    };
    stopPcmRecordingRef.set(stream, stop);

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const copy = new Float32Array(input.length);
      copy.set(input);
      samples.push(copy);
      sampleCount += copy.length;
    };
    processor.onerror = () => reject(new Error("录音处理失败"));
    source.connect(processor);
    processor.connect(audioContext.destination);

    (stream.getAudioTracks()[0] as any).onended = stop;
    setTimeout(stop, durationMs);
  });
}

const stopPcmRecordingRef = new WeakMap<MediaStream, () => Promise<void>>();

function floatTo16kPcmBase64(input: Float32Array, sourceRate: number) {
  const targetRate = 16000;
  const ratio = sourceRate / targetRate;
  const targetLength = Math.max(1, Math.round(input.length / ratio));
  const pcm = new Int16Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const sourceIndex = i * ratio;
    const before = Math.floor(sourceIndex);
    const after = Math.min(before + 1, input.length - 1);
    const weight = sourceIndex - before;
    const sample = input[before] * (1 - weight) + input[after] * weight;
    const clamped = Math.max(-1, Math.min(1, sample));
    pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  let binary = "";
  const bytes = new Uint8Array(pcm.buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function createVoiceInput(setText: (updater: (value: string) => string) => void) {
  const [recording, setRecording] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  let activeStream: MediaStream | null = null;
  let stopPcmRecording: (() => Promise<void>) | null = null;

  function cleanup() {
    activeStream?.getTracks().forEach((track) => track.stop());
    activeStream = null;
    stopPcmRecording = null;
    setRecording(false);
    setBusy(false);
  }

  async function stopRecording() {
    await stopPcmRecording?.();
  }

  async function toggle() {
    if (busy()) return;
    if (recording()) {
      await stopRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStream = stream;
      const recordingPromise = streamToPcmBase64(stream);
      stopPcmRecording = () => stopPcmRecordingRef.get(stream)?.() || Promise.resolve();
      recordingPromise
        .then(async (audioBase64) => {
          setRecording(false);
          setBusy(true);
          try {
            const result = await window.electronAPI.speech.transcribe({ audioBase64, mimeType: "audio/pcm", sampleRate: 16000, encoding: "raw" });
            if (!result.ok) {
              alert(result.error || "语音识别失败");
              return;
            }
            const recognized = (result.text || "").trim();
            if (recognized) {
              setText((value) => `${value}${value.trim() ? "\n" : ""}${recognized}`);
            }
          } catch (error: any) {
            alert(error?.message || "语音识别失败");
          } finally {
            cleanup();
          }
        })
        .catch((error: any) => {
          cleanup();
          alert(error?.message || "语音识别失败");
        });
      setRecording(true);
    } catch (error: any) {
      cleanup();
      alert(error?.message || "无法启动麦克风，请检查系统权限。");
    }
  }

  return { recording, busy, toggle, cleanup };
}

function MicIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3Z" stroke="currentColor" stroke-width="2" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  );
}

export default function ChatView() {
  const [activeRun, setActiveRun] = createSignal<AgentRun | null>(null);
  const [selectedRun, setSelectedRun] = createSignal<AgentRun | null>(null);
  const [viewMode, setViewMode] = createSignal<ViewMode>("new");
  const [historyItems, setHistoryItems] = createSignal<HistoryRun[]>([]);
  const [elapsed, setElapsed] = createSignal(0);
  const [prompts, setPrompts] = createSignal<PromptCard[]>(loadPrompts());
  let scrollRef: HTMLDivElement | undefined;
  let timer: number | null = null;
  let persistTimer: number | null = null;
  let listeners: (() => void)[] = [];
  const stoppedRunIds = new Set<string>();

  async function refreshHistory() {
    try {
      const history = (await window.electronAPI.agent.getHistory()) || [];
      setHistoryItems(history);
      (window as any).__setHistory?.(history);
    } catch {}
  }

  async function selectHistory(id: string) {
    try {
      const detail = await window.electronAPI.agent.loadFullRun(id);
      if (detail) {
        setSelectedRun(detail);
        setViewMode("history");
        return;
      }
    } catch {}
    const item = historyItems().find((h) => h.id === id);
    if (!item) return;
    setSelectedRun({
      id: item.id,
      instruction: item.instruction,
      status: item.status as RunStatus,
      createdAt: new Date(item.createdAt).getTime(),
      elapsedMs: item.elapsedMs || 0,
      currentStep: item.stepCount || 0,
      maxSteps: item.maxSteps || 50,
      currentActionText: item.completed ? "任务已完成" : statusLabel(item.status),
      compactPlan: inferCompactPlanFromInstruction(item.instruction),
      steps: [],
      rawLogs: [],
      outputDir: "",
      modelName: "",
    });
    setViewMode("history");
  }

  function resetToNew() {
    setViewMode("new");
    setSelectedRun(null);
    setActiveRun(null);
    setElapsed(0);
  }

  function persistRun(run: AgentRun) {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = window.setTimeout(async () => {
      persistTimer = null;
      const summary = {
        id: run.id,
        instruction: run.instruction,
        status: run.status,
        createdAt: new Date(run.createdAt).toISOString(),
        stepCount: run.steps.length,
        maxSteps: run.maxSteps,
        currentStep: run.steps.length,
        elapsedMs: elapsed(),
        completed: run.status === "completed",
      };
      await window.electronAPI.agent.saveHistory(summary as any);
      await window.electronAPI.agent.saveFullRun(run);
      refreshHistory();
    }, 800);
  }

  async function persistRunNow() {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    const run = activeRun();
    if (!run) {
      refreshHistory();
      return;
    }
    const summary = {
      id: run.id,
      instruction: run.instruction,
      status: run.status,
      createdAt: new Date(run.createdAt).toISOString(),
      stepCount: run.steps.length,
      maxSteps: run.maxSteps,
      currentStep: run.steps.length,
      elapsedMs: elapsed(),
      completed: run.status === "completed",
    };
    await window.electronAPI.agent.saveHistory(summary as any);
    await window.electronAPI.agent.saveFullRun(run);
    refreshHistory();
  }

  (window as any).__loadPastRun = (id: string) => selectHistory(id);
  (window as any).__newTask = () => {
    persistRunNow().then(() => resetToNew());
  };

  onMount(() => {
    refreshHistory();
    window.electronAPI.agent.repairHistory?.().catch(() => {});
  });

  const displayRun = () => (viewMode() === "running" ? activeRun() : viewMode() === "history" ? selectedRun() : null);
  const isRunning = () => running(activeRun());
  const scrollDown = () => setTimeout(() => scrollRef?.scrollTo({ top: scrollRef.scrollHeight, behavior: "smooth" }), 60);

  createEffect(() => {
    const run = activeRun();
    if (running(run)) {
      if (!timer) timer = window.setInterval(() => setElapsed((value) => value + 1000), 1000);
    } else if (timer) {
      clearInterval(timer);
      timer = null;
    }
  });

  createEffect(() => {
    listeners.forEach((dispose) => dispose());
    listeners = [
      window.electronAPI.agent.onStdout((data: { text: string }) => {
        setActiveRun((prev) => {
          if (!prev) return prev;
          if (prev.status === "stopped" || stoppedRunIds.has(prev.id)) return prev;
          const next = applyAgentEventToRun(prev, parseAgentStdoutLine(data.text, prev.currentStep));
          persistRun(next);
          return next;
        });
        scrollDown();
        updateFloating();
      }),
      window.electronAPI.agent.onEvent((event: AgentEvent) => {
        const runId = (event as any).runId;
        const current = activeRun();
        if (current?.status === "stopped" && event.type !== "run_started") return;
        if (runId && stoppedRunIds.has(runId) && event.type !== "run_finished") return;
        handleAgentEvent(event);
        scrollDown();
        updateFloating();
      }),
      window.electronAPI.agent.onFinished((data: any) => {
        if (data?.status === "stopped") {
          finishRun("stopped");
          return;
        }
        const current = activeRun();
        if (current?.status === "stopped" || (current?.id && stoppedRunIds.has(current.id))) return;
        finishRun(data.exitCode === 0 ? "completed" : "failed");
      }),
      window.electronAPI.agent.onError(() => finishRun("failed")),
      (window as any).desktopAgent?.onHistoryUpdated?.(() => refreshHistory()) || (() => {}),
    ];
  });

  onCleanup(() => {
    if (timer) clearInterval(timer);
    if (persistTimer) clearTimeout(persistTimer);
    listeners.forEach((dispose) => dispose());
  });

  function finishRun(status: "completed" | "failed" | "stopped") {
    setActiveRun((prev) => {
      if (!prev) return prev;
      if (prev.status === "stopped" && status !== "stopped") return prev;
      const timestamp = Date.now();
      const isCompleted = status === "completed";
      const isStopped = status === "stopped";
      return {
        ...prev,
        status,
        endedAt: timestamp,
        steps: prev.steps.map((step) =>
          RUNNING_STATUSES.includes(step.status)
            ? {
                ...step,
                status,
                endedAt: timestamp,
                durationMs: timestamp - step.startedAt,
                phases: {
                  capture: {
                    ...step.phases.capture,
                    status: step.phases.capture.status === "running" ? (isCompleted ? "success" : "error") : step.phases.capture.status,
                  },
                  ai: {
                    ...step.phases.ai,
                    status: step.phases.ai.status === "running" ? (isCompleted ? "success" : "error") : step.phases.ai.status,
                  },
                  action: {
                    ...step.phases.action,
                    status: step.phases.action.status === "running" ? (isCompleted ? "success" : "error") : step.phases.action.status,
                  },
                },
              }
            : step,
        ),
        currentActionText: isCompleted ? "任务已完成" : isStopped ? "任务已停止" : "任务执行失败",
      };
    });
    persistRunNow();
    const run = activeRun();
    if (run) {
      window.electronAPI.floating.update({
        status,
        currentStep: run.currentStep,
        maxSteps: run.maxSteps,
        actionText: status === "completed" ? "任务已完成" : status === "stopped" ? "任务已停止" : "任务执行失败",
        instruction: run.instruction,
        currentPhase: status,
        progressPercent: status === "completed" ? 100 : 50,
      });
    }
    if (status === "failed") setTimeout(() => window.electronAPI.floating.showMainWindow?.(), 1200);
    setTimeout(() => window.electronAPI.floating.hide(), 2600);
  }

  function handleAgentEvent(event: AgentEvent) {
    switch (event.type) {
      case "run_started":
        stoppedRunIds.delete(event.runId);
        setElapsed(0);
        setActiveRun({
          id: event.runId,
          instruction: event.instruction,
          status: "running",
          createdAt: Date.now(),
          startedAt: Date.now(),
          elapsedMs: 0,
          currentStep: 0,
          maxSteps: event.maxSteps,
          currentActionText: "正在启动 Agent",
          compactPlan: inferCompactPlanFromInstruction(event.instruction),
          steps: [],
          rawLogs: [],
          outputDir: event.outputDir,
          modelName: event.modelName,
        });
        setViewMode("running");
        setSelectedRun(null);
        window.electronAPI.floating.show();
        persistRun(activeRun()!);
        break;
      case "step_started":
        setActiveRun((prev) => (prev ? applyAgentEventToRun(prev, parseAgentStdoutLine(`STEP ${event.step}`, event.step)) : prev));
        break;
      case "output":
        setActiveRun((prev) => {
          if (!prev) return prev;
          const next = applyAgentEventToRun(prev, parseAgentStdoutLine(event.text, prev.currentStep));
          const lastIndex = next.steps.length - 1;
          if (lastIndex >= 0) {
            next.steps[lastIndex].rawModelOutput = (next.steps[lastIndex].rawModelOutput || "") + event.text + "\n";
            try {
              const match = event.text.match(/<tool_call>(.*?)<\/tool_call>/s);
              if (match) next.steps[lastIndex].rawToolCall = JSON.parse(match[1]);
            } catch {}
          }
          return next;
        });
        break;
      case "screenshot":
        setActiveRun((prev) => {
          if (!prev) return prev;
          const steps = [...prev.steps];
          const index = Math.min(prev.currentStep, steps.length - 1);
          if (index >= 0) {
            steps[index] = {
              ...steps[index],
              screenshotPath: event.path,
              phases: {
                ...steps[index].phases,
                capture: { ...steps[index].phases.capture, status: "success", screenshotPath: event.path, message: "屏幕截图已完成" },
              },
            };
          }
          return { ...prev, steps, currentActionText: "已获取屏幕截图" };
        });
        break;
      case "annotated_screenshot":
        setActiveRun((prev) => {
          if (!prev) return prev;
          const steps = [...prev.steps];
          const index = prev.currentStep >= 0 && prev.currentStep < steps.length ? prev.currentStep : steps.length - 1;
          if (index >= 0) {
            steps[index] = {
              ...steps[index],
              annotatedPath: event.path,
              screenshotPath: steps[index].screenshotPath || event.path,
              status: "completed",
              durationMs: Date.now() - steps[index].startedAt,
              phases: {
                ...steps[index].phases,
                capture: { ...steps[index].phases.capture, screenshotPath: event.path, status: "success", message: "屏幕截图已完成" },
                action: { ...steps[index].phases.action, status: "success", message: "桌面操作已完成" },
              },
            };
          }
          return { ...prev, steps, currentActionText: "桌面操作已完成" };
        });
        break;
      case "run_finished":
        finishRun(event.status === "success" || event.status === "completed" ? "completed" : event.status === "stopped" ? "stopped" : "failed");
        break;
    }
  }

  async function updateFloating() {
    const run = activeRun();
    if (!run || !running(run)) return;
    const last = run.steps[run.steps.length - 1];
    const currentPhase = (() => {
      if (!last) return run.status;
      if (last.phases.capture.status === "running" || last.phases.capture.status === "pending") return "capturing";
      if (last.phases.ai.status === "running" || last.phases.ai.status === "pending") return "thinking";
      if (last.phases.action.status === "running" || last.phases.action.status === "pending") return "acting";
      return run.status;
    })();
    const completed = run.steps.filter((step) => step.status === "completed" || step.status === "failed").length;
    const total = Math.max(completed + 1, run.steps.length, 1);
    const phaseDone = last
      ? [last.phases.capture, last.phases.ai, last.phases.action].filter((phase) => phase.status === "success" || phase.status === "error").length / 3
      : 0;
    const progressPercent = Math.min(96, Math.round(((completed + phaseDone) / total) * 100));
    await window.electronAPI.floating.update({
      status: run.status,
      currentStep: run.currentStep + 1,
      maxSteps: run.maxSteps,
      actionText: run.currentActionText,
      elapsedMs: elapsed(),
      instruction: run.instruction,
      currentPhase,
      progressPercent,
    });
  }

  async function start(instruction: string) {
    const text = instruction.trim();
    if (!text || isRunning()) return;
    const apiKey = await window.electronAPI.config.getApiKey();
    if (!apiKey) {
      alert("请先在设置中配置 API Key");
      return;
    }
    const config = await window.electronAPI.config.get();
    if (!defaultOutputDir) defaultOutputDir = await window.electronAPI.agent.getDefaultOutputDir();
    const outputDir = `${defaultOutputDir}/run_${Date.now()}`;
    setActiveRun(null);
    setSelectedRun(null);
    setElapsed(0);
    setViewMode("new");
    const result = await window.electronAPI.agent.start({
      instruction: text,
      apiKey,
      baseUrl: config.baseUrl,
      modelName: config.modelName,
      maxSteps: 50,
      outputDir,
    });
    if (!result.ok) alert(result.error);
  }

  async function stop() {
    const run = activeRun();
    if (run) stoppedRunIds.add(run.id);
    finishRun("stopped");
    window.electronAPI.floating.update({ status: "stopped", actionText: "任务已停止", currentPhase: "stopped" });
    setTimeout(() => window.electronAPI.floating.hide(), 800);
    persistRunNow();
    const result = await window.electronAPI.agent.stop();
    if (!result.ok && result.error !== "No agent run in progress.") {
      console.warn("Failed to stop agent:", result.error);
    }
  }

  function updatePrompt(card: PromptCard) {
    setPrompts((items) => {
      const next = items.map((item) => (item.id === card.id ? card : item));
      savePrompts(next);
      return next;
    });
  }

  function addPrompt() {
    const next = [
      ...prompts(),
      {
        id: `custom-${Date.now()}`,
        title: "新的常用指令",
        description: "点击编辑，写成你经常使用的完整任务。",
        prompt: "请把这里改成一个具体、可执行的任务指令。",
        accent: "blue",
      },
    ];
    setPrompts(next);
    savePrompts(next);
  }

  function removePrompt(id: string) {
    const next = prompts().filter((item) => item.id !== id);
    setPrompts(next);
    savePrompts(next);
  }

  return (
    <div class="agent-shell">
      <Show when={displayRun() !== null}>
        <header class="run-header">
          <div class="run-meta">
            <div data-component="status-badge" data-status={displayRun()!.status}>
              <span data-slot="status-dot" />
              {statusLabel(displayRun()!.status)}
            </div>
            <Show when={displayRun()?.modelName}>
              <span class="run-model">{displayRun()?.modelName}</span>
            </Show>
            <Show when={isRunning()}>
              <span class="run-step">第 {(displayRun()?.currentStep || 0) + 1} 步 / 最多 {displayRun()?.maxSteps} 步</span>
            </Show>
            <Show when={viewMode() === "history"}>
              <span class="run-history-badge">历史记录</span>
            </Show>
          </div>
          <Show when={isRunning()}>
            <button data-component="button" data-variant="danger" data-size="sm" onClick={stop}>
              停止任务
            </button>
          </Show>
        </header>
      </Show>

      <div ref={scrollRef} class="agent-scroll">
        <Show when={displayRun()} fallback={<Home prompts={prompts()} onStart={start} onAdd={addPrompt} onUpdate={updatePrompt} onRemove={removePrompt} />}>
          {(run) => <Dashboard run={run()} />}
        </Show>
      </div>

      <Show when={viewMode() !== "new"}>
        <div class="bottom-composer">
          <Composer onRun={start} onStop={stop} running={isRunning()} />
        </div>
      </Show>
    </div>
  );
}

function Dashboard(props: { run: AgentRun }) {
  const run = () => props.run;
  return (
    <div class="agent-dash">
      <section class="dash-summary">
        <div class="dash-kicker">当前任务</div>
        <h1>{run().instruction}</h1>
        <div class="dash-current">
          <span>{statusLabel(run().status)}</span>
          <strong>{run().currentActionText || "准备开始"}</strong>
        </div>
      </section>
      <TaskPlanBubble items={run().compactPlan} />
      <AgentTimeline steps={run().steps} currentStep={run().currentStep} />
    </div>
  );
}

function Home(props: {
  prompts: PromptCard[];
  onStart: (instruction: string) => void;
  onAdd: () => void;
  onUpdate: (card: PromptCard) => void;
  onRemove: (id: string) => void;
}) {
  const [text, setText] = createSignal("");
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const voice = createVoiceInput((updater) => setText((value) => updater(value)));
  onCleanup(() => voice.cleanup());

  function submit() {
    const value = text().trim();
    if (!value) return;
    props.onStart(value);
    setText("");
  }

  return (
    <main class="home-stage">
      <section class="hero-panel">
        <div class="hero-orbit">
          <span />
          <span />
          <span />
        </div>
        <div class="hero-copy">
          <div class="hero-eyebrow">Cross-Application Agent</div>
          <h1>
            需要我接手哪一步？
            <span>我会边观察边执行。</span>
          </h1>
          <p>把任务说清楚就行，比如“把报告发送给文件传输助手”或“整理桌面并检查结果”。</p>
        </div>
        <div class="hero-status-strip">
          <span>观察屏幕</span>
          <span>理解界面</span>
          <span>执行操作</span>
          <span>验证结果</span>
        </div>
      </section>

      <section class="home-composer-card">
        <textarea
          value={text()}
          onInput={(event) => setText(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="告诉我你的目标，我来一步步操作电脑完成它。"
        />
        <div class="composer-actions">
          <div class="safety-note">
            <span>!</span>
            Agent 会控制鼠标和键盘。任务执行时可随时点击停止任务。
          </div>
          <div class="composer-action-buttons">
            <button
              class="voice-input-btn"
              classList={{ recording: voice.recording(), busy: voice.busy() }}
              onClick={voice.toggle}
              disabled={voice.busy()}
              title={voice.recording() ? "停止录音并识别" : "语音输入"}
            >
              <MicIcon />
              <span>{voice.busy() ? "识别中" : voice.recording() ? "停止" : "语音输入"}</span>
            </button>
            <button data-component="button" data-variant="primary" data-size="lg" onClick={submit} disabled={!text().trim()}>
              开始执行
            </button>
          </div>
        </div>
      </section>

      <section class="prompt-section">
        <div class="prompt-head">
          <div>
            <h2>常用指令</h2>
            <p>把卡片改成你最常用、最具体的任务，下次一点就能填入输入框。</p>
          </div>
          <button data-component="button" data-variant="secondary" data-size="sm" onClick={props.onAdd}>
            新增指令
          </button>
        </div>

        <div class="prompt-grid">
          <For each={props.prompts}>
            {(card, index) => (
              <PromptCardView
                card={card}
                index={index()}
                editing={editingId() === card.id}
                onUse={() => setText(card.prompt)}
                onEdit={() => setEditingId(card.id)}
                onCancel={() => setEditingId(null)}
                onRemove={() => props.onRemove(card.id)}
                onSave={(next) => {
                  props.onUpdate(next);
                  setEditingId(null);
                }}
              />
            )}
          </For>
        </div>
      </section>
    </main>
  );
}

function PromptCardView(props: {
  card: PromptCard;
  index: number;
  editing: boolean;
  onUse: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onSave: (card: PromptCard) => void;
}) {
  const [title, setTitle] = createSignal(props.card.title);
  const [description, setDescription] = createSignal(props.card.description);
  const [prompt, setPrompt] = createSignal(props.card.prompt);

  createEffect(() => {
    if (props.editing) {
      setTitle(props.card.title);
      setDescription(props.card.description);
      setPrompt(props.card.prompt);
    }
  });

  return (
    <article class={`prompt-card prompt-${props.card.accent}`} style={{ "--delay": `${props.index * 55}ms` }}>
      <Show
        when={props.editing}
        fallback={
          <>
            <button class="prompt-card-main" onClick={props.onUse}>
              <span class="prompt-mark">✦</span>
              <strong>{props.card.title}</strong>
              <small>{props.card.description}</small>
            </button>
            <div class="prompt-card-actions">
              <button onClick={props.onEdit}>编辑</button>
              <button onClick={props.onRemove}>删除</button>
            </div>
          </>
        }
      >
        <div class="prompt-edit">
          <input value={title()} onInput={(event) => setTitle(event.currentTarget.value)} />
          <input value={description()} onInput={(event) => setDescription(event.currentTarget.value)} />
          <textarea value={prompt()} onInput={(event) => setPrompt(event.currentTarget.value)} />
          <div class="prompt-edit-actions">
            <button onClick={props.onCancel}>取消</button>
            <button
              onClick={() =>
                props.onSave({
                  ...props.card,
                  title: title().trim() || "未命名指令",
                  description: description().trim(),
                  prompt: prompt().trim(),
                })
              }
            >
              保存
            </button>
          </div>
        </div>
      </Show>
    </article>
  );
}

function Composer(props: { onRun: (instruction: string) => void; onStop: () => void; running: boolean }) {
  const [text, setText] = createSignal("");
  const voice = createVoiceInput((updater) => setText((value) => updater(value)));
  const disabled = () => !props.running && !text().trim();
  onCleanup(() => voice.cleanup());

  function submit() {
    if (props.running) {
      props.onStop();
      return;
    }
    const value = text().trim();
    if (!value) return;
    props.onRun(value);
    setText("");
  }

  return (
    <div class="composer">
      <div class="composer-card">
        <textarea
          class="composer-textarea"
          placeholder="继续告诉我下一项任务，我会按当前桌面状态接着处理。"
          value={text()}
          onInput={(event) => setText(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          disabled={props.running}
        />
        <button
          class="composer-voice-btn"
          classList={{ recording: voice.recording(), busy: voice.busy() }}
          disabled={props.running || voice.busy()}
          onClick={voice.toggle}
          title={voice.recording() ? "停止录音并识别" : "语音输入"}
        >
          <Show when={voice.recording()} fallback={<MicIcon />}>
            <span>■</span>
          </Show>
        </button>
        <button class="composer-send-btn" classList={{ running: props.running }} disabled={disabled()} onClick={submit} title={props.running ? "停止任务" : "发送任务"}>
          <Show when={props.running} fallback={<span>↑</span>}>
            <span>■</span>
          </Show>
        </button>
      </div>
      <p class="composer-hint">执行中请保持目标窗口可见；出现异常时可点击停止任务。</p>
    </div>
  );
}
