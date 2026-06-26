import { ChildProcess, execFile, spawn } from "child_process";
import { ipcMain, BrowserWindow, shell, app } from "electron";
import { join } from "path";
import { homedir } from "os";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { getCurrentUserDataPathSync } from "./services/authService";

let currentProcess: ChildProcess | null = null;
let currentTaskId: string | null = null;
let currentFinalStatus: string | null = null;
let currentFinalError: string | null = null;
let currentStopRequested = false;
let currentOutputDir: string | null = null;

function getBridgePath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "agent", process.platform === "win32" ? "agent_bridge.exe" : "agent_bridge");
  }
  return join(__dirname, "..", "..", "..", "agent_bridge.py");
}

function getPythonCommand(): string {
  return process.platform === "win32" ? "python" : "python3";
}

function buildAgentCommand(params: AgentProcessParams): { command: string; args: string[]; error?: string } {
  const bridgePath = getBridgePath();
  if (!existsSync(bridgePath)) {
    return {
      command: "",
      args: [],
      error: app.isPackaged
        ? `Packaged agent executable not found: ${bridgePath}`
        : `Agent bridge script not found: ${bridgePath}`,
    };
  }

  const runtimeArgs = [
    "--instruction", params.instruction,
    "--base-url", params.baseUrl,
    "--model-name", params.modelName,
    "--max-steps", String(params.maxSteps),
    "--output-dir", params.outputDir,
  ];

  if (app.isPackaged) {
    return { command: bridgePath, args: runtimeArgs };
  }

  return { command: getPythonCommand(), args: [bridgePath, ...runtimeArgs] };
}

function sendToRenderer(evt: string, data: unknown) {
  const wins = BrowserWindow.getAllWindows();
  for (const w of wins) {
    if (!w.isDestroyed() && !w.webContents.isDestroyed()) {
      w.webContents.send(evt, data);
    }
  }
}

export interface AgentProcessParams {
  instruction: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  maxSteps: number;
  outputDir: string;
  taskId?: string;
}

export interface AgentFinishInfo {
  exitCode: number | null;
  taskId?: string;
  status?: string;
  error?: string;
}

export function isAgentRunning(): boolean {
  return currentProcess !== null && currentProcess.exitCode === null;
}

function isAgentScreenshotFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.endsWith(".png");
}

function cleanupRunScreenshots(outputDir: string | null) {
  if (!outputDir || !existsSync(outputDir)) return;
  try {
    for (const filename of readdirSync(outputDir)) {
      if (!isAgentScreenshotFile(filename)) continue;
      const filePath = join(outputDir, filename);
      try {
        if (statSync(filePath).isFile()) unlinkSync(filePath);
      } catch {}
    }
  } catch (error) {
    console.warn("[agent] failed to clean screenshots", error);
  }
}

export function getCurrentTaskId(): string | null {
  return currentTaskId;
}

function killProcessTree(proc: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!proc.pid || proc.exitCode !== null) {
      resolve();
      return;
    }

    if (process.platform === "win32") {
      execFile("taskkill", ["/pid", String(proc.pid), "/t", "/f"], { windowsHide: true }, () => resolve());
      return;
    }

    try {
      proc.kill("SIGTERM");
    } catch {}
    setTimeout(() => {
      try {
        if (proc.exitCode === null) proc.kill("SIGKILL");
      } catch {}
      resolve();
    }, 800);
  });
}

export async function stopAgentProcess(reason = "任务已停止"): Promise<{ ok: boolean; error?: string }> {
  const proc = currentProcess;
  if (!proc || proc.exitCode !== null) {
    return { ok: false, error: "No agent run in progress." };
  }

  currentStopRequested = true;
  currentFinalStatus = "stopped";
  currentFinalError = reason;

  try {
    await killProcessTree(proc);
  } catch (e: any) {
    try {
      proc.kill("SIGKILL");
    } catch {}
    return { ok: false, error: e?.message || String(e) };
  }

  return { ok: true };
}

