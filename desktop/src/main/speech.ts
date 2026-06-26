import { spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { app, ipcMain } from "electron";

function getSpeechTarget(): { command: string; argsPrefix: string[]; error?: string } {
  if (app.isPackaged) {
    const exePath = join(process.resourcesPath, "agent", process.platform === "win32" ? "speech_to_text.exe" : "speech_to_text");
    if (!existsSync(exePath)) {
      return { command: "", argsPrefix: [], error: `语音识别程序不存在：${exePath}` };
    }
    return { command: exePath, argsPrefix: [] };
  }

  const scriptPath = join(__dirname, "..", "..", "..", "speech_to_text.py");
  if (!existsSync(scriptPath)) {
    return { command: "", argsPrefix: [], error: `语音识别脚本不存在：${scriptPath}` };
  }
  return { command: process.platform === "win32" ? "python" : "python3", argsPrefix: [scriptPath] };
}

function getAudioExtension(mimeType?: string): string {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("wav")) return ".wav";
  if (mime.includes("mp4")) return ".mp4";
  if (mime.includes("ogg")) return ".ogg";
  return ".webm";
}

export function registerSpeechHandlers(ipc: typeof ipcMain) {
  ipc.handle("speech:transcribe", async (_event, payload: { audioBase64: string; mimeType?: string }) => {
    const target = getSpeechTarget();
    if (target.error) {
      return { ok: false, error: target.error };
    }

    const dir = join(tmpdir(), "desktop-agent-speech");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const audioPath = join(dir, `speech_${Date.now()}${getAudioExtension(payload.mimeType)}`);
    writeFileSync(audioPath, Buffer.from(payload.audioBase64, "base64"));

    return new Promise<{ ok: boolean; text?: string; error?: string }>((resolve) => {
      let settled = false;
      const finish = (result: { ok: boolean; text?: string; error?: string }) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const child = spawn(target.command, [...target.argsPrefix, "--audio", audioPath], {
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
        },
      });

      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf-8"); });
      child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf-8"); });
      child.on("error", (error) => finish({ ok: false, error: `语音识别程序启动失败：${error.message}` }));
      child.on("close", () => {
        const lastLine = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
        if (lastLine) {
          try {
            const parsed = JSON.parse(lastLine);
            finish(parsed);
            return;
          } catch {}
        }
        finish({ ok: false, error: stderr.trim() || "语音识别失败" });
      });
    });
  });
}
