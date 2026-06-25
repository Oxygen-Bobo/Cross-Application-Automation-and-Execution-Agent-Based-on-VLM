type OrbState = {
  status: string;
  progress: number;
  step?: number;
  total?: number;
  task: string;
  action: string;
};

const META: Record<string, { icon: string; label: string; accent: string; tone: string }> = {
  idle: { icon: "✦", label: "空闲", accent: "#8b8177", tone: "neutral" },
  running: { icon: "↗", label: "运行中", accent: "#2f6b5c", tone: "active" },
  capturing: { icon: "◎", label: "屏幕观察", accent: "#2f6b5c", tone: "active" },
  thinking: { icon: "✦", label: "界面理解", accent: "#8a5a2f", tone: "active" },
  acting: { icon: "↗", label: "桌面执行", accent: "#2f6b5c", tone: "active" },
  waiting: { icon: "?", label: "等待响应", accent: "#b9742d", tone: "warn" },
  completed: { icon: "✓", label: "任务完成", accent: "#2f6b5c", tone: "success" },
  success: { icon: "✓", label: "任务完成", accent: "#2f6b5c", tone: "success" },
  failed: { icon: "!", label: "任务失败", accent: "#a84227", tone: "danger" },
  error: { icon: "!", label: "任务失败", accent: "#a84227", tone: "danger" },
  stopped: { icon: "■", label: "已停止", accent: "#8b8177", tone: "neutral" },
};

const PHASE_INDEX: Record<string, number> = { capturing: 0, thinking: 1, acting: 2 };

