import { createMemo, createSignal, For, Show } from "solid-js";
import type { AgentStep, PhaseStatus, RunStatus, StepPhase } from "../types/agent";

function formatMs(ms?: number) {
  if (!ms) return "0.0 秒";
  return `${(ms / 1000).toFixed(1)} 秒`;
}

function liveDuration(step: AgentStep) {
  return Math.max(0, (step.endedAt || Date.now()) - step.startedAt);
}

function statusLabel(status: RunStatus) {
  const labels: Record<string, string> = {
    idle: "空闲",
    running: "运行中",
    capturing: "观察中",
    thinking: "思考中",
    acting: "执行中",
    waiting: "等待中",
    completed: "已完成",
    failed: "失败",
    stopped: "已停止",
  };
  return labels[status] || status;
}

function phaseLabel(status: PhaseStatus) {
  const labels: Record<PhaseStatus, string> = {
    pending: "等待",
    running: "进行中",
    success: "完成",
    error: "失败",
  };
  return labels[status];
}

function PhaseBlock(props: { phase: StepPhase; screenshotPath?: string; annotatedPath?: string }) {
  const imagePath = () => props.annotatedPath || props.screenshotPath || props.phase.screenshotPath;
  const showImage = () => props.phase.key === "capture" && !!imagePath();

  return (
    <div class={`step-phase phase-${props.phase.status}`}>
      <div class="phase-header">
        <div class="phase-name">
          <span class="phase-icon">{props.phase.icon}</span>
          <span>{props.phase.title}</span>
        </div>
        <span class={`phase-status phase-status-${props.phase.status}`}>{phaseLabel(props.phase.status)}</span>
      </div>
      <div class="phase-msg">{props.phase.message}</div>
      <Show when={showImage()}>
        <img
          class="phase-screenshot"
          src={`agent-file://${imagePath()!.replace(/\\/g, "/")}`}
          alt="屏幕截图"
          onError={(event) => {
            (event.currentTarget as HTMLElement).style.display = "none";
          }}
        />
      </Show>
    </div>
  );
}

export function AgentStepCard(props: { step: AgentStep; active: boolean }) {
  const defaultOpen = () => props.step.status !== "completed";
  const [manualOpen, setManualOpen] = createSignal<boolean | null>(null);
  const isOpen = createMemo(() =>
    manualOpen() !== null ? manualOpen()! : (defaultOpen() && !props.step.collapsed) || props.step.status === "failed",
  );
  const phases = createMemo(() => [props.step.phases.capture, props.step.phases.ai, props.step.phases.action]);
  const duration = createMemo(() => props.step.durationMs || liveDuration(props.step));

  return (
    <article class={`step-card step-card-${props.step.status} ${props.active ? "step-card-active" : ""}`}>
      <button type="button" class="step-card-hdr" onClick={() => setManualOpen(!isOpen())}>
        <div class="step-title-wrap">
          <span class="step-num">第 {props.step.step + 1} 步</span>
          <span class="step-title-text">{props.step.title || "执行下一步操作"}</span>
        </div>
        <div class="step-meta-wrap">
          <span class={`step-st step-st-${props.step.status}`}>{statusLabel(props.step.status)}</span>
          <span class="step-time">耗时 {formatMs(duration())}</span>
        </div>
      </button>

      <Show when={isOpen()}>
        <div class="step-card-body">
          <div class="phase-list">
            <For each={phases()}>
              {(phase) => (
                <PhaseBlock
                  phase={phase}
                  screenshotPath={props.step.screenshotPath}
                  annotatedPath={props.step.annotatedPath}
                />
              )}
            </For>
          </div>

          <details class="step-dev">
            <summary>开发者详情</summary>
            <Show when={props.step.error}>
              <div class="step-err">{props.step.error}</div>
            </Show>
            <div class="dev-sub">尝试记录</div>
            <For each={props.step.attempts}>
              {(attempt) => (
                <details class="attempt-item">
                  <summary>
                    Attempt {attempt.index}
                    {attempt.error ? " · 失败" : ""}
                  </summary>
                  <pre>{attempt.rawLogs.join("\n")}</pre>
                </details>
              )}
            </For>
            <div class="dev-sub">原始日志</div>
            <pre>{props.step.rawLogs.join("\n")}</pre>
            <Show when={props.step.rawModelOutput}>
              <details>
                <summary>模型原始输出</summary>
                <pre>{props.step.rawModelOutput}</pre>
              </details>
            </Show>
            <Show when={props.step.rawToolCall}>
              <details>
                <summary>Tool Call</summary>
                <pre>{JSON.stringify(props.step.rawToolCall, null, 2)}</pre>
              </details>
            </Show>
          </details>
        </div>
      </Show>
    </article>
  );
}
