import { app, BrowserWindow, ipcMain } from "electron";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { randomUUID } from "crypto";
import { join } from "path";
import { getConfig, getDecryptedApiKey } from "./config-store";
import { isAgentRunning, startAgentProcess, type AgentFinishInfo } from "./python-runner";
import { getCurrentUserDataPathSync } from "./services/authService";

export type ScheduleRepeat = "once" | "daily" | "weekday" | "weekly";
export type ScheduledTaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface ScheduledTask {
  id: string;
  enabled: boolean;
  instruction: string;
  targetApp: string;
  targetAppLabel: string;
  scheduledDate: string | null;
  scheduledTime: string;
  repeat: ScheduleRepeat;
  repeatDay?: number;
  status: ScheduledTaskStatus;
  lastRunAt?: string;
  lastRunStatus?: string;
  lastRunError?: string;
  createdAt: string;
  updatedAt: string;
}

export type ScheduledTaskDTO = ScheduledTask & { nextRunAt: string | null };

const STORE_FILE = "scheduled-tasks.json";
const CHECK_INTERVAL_MS = 15_000;
const DEFAULT_MAX_STEPS = 50;

let tasks: ScheduledTask[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

function getStorePath() {
  const userDir = getCurrentUserDataPathSync();
  if (!userDir) return null;
  const configDir = join(userDir, "config");
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
  return join(configDir, STORE_FILE);
}

function loadStore() {
  try {
    const file = getStorePath();
    if (!file) {
      tasks = [];
      return;
    }
    if (!existsSync(file)) {
      tasks = [];
      return;
    }
    const parsed = JSON.parse(readFileSync(file, "utf-8"));
    tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
  } catch (error) {
    console.error("[scheduler] failed to load store", error);
    tasks = [];
  }
}

function saveStore() {
  const file = getStorePath();
  if (!file) return;
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify({ tasks }, null, 2), "utf-8");
  renameSync(tmp, file);
}

function sendToRenderer(channel: string, data: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function parseTime(time: string) {
  const [hh, mm] = time.split(":").map((v) => Number(v));
  return {
    hour: Number.isFinite(hh) ? hh : 9,
    minute: Number.isFinite(mm) ? mm : 0,
  };
}

function dateAtTime(base: Date, scheduledTime: string) {
  const { hour, minute } = parseTime(scheduledTime);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute, 0, 0);
}

