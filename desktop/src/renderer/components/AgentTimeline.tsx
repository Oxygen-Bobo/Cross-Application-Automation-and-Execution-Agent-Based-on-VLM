import { For, Show } from "solid-js";
import type { AgentStep } from "../types/agent";
import { AgentStepCard } from "./AgentStepCard";

export function AgentTimeline(props:{steps:AgentStep[];currentStep:number}){
  return(
    <div>
      <div class="tl-title">执行时间线</div>
      <Show when={props.steps.length>0} fallback={<div class="tl-empty">Agent 开始执行后，这里会实时显示每一个 Step。</div>}>
        <For each={props.steps}>{(step)=><AgentStepCard step={step} active={step.step===props.currentStep} />}</For>
      </Show>
    </div>
  );
}
