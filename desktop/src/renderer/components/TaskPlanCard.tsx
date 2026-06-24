import { createSignal, For, Show } from "solid-js";
import type { PlanItem } from "../types/agent";

function icon(s: PlanItem["status"]) { if (s === "done") return "✅"; if (s === "running") return "🔄"; if (s === "failed") return "❌"; return "⏳"; }

export function TaskPlanCard(props: { items: PlanItem[] }) {
  const [openId, setOpenId] = createSignal<string | null>(null);
  return (
    <div class="dash-card">
      <div class="dash-card-title">任务规划</div>
      <div class="plan-list">
        <For each={props.items}>{(item) => (
          <div class={`plan-item plan-${item.status}`}>
            <div class="plan-main">
              <span class="plan-icon">{icon(item.status)}</span>
              <div class="plan-text">
                <p class="plan-title">{item.index}. {item.title}</p>
                <Show when={item.description}><p class="plan-desc">{item.description}</p></Show>
                <button class="plan-toggle" onClick={() => setOpenId(openId() === item.id ? null : item.id)}>
                  {openId() === item.id ? "收起任务执行详情" : "展开任务执行详情"}
                </button>
              </div>
            </div>
            <Show when={openId() === item.id}>
              <div class="plan-detail">
                <p style="margin-bottom:6px">视觉识别：{item.details?.modelReasoningSummary || "等待 Agent 执行后补充"}</p>
                <p style="margin-bottom:6px">实际动作：{item.details?.actionSummary || "暂未执行"}</p>
                <p style="margin-bottom:8px">耗时：{item.details?.durationMs ? `${item.details.durationMs}ms` : "暂无"}</p>
                <Show when={item.details?.rawLogs?.length}>
                  <details><summary class="raw-summary">开发者详情 / Raw Logs</summary>
                    <pre class="raw-pre">{item.details?.rawLogs?.join("\n")}</pre>
                  </details>
                </Show>
              </div>
            </Show>
          </div>
        )}</For>
      </div>
    </div>
  );
}
