import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export function getUserDataRoot(): string {
  const root = join(app.getPath("userData"), "user_data");
  ensureDir(root);
  ensureDir(join(root, "auth"));
  ensureDir(join(root, "users"));
  return root;
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function atomicWriteJson(filePath: string, data: unknown): void {
  ensureDir(dirname(filePath));
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  renameSync(tmp, filePath);
}

export function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (!existsSync(filePath)) {
      atomicWriteJson(filePath, fallback);
      return fallback;
    }
    const raw = readFileSync(filePath, "utf-8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    try {
      if (existsSync(filePath)) {
        renameSync(filePath, `${filePath}.broken.${Date.now()}.bak`);
      }
    } catch {}
    atomicWriteJson(filePath, fallback);
    return fallback;
  }
}

export function sanitizeId(value: string): string {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function getUserDir(userId: string): string {
  const dir = join(getUserDataRoot(), "users", sanitizeId(userId));
  ensureUserDirectories(dir);
  return dir;
}

export function ensureUserDirectories(userDir: string): void {
  ensureDir(userDir);
  ensureDir(join(userDir, "history"));
  ensureDir(join(userDir, "history", "runs"));
  ensureDir(join(userDir, "runs"));
  ensureDir(join(userDir, "runs", "outputs"));
  ensureDir(join(userDir, "config"));
  ensureDir(join(userDir, "payment"));
}

export function initializeUserFiles(userDir: string): void {
  ensureUserDirectories(userDir);
  const settingsPath = join(userDir, "settings.json");
  const ordersPath = join(userDir, "payment", "orders.json");
  const historyIndexPath = join(userDir, "history", "index.json");
  if (!existsSync(settingsPath)) atomicWriteJson(settingsPath, {});
  if (!existsSync(ordersPath)) atomicWriteJson(ordersPath, { orders: [] });
  if (!existsSync(historyIndexPath)) atomicWriteJson(historyIndexPath, []);
}

export function getAuthFile(name: "users.json" | "session.json"): string {
  return join(getUserDataRoot(), "auth", name);
}
