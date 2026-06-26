import { safeStorage, ipcMain, app } from "electron";
import { readFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import { getCurrentUserDataPathSync } from "./services/authService";

export interface StoredConfig {
  baseUrl: string;
  modelName: string;
  maxRetry: number;
  timeout: number;
  /** Encrypted API key (base64), or empty string */
  encryptedKey: string;
}

const DEFAULTS: StoredConfig = {
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  modelName: "qwen3-vl-plus",
  maxRetry: 10,
  timeout: 30,
  encryptedKey: "",
};

function getConfigPath(): string {
  const currentUserDir = getCurrentUserDataPathSync();
  if (currentUserDir) {
    const configDir = join(currentUserDir, "config");
    if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
    return join(configDir, "agent-config.json");
  }
  const userData = app.getPath("userData");
  if (!existsSync(userData)) mkdirSync(userData, { recursive: true });
  return join(userData, "agent-config.json");
}

function loadConfig(): StoredConfig {
  const p = getConfigPath();
  try {
    if (existsSync(p)) {
      const raw = readFileSync(p, "utf-8");
      return { ...DEFAULTS, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULTS };
}

export function getConfig(): StoredConfig {
  return loadConfig();
}

export function getDecryptedApiKey(): string | null {
  const cfg = loadConfig();
  const enc = cfg.encryptedKey;
  if (!enc || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(enc, "base64"));
  } catch {
    return null;
  }
}

function saveConfig(cfg: StoredConfig): void {
  const file = getConfigPath();
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(cfg, null, 2), "utf-8");
  renameSync(tmp, file);
}

function maskKey(key: string): string {
  if (key.length <= 8) return "***";
  return key.slice(0, 3) + "****" + key.slice(-4);
}

export function registerConfigHandlers(ipc: typeof ipcMain) {
  // --- Get config (NEVER returns plaintext key) --------------------------
  ipc.handle("config:get", () => {
    const cfg = loadConfig();
    const hasKey = cfg.encryptedKey.length > 0;
    let masked = "";
    if (hasKey && safeStorage.isEncryptionAvailable()) {
      try {
        const decrypted = safeStorage.decryptString(
          Buffer.from(cfg.encryptedKey, "base64"),
        );
        masked = maskKey(decrypted);
      } catch {
        masked = "***";
      }
    }
    return {
      baseUrl: cfg.baseUrl,
      modelName: cfg.modelName,
      maxRetry: cfg.maxRetry,
      timeout: cfg.timeout,
      hasApiKey: hasKey,
      maskedKey: masked,
    };
  });

  // --- Save config -------------------------------------------------------
  ipc.handle("config:save", (_event, params: {
    baseUrl: string;
    modelName: string;
    maxRetry: number;
    timeout: number;
    apiKey?: string;
  }) => {
    const cfg = loadConfig();
    cfg.baseUrl = params.baseUrl;
    cfg.modelName = params.modelName;
    cfg.maxRetry = params.maxRetry;
    cfg.timeout = params.timeout;

    if (params.apiKey) {
      if (safeStorage.isEncryptionAvailable()) {
        const enc = safeStorage.encryptString(params.apiKey);
        cfg.encryptedKey = enc.toString("base64");
      } else {
        return { ok: false, error: "Encryption not available. API key not saved." };
      }
    }
    saveConfig(cfg);
    return { ok: true };
  });

  // --- Get decrypted key (only for spawning Python) ----------------------
  ipc.handle("config:getApiKey", () => {
    const cfg = loadConfig();
    const enc = cfg.encryptedKey;
    if (!enc || !safeStorage.isEncryptionAvailable()) return null;
    try {
      return safeStorage.decryptString(Buffer.from(enc, "base64"));
    } catch {
      return null;
    }
  });

  // --- Clear stored key --------------------------------------------------
  ipc.handle("config:clearKey", () => {
    const cfg = loadConfig();
    cfg.encryptedKey = "";
    saveConfig(cfg);
    return { ok: true };
  });

  // --- Test connection ---------------------------------------------------
  ipc.handle("config:testConnection", async (_event, params: {
    apiKey: string;
    baseUrl: string;
    modelName: string;
  }) => {
    try {
      const resp = await fetch(`${params.baseUrl}/models`, {
        method: "GET",
        headers: { Authorization: `Bearer ${params.apiKey}` },
      });
      if (resp.ok) {
        return { ok: true };
      }
      const body = await resp.text().catch(() => "");
      return { ok: false, error: `HTTP ${resp.status}: ${body.slice(0, 200)}` };
    } catch (e: any) {
      let msg = e.message || String(e);
      if (params.apiKey && msg.includes(params.apiKey)) {
        msg = msg.replaceAll(params.apiKey, "sk-***");
      }
      return { ok: false, error: msg };
    }
  });
}
