import { ChildProcess, spawn } from "child_process";
import { ipcMain, BrowserWindow, shell, app } from "electron";
import { join } from "path";
import { homedir } from "os";
import { existsSync, mkdirSync } from "fs";

let currentProcess: ChildProcess | null = null;
let currentTaskId: string | null = null;
let currentFinalStatus: string | null = null;
let currentFinalError: string | null = null;

function getBridgePath(): string {
  // agent_bridge.py is one directory above the desktop/ folder
  return join(__dirname, "..", "..", "..", "agent_bridge.py");
}

function getPythonCommand(): string {
  return process.platform === "win32" ? "python" : "python3";
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

export function getCurrentTaskId(): string | null {
  return currentTaskId;
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

  const bridgePath = getBridgePath();
  const python = getPythonCommand();

  const args = [
    bridgePath,
    "--instruction", params.instruction,
    "--base-url", params.baseUrl,
    "--model-name", params.modelName,
    "--max-steps", String(params.maxSteps),
    "--output-dir", params.outputDir,
  ];

  const env = {
    ...process.env,
    AGENT_API_KEY: params.apiKey,
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
  };

  currentProcess = spawn(python, args, {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env,
  });

  currentProcess.stdout?.on("data", (chunk: Buffer) => {
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
    sendToRenderer("agent:stderr", { text: chunk.toString("utf-8"), taskId: currentTaskId });
  });

  currentProcess.on("close", (code) => {
    const info: AgentFinishInfo = {
      exitCode: code,
      taskId: currentTaskId || undefined,
      status: currentFinalStatus || (code === 0 ? "success" : "failed"),
      error: currentFinalError || undefined,
    };
    sendToRenderer("agent:finished", info);
    onFinish?.(info);
    currentProcess = null;
    currentTaskId = null;
    currentFinalStatus = null;
    currentFinalError = null;
  });

  currentProcess.on("error", (err) => {
    const info: AgentFinishInfo = {
      exitCode: 1,
      taskId: currentTaskId || undefined,
      status: "failed",
      error: err.message,
    };
    sendToRenderer("agent:error", { message: err.message, taskId: currentTaskId });
    onFinish?.(info);
    currentProcess = null;
    currentTaskId = null;
    currentFinalStatus = null;
    currentFinalError = null;
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
    if (!currentProcess || currentProcess.exitCode !== null) {
      return { ok: false, error: "No agent run in progress." };
    }
    try {
      currentProcess.kill("SIGTERM");
      setTimeout(() => {
        if (currentProcess && currentProcess.exitCode === null) {
          currentProcess.kill("SIGKILL");
        }
      }, 2000);
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
    return { ok: true };
  });

  ipc.handle("agent:openOutputFolder", async (_event, outputDir: string) => {
    shell.openPath(outputDir);
  });

  ipc.handle("agent:getDefaultOutputDir", async () => {
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
