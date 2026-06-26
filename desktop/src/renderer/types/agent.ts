export type RunStatus = "idle"|"running"|"capturing"|"thinking"|"acting"|"waiting"|"completed"|"failed"|"stopped";
export type PhaseStatus = "pending"|"running"|"success"|"error";

export interface StepPhase { key:"capture"|"ai"|"action"; title:string; icon:string; status:PhaseStatus; message:string; startedAt?:number; endedAt?:number; screenshotPath?:string; error?:string }

export interface AgentStepAttempt { index:number; startedAt:number; endedAt?:number; rawLogs:string[]; error?:string }

export interface AgentStep {
  id:string; step:number; title:string; status:RunStatus;
  startedAt:number; endedAt?:number;
  captureStartedAt?:number; captureEndedAt?:number;
  aiStartedAt?:number; aiEndedAt?:number;
  actionStartedAt?:number; actionEndedAt?:number;
  thinkingDurationMs?:number; durationMs?:number;
  phases:{capture:StepPhase;ai:StepPhase;action:StepPhase};
  screenshotPath?:string; annotatedPath?:string; actionSummary?:string;
  rawLogs:string[]; attempts:AgentStepAttempt[]; error?:string;
  collapsed?:boolean; manualExpanded?:boolean;
  rawModelOutput?:string; rawToolCall?:unknown;
}

export interface CompactPlanItem { id:string; index:number; icon:string; text:string; status?:"pending"|"running"|"done"|"failed" }

export interface AgentRun {
  id:string; instruction:string; status:RunStatus;
  createdAt:number; startedAt?:number; endedAt?:number; elapsedMs:number;
  currentStep:number; maxSteps:number; currentActionText:string;
  compactPlan:CompactPlanItem[]; steps:AgentStep[]; rawLogs:string[];
  outputDir:string; modelName:string;
}

export interface HistoryRun { id:string; instruction:string; status:RunStatus; createdAt:string; stepCount:number; maxSteps:number; elapsedMs:number; completed:boolean }

export type ScheduleRepeat = "once"|"daily"|"weekday"|"weekly";
export interface ScheduledTaskDTO {
  id:string; enabled:boolean; instruction:string;
  targetApp:string; targetAppLabel:string;
  scheduledDate:string|null; scheduledTime:string;
  repeat:ScheduleRepeat; repeatDay?:number;
  status:"pending"|"running"|"completed"|"failed"|"cancelled";
  lastRunAt?:string; lastRunStatus?:string; lastRunError?:string;
  createdAt:string; updatedAt:string; nextRunAt:string|null;
}

export type AgentUiEvent = { type:"step_started"|"capture_started"|"capture_finished"|"ai_started"|"ai_finished"|"action_detected"|"action_started"|"action_finished"|"error"|"finished"|"raw"; step?:number; title?:string; message:string; raw:string; screenshotPath?:string; actionText?:string; error?:string };

export type AgentEvent =
  |{type:"run_started";runId:string;instruction:string;modelName:string;maxSteps:number;outputDir:string}
  |{type:"step_started";step:number}
  |{type:"output";text:string;step:number}
  |{type:"screenshot";path:string;filename:string;step:number}
  |{type:"annotated_screenshot";path:string;filename:string}
  |{type:"log";level:string;text:string;step:number}
  |{type:"run_finished";status:string;runId:string;error?:string};