function canonical(status?: string) {
  const value = status || "idle";
  const map: Record<string, string> = {
    planning: "thinking",
    observing: "capturing",
    completed: "completed",
    success: "completed",
    failed: "failed",
    error: "failed",
  };
  return map[value] || value;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stepText(step?: number, total?: number) {
  if (step == null) return "暂无步骤";
  if (total) return `第 ${step} / ${total} 步`;
  return `第 ${step} 步`;
}

export default function init() {
  const root = document.getElementById("root")!;
  root.innerHTML = "";

  const style = document.createElement("style");
  style.textContent = `
    html,body,#root{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent!important}
    .orb-root{position:relative;width:100%;height:100%;background:transparent;-webkit-app-region:drag;user-select:none}
    .orb{position:absolute;top:12px;left:12px;width:78px;height:78px;border:0;border-radius:50%;cursor:pointer;-webkit-app-region:no-drag;background:linear-gradient(145deg,#fffdf7,#efe5d8);box-shadow:0 18px 46px rgba(67,51,34,.24),0 0 0 1px rgba(73,62,50,.13),inset 0 1px 0 rgba(255,255,255,.92);transition:transform .18s ease,box-shadow .18s ease}
    .orb:hover{transform:translateY(-1px) scale(1.045);box-shadow:0 24px 58px rgba(67,51,34,.28),0 0 0 1px rgba(73,62,50,.18),inset 0 1px 0 rgba(255,255,255,.92)}
    .orb-ring{position:absolute;inset:-5px;border-radius:50%;pointer-events:none;filter:drop-shadow(0 0 8px rgba(47,107,92,.18))}
    .orb-core{position:absolute;inset:13px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 38% 26%,#fffdf7,#f1e5d8);box-shadow:inset 0 0 0 1px rgba(73,62,50,.08)}
    .orb-icon{font-size:28px;font-weight:900;line-height:1;color:#2d261f}
    .orb-dot{position:absolute;right:8px;bottom:10px;width:13px;height:13px;border:2px solid #fffdf7;border-radius:50%;background:var(--accent,#8b8177)}
    .phase-mini{position:absolute;left:50%;bottom:6px;display:flex;gap:3px;transform:translateX(-50%);z-index:3}
    .phase-mini span{width:16px;height:16px;display:grid;place-items:center;border-radius:999px;background:rgba(255,253,247,.78);color:#8b8177;font-size:10px;font-weight:900;box-shadow:0 0 0 1px rgba(73,62,50,.08)}
    .phase-mini span.active{background:var(--accent,#2f6b5c);color:#fffdf7;box-shadow:0 0 0 2px rgba(255,253,247,.92),0 4px 10px rgba(67,51,34,.2)}
    .orb.is-active .orb-core{animation:orbBreath 1.45s ease-in-out infinite}
    .orb.is-danger{background:linear-gradient(145deg,#fff8f4,#f3d8cf)}
    .orb.is-success{background:linear-gradient(145deg,#f7fff9,#dcece3)}
    .popover{position:absolute;top:102px;left:12px;width:236px;padding:15px 16px;border:1px solid rgba(73,62,50,.12);border-radius:16px;background:rgba(255,253,247,.97);box-shadow:0 22px 54px rgba(67,51,34,.24);opacity:0;visibility:hidden;transform:translateY(6px);transition:opacity .16s ease,visibility .16s ease,transform .16s ease;-webkit-app-region:no-drag;pointer-events:none}
    .orb:hover+.popover{opacity:1;visibility:visible;transform:translateY(0)}
    .pop-title{display:flex;align-items:center;gap:8px;margin-bottom:10px;color:#241f1a;font-size:14px;font-weight:800}
    .pop-title span{width:9px;height:9px;border-radius:50%;background:var(--accent,#8b8177)}
    .pop-row{display:grid;grid-template-columns:44px 1fr;gap:8px;padding:2px 0;font-size:12px;line-height:1.55}
    .pop-label{color:#8b8177}
    .pop-value{overflow:hidden;color:#3d352e;text-overflow:ellipsis;white-space:nowrap}
    .pop-bar{height:5px;margin-top:12px;border-radius:999px;background:#ece2d6;overflow:hidden}
    .pop-fill{height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,var(--accent,#2f6b5c),rgba(255,255,255,.4));transition:width .35s ease}
    @keyframes orbBreath{0%,100%{transform:scale(1)}50%{transform:scale(.94)}}
  `;
  document.head.appendChild(style);

  root.innerHTML = `
    <div class="orb-root">
      <button class="orb" id="orb" title="查看任务状态">
        <div class="orb-ring" id="orb-ring"></div>
        <div class="orb-core"><span class="orb-icon" id="orb-icon">✦</span></div>
        <span class="orb-dot" id="orb-dot"></span>
        <div class="phase-mini" id="phase-mini">
          <span>◎</span><span>✦</span><span>↗</span>
        </div>
      </button>
      <div class="popover">
        <div class="pop-title"><span></span><strong id="pop-title">空闲</strong></div>
        <div class="pop-row"><span class="pop-label">任务</span><span class="pop-value" id="pop-task">暂无任务</span></div>
        <div class="pop-row"><span class="pop-label">当前</span><span class="pop-value" id="pop-action">等待下一步</span></div>
        <div class="pop-row"><span class="pop-label">进度</span><span class="pop-value" id="pop-step">暂无步骤</span></div>
        <div class="pop-bar"><div class="pop-fill" id="pop-fill"></div></div>
      </div>
    </div>
  `;

  const orb = document.getElementById("orb")!;
  const ring = document.getElementById("orb-ring")!;
  const icon = document.getElementById("orb-icon")!;
  const title = document.getElementById("pop-title")!;
  const task = document.getElementById("pop-task")!;
  const action = document.getElementById("pop-action")!;
  const step = document.getElementById("pop-step")!;
  const fill = document.getElementById("pop-fill")!;
  const phaseMini = Array.from(document.querySelectorAll("#phase-mini span")) as HTMLElement[];

  let current: OrbState = { status: "idle", progress: 0, task: "", action: "" };

  function apply(state: OrbState) {
    const status = canonical(state.status);
    const meta = META[status] || META.idle;
    const progress = clamp(state.progress);
    orb.className = `orb is-${meta.tone}`;
    orb.style.setProperty("--accent", meta.accent);
    icon.textContent = meta.icon;
    title.textContent = meta.label;
    task.textContent = state.task || "暂无任务";
    action.textContent = state.action || "等待下一步";
    step.textContent = stepText(state.step, state.total);
    fill.style.width = `${progress}%`;
    phaseMini.forEach((el, index) => el.classList.toggle("active", PHASE_INDEX[status] === index));
    ring.style.background = progress <= 0
      ? "none"
      : `conic-gradient(from -90deg, ${meta.accent} ${progress * 3.6}deg, rgba(73,62,50,.08) ${progress * 3.6}deg)`;
    ring.style.mask = "radial-gradient(circle, transparent 57%, #000 63%)";
    ring.style.webkitMask = "radial-gradient(circle, transparent 57%, #000 63%)";
  }

  function update(next: any) {
    const status = canonical(next.currentPhase || next.status || next.state || current.status);
    current = {
      status,
      progress: next.progress ?? next.progressPercent ?? current.progress,
      step: next.currentStep ?? next.step ?? current.step,
      total: next.maxSteps ?? next.totalSteps ?? current.total,
      task: next.instruction ?? next.currentTask ?? current.task,
      action: next.actionText ?? next.currentActionText ?? next.currentAction ?? current.action,
    };
    apply(current);
  }

  apply(current);
  (window as any).agentStatus = { update };

  orb.addEventListener("click", async () => {
    try {
      await (window as any).electronAPI?.floating?.showMainWindow?.();
    } catch {}
  });

  const cleanups: (() => void)[] = [];
  const api = (window as any).electronAPI;
  if (api?.floating?.onStatusChanged) cleanups.push(api.floating.onStatusChanged((data: any) => update(data)));
  if (api?.floating?.onStopTask) cleanups.push(api.floating.onStopTask(async () => {
    try {
      await api.agent?.stop();
    } catch {}
  }));

  window.addEventListener("beforeunload", () => {
    cleanups.forEach((dispose) => dispose());
    delete (window as any).agentStatus;
  });
}
