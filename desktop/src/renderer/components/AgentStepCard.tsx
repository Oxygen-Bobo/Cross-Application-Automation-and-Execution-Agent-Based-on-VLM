import { createMemo, createSignal, For, Show } from "solid-js";
import type { AgentStep, PhaseStatus, RunStatus, StepPhase } from "../types/agent";

function fms(ms?:number){if(!ms)return"0.0s";return`${(ms/1000).toFixed(1)}s`}
function ld(s:AgentStep){return Math.max(0,(s.endedAt||Date.now())-s.startedAt)}
function sl(s:RunStatus){const m:Record<string,string>={running:"运行中",capturing:"截图中",thinking:"AI分析中",acting:"执行中",waiting:"等待中",completed:"已完成",failed:"失败",stopped:"已停止"};return m[s]||s}
function pl(s:PhaseStatus){return s==="pending"?"未执行":s==="running"?"进行中":s==="success"?"已完成":"失败"}

function PhaseBlock(props:{phase:StepPhase;screenshotPath?:string;annotatedPath?:string}){
  const imgSrc=()=>props.annotatedPath||props.screenshotPath||props.phase.screenshotPath;
  const showImg=()=>props.phase.key==="capture"&&!!imgSrc();
  return(
    <div class={`step-phase phase-${props.phase.status}`}>
      <div class="phase-header">
        <div class="phase-name"><span class="phase-icon">{props.phase.icon}</span><span>{props.phase.title}</span></div>
        <span class={`phase-status phase-status-${props.phase.status}`}>{pl(props.phase.status)}</span>
      </div>
      <div class="phase-msg">{props.phase.message}</div>
      {showImg()&&<img class="phase-screenshot" src={`agent-file://${imgSrc()!.replace(/\\/g,"/")}`} alt="screenshot"
        onError={(e)=>{(e.currentTarget as HTMLElement).style.display="none"}} />}
    </div>
  );
}

export function AgentStepCard(props:{step:AgentStep;active:boolean}){
  const init=()=>props.step.status==="completed"?false:true;
  const [mo,setMo]=createSignal<boolean|null>(null);
  const isOpen=createMemo(()=>mo()!==null?mo()!:(init()&&!props.step.collapsed)||props.step.status==="failed");
  const phases=createMemo(()=>[props.step.phases.capture,props.step.phases.ai,props.step.phases.action]);
  const dur=createMemo(()=>props.step.durationMs||ld(props.step));
  const think=createMemo(()=>{if(props.step.thinkingDurationMs)return props.step.thinkingDurationMs;if(props.step.aiStartedAt&&!props.step.aiEndedAt)return Date.now()-props.step.aiStartedAt;return 0});

  return(
    <div class={`step-card step-card-${props.step.status} ${props.active?"step-card-active":""}`}>
      <button type="button" class="step-card-hdr" onClick={()=>setMo(!isOpen())}>
        <div class="step-title-wrap">
          <span class="step-num">Step {props.step.step}</span>
          <span class="step-title-text">{props.step.title}</span>
        </div>
        <div class="step-meta-wrap">
          <span class={`step-st step-st-${props.step.status}`}>{sl(props.step.status)}</span>
          <span class="step-time">耗时 {fms(dur())}</span>
        </div>
      </button>
      <Show when={isOpen()}>
        <div class="step-card-body">
          <div class="phase-list">
            <For each={phases()}>{(p)=><PhaseBlock phase={p} screenshotPath={props.step.screenshotPath} annotatedPath={props.step.annotatedPath} />}</For>
          </div>
          <details class="step-dev">
            <summary>开发者详情</summary>
            <Show when={props.step.error}><div class="step-err">{props.step.error}</div></Show>
            <div class="dev-sub">Attempts</div>
            <For each={props.step.attempts}>{(a)=><details class="attempt-item"><summary>Attempt {a.index}{a.error?" · 失败":""}</summary><pre>{a.rawLogs.join("\n")}</pre></details>}</For>
            <div class="dev-sub">Raw Logs</div>
            <pre>{props.step.rawLogs.join("\n")}</pre>
            <Show when={props.step.rawModelOutput}><details><summary>模型原始输出</summary><pre>{props.step.rawModelOutput}</pre></details></Show>
            <Show when={props.step.rawToolCall}><details><summary>Tool Call</summary><pre>{JSON.stringify(props.step.rawToolCall,null,2)}</pre></details></Show>
          </details>
        </div>
      </Show>
    </div>
  );
}
