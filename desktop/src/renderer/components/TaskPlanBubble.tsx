import { For } from "solid-js";
import type { CompactPlanItem } from "../types/agent";

export function TaskPlanBubble(props: { items: CompactPlanItem[] }) {
  return (
    <div class="plan-bubble">
      <div class="plan-bubble-author">
        <span class="plan-avatar">🤖</span><span>助手</span>
      </div>
      <div class="plan-bubble-title">任务规划</div>
      <div class="plan-bubble-list">
        <For each={props.items}>{(item) => (
          <div class={`plan-bubble-item plan-bubble-${item.status||"pending"}`}>
            <span class="plan-item-icon">{item.icon}</span>
            <span class="plan-item-index">{item.index}.</span>
            <span class="plan-item-text">{item.text}</span>
          </div>
        )}</For>
      </div>
    </div>
  );
}