function onceDateTime(task: ScheduledTask) {
  if (!task.scheduledDate) return null;
  const { hour, minute } = parseTime(task.scheduledTime);
  const [year, month, day] = task.scheduledDate.split("-").map((v) => Number(v));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function hasRunForSchedule(task: ScheduledTask, scheduled: Date) {
  if (!task.lastRunAt) return false;
  return new Date(task.lastRunAt).getTime() >= scheduled.getTime();
}

function isTaskDue(task: ScheduledTask, now = new Date()) {
  if (!task.enabled || task.status === "running" || task.status === "cancelled") return false;

  if (task.repeat === "once") {
    const scheduled = onceDateTime(task);
    return !!scheduled && now >= scheduled && !task.lastRunAt && task.status !== "completed";
  }

  const scheduledToday = dateAtTime(now, task.scheduledTime);
  if (now < scheduledToday || hasRunForSchedule(task, scheduledToday)) return false;

  if (task.repeat === "daily") return true;
  if (task.repeat === "weekday") {
    const dow = now.getDay();
    return dow >= 1 && dow <= 5;
  }
  if (task.repeat === "weekly") return task.repeatDay === now.getDay();
  return false;
}

function computeNextRun(task: ScheduledTask, now = new Date()): Date | null {
  if (!task.enabled || task.status === "cancelled" || task.status === "running") return null;

  if (task.repeat === "once") {
    const scheduled = onceDateTime(task);
    return scheduled && scheduled > now && !task.lastRunAt ? scheduled : null;
  }

  const today = dateAtTime(now, task.scheduledTime);
  const candidates: Date[] = [];
  for (let offset = 0; offset <= 14; offset += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    if (d <= now || hasRunForSchedule(task, d)) continue;
    const dow = d.getDay();
    if (task.repeat === "daily") candidates.push(d);
    if (task.repeat === "weekday" && dow >= 1 && dow <= 5) candidates.push(d);
    if (task.repeat === "weekly" && task.repeatDay === dow) candidates.push(d);
    if (candidates.length) break;
  }
  return candidates[0] || null;
}

function toDTO(task: ScheduledTask): ScheduledTaskDTO {
  return {
    ...task,
    nextRunAt: computeNextRun(task)?.toISOString() || null,
  };
}

function normalizeInstruction(instruction: string, targetAppLabel: string) {
  const text = instruction.trim();
  if (!targetAppLabel || targetAppLabel === "自定义") return text;
  if (text.includes(targetAppLabel)) return text;
  return `打开${targetAppLabel}，${text}`;
}

async function runTask(task: ScheduledTask) {
  if (isAgentRunning()) return;

  const apiKey = getDecryptedApiKey();
  if (!apiKey) {
    task.status = "failed";
    task.lastRunAt = new Date().toISOString();
    task.lastRunStatus = "failed";
    task.lastRunError = "API Key 未配置，请先在设置页保存 API Key。";
    task.updatedAt = new Date().toISOString();
    saveStore();
    sendToRenderer("scheduler:taskFinished", { taskId: task.id, status: "failed", error: task.lastRunError });
    return;
  }

  const config = getConfig();
  const runAt = new Date();
  const outputRoot = join(getCurrentUserDataPathSync() || app.getPath("home"), "runs", "outputs");
  if (!existsSync(outputRoot)) mkdirSync(outputRoot, { recursive: true });
  const outputDir = join(outputRoot, `scheduled_${task.id}_${runAt.getTime()}`);

  task.status = "running";
  task.lastRunAt = runAt.toISOString();
  task.lastRunError = undefined;
  task.updatedAt = runAt.toISOString();
  saveStore();
  sendToRenderer("scheduler:taskStarted", { taskId: task.id, task: toDTO(task) });

  const result = startAgentProcess({
    instruction: normalizeInstruction(task.instruction, task.targetAppLabel),
    apiKey,
    baseUrl: config.baseUrl,
    modelName: config.modelName,
    maxSteps: DEFAULT_MAX_STEPS,
    outputDir,
    taskId: task.id,
  }, handleAgentFinished);

  if (!result.ok) {
    task.status = "failed";
    task.lastRunStatus = "failed";
    task.lastRunError = result.error || "启动 Agent 失败";
    task.updatedAt = new Date().toISOString();
    saveStore();
    sendToRenderer("scheduler:taskFinished", { taskId: task.id, status: "failed", error: task.lastRunError });
  }
}

async function checkDueTasks() {
  if (isAgentRunning()) return;
  const due = tasks.find((task) => isTaskDue(task));
  if (due) await runTask(due);
}

function handleAgentFinished(info: AgentFinishInfo) {
  if (!info.taskId) return;
  const task = tasks.find((item) => item.id === info.taskId);
  if (!task) return;

  const success = info.exitCode === 0 && (info.status === "success" || info.status === "completed");
  task.lastRunStatus = success ? "completed" : "failed";
  task.lastRunError = success ? undefined : (info.error || `Agent exited with code ${info.exitCode}`);
  task.status = task.repeat === "once"
    ? (success ? "completed" : "failed")
    : "pending";
  task.updatedAt = new Date().toISOString();
  saveStore();

  sendToRenderer("scheduler:taskFinished", {
    taskId: task.id,
    status: task.lastRunStatus,
    error: task.lastRunError,
    task: toDTO(task),
  });
}

function registerSchedulerHandlers(ipc: typeof ipcMain) {
  ipc.handle("scheduler:list", () => tasks.map(toDTO));

  ipc.handle("scheduler:create", (_event, params: Partial<ScheduledTask>) => {
    const now = new Date().toISOString();
    const task: ScheduledTask = {
      id: randomUUID(),
      enabled: true,
      instruction: String(params.instruction || "").trim(),
      targetApp: String(params.targetApp || "custom"),
      targetAppLabel: String(params.targetAppLabel || "自定义"),
      scheduledDate: params.scheduledDate || null,
      scheduledTime: params.scheduledTime || "09:00",
      repeat: params.repeat || "once",
      repeatDay: params.repeatDay,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    if (!task.instruction) return { ok: false, error: "任务指令不能为空" };
    tasks.unshift(task);
    saveStore();
    checkDueTasks();
    return { ok: true, task: toDTO(task) };
  });

  ipc.handle("scheduler:update", (_event, params: { id: string; patch: Partial<ScheduledTask> }) => {
    const task = tasks.find((item) => item.id === params.id);
    if (!task) return { ok: false, error: "Task not found" };
    Object.assign(task, params.patch, { updatedAt: new Date().toISOString() });
    if (task.enabled && task.status === "cancelled") task.status = "pending";
    saveStore();
    checkDueTasks();
    return { ok: true, task: toDTO(task) };
  });

  ipc.handle("scheduler:delete", (_event, id: string) => {
    const before = tasks.length;
    tasks = tasks.filter((task) => task.id !== id);
    if (tasks.length === before) return { ok: false, error: "Task not found" };
    saveStore();
    return { ok: true };
  });

  ipc.handle("scheduler:toggle", (_event, params: { id: string; enabled: boolean }) => {
    const task = tasks.find((item) => item.id === params.id);
    if (!task) return { ok: false, error: "Task not found" };
    task.enabled = Boolean(params.enabled);
    task.status = task.enabled ? "pending" : "cancelled";
    task.updatedAt = new Date().toISOString();
    saveStore();
    if (task.enabled) checkDueTasks();
    return { ok: true, task: toDTO(task) };
  });

  ipc.handle("scheduler:runNow", async (_event, id: string) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return { ok: false, error: "Task not found" };
    if (isAgentRunning()) return { ok: false, error: "当前已有任务正在执行" };
    await runTask(task);
    return { ok: true };
  });
}

export function startScheduler() {
  loadStore();
  if (timer) clearInterval(timer);
  timer = setInterval(checkDueTasks, CHECK_INTERVAL_MS);
  checkDueTasks();
}

export function stopScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function reloadSchedulerForCurrentUser() {
  loadStore();
  checkDueTasks();
  sendToRenderer("scheduler:taskFinished", { type: "reloaded" });
}

export function initScheduler(ipc: typeof ipcMain) {
  registerSchedulerHandlers(ipc);
  startScheduler();
}
