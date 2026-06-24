import { For } from "solid-js";
import type { AgentStep, PhaseStatus } from "../types/agent";

function phLabel(s: PhaseStatus) { if (s === "pending") return "等待中"; if (s === "running") return "进行中"; if (s === "success") return "已完成"; return "失败"; }

export function StepProgressCard(props: { step?: AgentStep }) {
  const s = props.step;
  const phases = () => [
    { key: "capture", icon: "📸", title: "截图",
      desc: s?.captureStatus === "running" ? "正在截取当前屏幕" : s?.captureStatus === "success" ? "截图完成" : "等待截图",
      status: s?.captureStatus ?? "pending" as PhaseStatus },
    { key: "model", icon: "🧠", title: "VLM 识别与决策",
      desc: s?.modelStatus === "running" ? "正在识别界面并规划下一步" : s?.modelStatus === "success" ? "模型已返回操作建议" : "等待模型分析",
      status: s?.modelStatus ?? "pending" as PhaseStatus },
    { key: "action", icon: "🖱️", title: "执行动作",
      desc: s?.actionStatus === "running" ? (s?.actionSummary || "正在执行桌面动作") : s?.actionStatus === "success" ? "动作执行完成" : "等待执行",
      status: s?.actionStatus ?? "pending" as PhaseStatus },
  ];

  return (
    <div class="dash-card">
      <div class="dash-card-title">当前步骤进度</div>
      <div class="phase-list">
        <For each={phases()}>{(p) => (
          <div class={`phase-item phase-${p.status}`}>
            <div class={`phase-dot phase-dot-${p.status}`}>{p.icon}</div>
            <div class="phase-content">
              <div class="phase-title-row">
                <span class="phase-title">{p.title}</span>
                <span class={`phase-badge phase-badge-${p.status}`}>{phLabel(p.status)}</span>
              </div>
              <p class="phase-desc">{p.desc}</p>
            </div>
          </div>
        )}</For>
      </div>
    </div>
  );
}
