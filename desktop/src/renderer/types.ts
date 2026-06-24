export type RunStatus =
  | "idle" | "running" | "planning" | "observing"
  | "capturing" | "thinking" | "acting" | "waiting"
  | "completed" | "failed" | "stopped";

export type PhaseStatus = "pending" | "running" | "success" | "error";

export interface RecognizedElement {
  name: string; type?: string; description?: string;
  boundingBox?: [number, number, number, number];
}

export interface PlanItemDetail {
  screenshotPath?: string; recognizedElements?: RecognizedElement[];
  modelReasoningSummary?: string; actionSummary?: string;
  durationMs?: number; rawLogIds?: string[];
}

export interface PlanItem {
  id: string; index: number; title: string; description?: string;
  status: "pending" | "running" | "done" | "failed";
  details?: PlanItemDetail;
}

export interface AgentStep {
  id: string; step: number; status: RunStatus;
  title: string; userMessage: string;
  startedAt: string; endedAt?: string; durationMs?: number;
  captureStatus: PhaseStatus; modelStatus: PhaseStatus; actionStatus: PhaseStatus;
  screenshotPath?: string; annotatedPath?: string;
  recognizedElements?: RecognizedElement[];
  actionType?: string; actionSummary?: string;
  rawModelOutput?: string; rawToolCall?: unknown; rawLogs?: string[];
  error?: string;
}

export interface HistoryRun {
  id: string; instruction: string; status: RunStatus;
  createdAt: string; stepCount: number; maxSteps: number; elapsedMs: number;
  completed: boolean;
}

export interface ActiveRun {
  id: string; instruction: string; status: RunStatus;
  createdAt: string; startedAt?: string; endedAt?: string;
  elapsedMs: number; currentStep: number; maxSteps: number;
  currentActionText: string; summary?: string;
  planItems: PlanItem[]; steps: AgentStep[]; rawLogs: string[];
  outputDir: string; modelName: string;
}

export type AgentEvent =
  | { type: "run_started"; runId: string; instruction: string; modelName: string; maxSteps: number; outputDir: string }
  | { type: "step_started"; step: number }
  | { type: "output"; text: string; step: number }
  | { type: "screenshot"; path: string; filename: string; step: number }
  | { type: "annotated_screenshot"; path: string; filename: string }
  | { type: "log"; level: string; text: string; step: number }
  | { type: "run_finished"; status: string; runId: string; error?: string };