export function startAgentProcess(
  params: AgentProcessParams,
  onFinish?: (info: AgentFinishInfo) => void,
): { ok: boolean; error?: string } {
  if (isAgentRunning()) {
    return { ok: false, error: "An agent run is already in progress." };
  }

  currentTaskId = params.taskId || null;
  currentFinalStatus = null;
  currentFinalError = null;
  currentStopRequested = false;
  currentOutputDir = params.outputDir;

  const agentCommand = buildAgentCommand(params);
  if (agentCommand.error) {
    return { ok: false, error: agentCommand.error };
  }

  const env = {
    ...process.env,
    AGENT_API_KEY: params.apiKey,
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
  };

  currentProcess = spawn(agentCommand.command, agentCommand.args, {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env,
  });

  currentProcess.stdout?.on("data", (chunk: Buffer) => {
    if (currentStopRequested) return;
    const text = chunk.toString("utf-8");
    const lines = text.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj?.type === "run_finished") {
          currentFinalStatus = obj.status || null;
          currentFinalError = obj.error || obj.message || null;
        }
        sendToRenderer("agent:event", currentTaskId ? { ...obj, taskId: currentTaskId } : obj);
      } catch {
        sendToRenderer("agent:stdout", { text: line, taskId: currentTaskId });
      }
    }
  });

  currentProcess.stderr?.on("data", (chunk: Buffer) => {
    if (currentStopRequested) return;
    sendToRenderer("agent:stderr", { text: chunk.toString("utf-8"), taskId: currentTaskId });
  });

  currentProcess.on("close", (code) => {
    const info: AgentFinishInfo = {
      exitCode: code,
      taskId: currentTaskId || undefined,
      status: currentStopRequested ? "stopped" : (currentFinalStatus || (code === 0 ? "success" : "failed")),
      error: currentFinalError || undefined,
    };
    sendToRenderer("agent:finished", info);
    onFinish?.(info);
    cleanupRunScreenshots(currentOutputDir);
    currentProcess = null;
    currentTaskId = null;
    currentFinalStatus = null;
    currentFinalError = null;
    currentStopRequested = false;
    currentOutputDir = null;
  });

  currentProcess.on("error", (err) => {
    const info: AgentFinishInfo = {
      exitCode: 1,
      taskId: currentTaskId || undefined,
      status: currentStopRequested ? "stopped" : "failed",
      error: err.message,
    };
    if (!currentStopRequested) sendToRenderer("agent:error", { message: err.message, taskId: currentTaskId });
    onFinish?.(info);
    cleanupRunScreenshots(currentOutputDir);
    currentProcess = null;
    currentTaskId = null;
    currentFinalStatus = null;
    currentFinalError = null;
    currentStopRequested = false;
    currentOutputDir = null;
  });

  return { ok: true };
}

export function registerPythonHandlers(ipc: typeof ipcMain) {
  ipc.handle("agent:start", async (_event, params: {
    instruction: string;
    apiKey: string;
    baseUrl: string;
    modelName: string;
    maxSteps: number;
    outputDir: string;
  }) => {
    return startAgentProcess(params);
  });

  ipc.handle("agent:stop", async () => {
    return stopAgentProcess();
  });

  ipc.handle("agent:openOutputFolder", async (_event, outputDir: string) => {
    shell.openPath(outputDir);
  });

  ipc.handle("agent:getDefaultOutputDir", async () => {
    const currentUserDir = getCurrentUserDataPathSync();
    if (currentUserDir) {
      const outputDir = join(currentUserDir, "runs", "outputs");
      if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
      return outputDir;
    }
    const home = homedir();
    const desktop = join(home, "Desktop", "anno");
    if (!existsSync(desktop)) {
      mkdirSync(desktop, { recursive: true });
    }
    return desktop;
  });

  // Undo / Redo stubs — reserved for future core agent support
  ipc.handle("agent:undo", async () => {
    return { ok: false, error: "Core agent does not yet support undo" };
  });
  ipc.handle("agent:redo", async () => {
    return { ok: false, error: "Core agent does not yet support redo" };
  });
  ipc.handle("agent:rerunLastStep", async () => {
    return { ok: false, error: "Core agent does not yet support step rerun" };
  });
}
