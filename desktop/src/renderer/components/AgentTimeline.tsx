import { For, Show } from "solid-js";
import type { AgentStep } from "../types/agent";
import { AgentStepCard } from "./AgentStepCard";

export function AgentTimeline(props: { steps: AgentStep[]; currentStep: number }) {
  return (
    <section class="timeline-panel">
      <div class="tl-title-row">
        <h2 class="tl-title">执行过程</h2>
        <span class="tl-subtitle">每一步都会显示观察、理解和操作状态</span>
      </div>
      <Show
        when={props.steps.length > 0}
        fallback={<div class="tl-empty">任务开始后，这里会实时展示每一步的执行过程。</div>}
      >
        <For each={props.steps}>
          {(step) => <AgentStepCard step={step} active={step.step === props.currentStep} />}
        </For>
      </Show>
    </section>
  );
}
