import { ipcMain } from "electron";
import { pbkdf2Sync, randomBytes, randomUUID } from "crypto";
import { join } from "path";
import {
  atomicWriteJson,
  getAuthFile,
  getUserDir,
  initializeUserFiles,
  readJsonSafe,
} from "./userDataService";

export type PlanType = "basic" | "pro";

export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  passwordHash: string;
  salt: string;
  plan: PlanType;
  proExpireAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface PublicUserProfile {
  id: string;
  email: string;
  nickname: string;
  plan: PlanType;
  proExpireAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface AuthSession {
  userId: string;
  loginAt: string;
  rememberMe: boolean;
}

type UsersStore = { users: UserProfile[] };

let currentSession: AuthSession | null = null;

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function loadUsers(): UsersStore {
  const store = readJsonSafe<UsersStore>(getAuthFile("users.json"), { users: [] });
  return { users: Array.isArray(store.users) ? store.users : [] };
}

function saveUsers(store: UsersStore) {
  atomicWriteJson(getAuthFile("users.json"), store);
}

function loadSession(): AuthSession | null {
  const data = readJsonSafe<AuthSession | null>(getAuthFile("session.json"), null);
  if (!data?.userId) return null;
  return {
    userId: String(data.userId),
    loginAt: String(data.loginAt || nowIso()),
    rememberMe: Boolean(data.rememberMe),
  };
}

function saveSession(session: AuthSession | null) {
  atomicWriteJson(getAuthFile("session.json"), session);
  currentSession = session;
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 120_000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function toPublicUser(user: UserProfile): PublicUserProfile {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    plan: user.plan,
    proExpireAt: user.proExpireAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function persistUser(user: UserProfile) {
  const store = loadUsers();
  const index = store.users.findIndex((item) => item.id === user.id);
  if (index >= 0) store.users[index] = user;
  else store.users.push(user);
  saveUsers(store);
  const userDir = getUserDir(user.id);
  initializeUserFiles(userDir);
  atomicWriteJson(join(userDir, "profile.json"), user);
}

function expireIfNeeded(user: UserProfile): UserProfile {
  if (user.plan === "pro" && user.proExpireAt && new Date(user.proExpireAt).getTime() < Date.now()) {
    const next = { ...user, plan: "basic" as PlanType, proExpireAt: null, updatedAt: nowIso() };
    persistUser(next);
    return next;
  }
  return user;
}

export function getCurrentSession(): AuthSession | null {
  if (!currentSession) currentSession = loadSession();
  return currentSession;
}

export function getCurrentUser(): PublicUserProfile | null {
  const session = getCurrentSession();
  if (!session?.userId) return null;
  const user = loadUsers().users.find((item) => item.id === session.userId);
  return user ? toPublicUser(expireIfNeeded(user)) : null;
}

export function getCurrentUserDataPathSync(): string | null {
  const session = getCurrentSession();
  if (!session?.userId) return null;
  return getUserDir(session.userId);
}

export function updateCurrentUserPlan(plan: PlanType, proExpireAt: string | null): PublicUserProfile | null {
  const session = getCurrentSession();
  if (!session?.userId) return null;
  const user = loadUsers().users.find((item) => item.id === session.userId);
  if (!user) return null;
  const next = { ...user, plan, proExpireAt, updatedAt: nowIso() };
  persistUser(next);
  return toPublicUser(next);
}

export function registerAuthHandlers(ipc: typeof ipcMain, onAuthChanged?: () => void) {
  ipc.handle("auth:getSession", () => {
    const session = getCurrentSession();
    const user = getCurrentUser();
    if (!session || !user) return { session: null, user: null };
    return { session, user };
  });

  ipc.handle("auth:getCurrentUser", () => getCurrentUser());

  ipc.handle("auth:register", (_event, payload: { email?: string; password?: string; nickname?: string; rememberMe?: boolean }) => {
      const email = normalizeEmail(payload?.email || "");
      const password = String(payload?.password || "");
      const nickname = String(payload?.nickname || "").trim();
      if (!nickname) return { ok: false, error: "Please enter a nickname." };
      if (!email) return { ok: false, error: "Please enter your email." };
      if (!password) return { ok: false, error: "Please enter your password." };
      if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

      const store = loadUsers();
      if (store.users.some((user) => normalizeEmail(user.email) === email)) {
        return { ok: false, error: "This email is already registered." };
      }

      const createdAt = nowIso();
      const { salt, hash } = hashPassword(password);
      const user: UserProfile = {
        id: randomUUID(),
        email,
        nickname,
        passwordHash: hash,
        salt,
        plan: "basic",
        proExpireAt: null,
        createdAt,
        updatedAt: createdAt,
        lastLoginAt: createdAt,
      };
      store.users.push(user);
      saveUsers(store);
      persistUser(user);
      return { ok: true, user: toPublicUser(user) };
  });

  ipc.handle("auth:login", (_event, payload: { email?: string; password?: string; rememberMe?: boolean }) => {
      const email = normalizeEmail(payload?.email || "");
      if (!email) return { ok: false, error: "Please enter your email." };

      const store = loadUsers();
      const user = store.users.find((item) => normalizeEmail(item.email) === email);
      if (!user) return { ok: false, error: "User does not exist." };

      const next = expireIfNeeded({ ...user, lastLoginAt: nowIso(), updatedAt: nowIso() });
      persistUser(next);
      saveSession({ userId: next.id, loginAt: nowIso(), rememberMe: Boolean(payload?.rememberMe) });
      onAuthChanged?.();
      return { ok: true, user: toPublicUser(next) };
  });

  ipc.handle("auth:logout", () => {
    saveSession(null);
    onAuthChanged?.();
    return { ok: true };
  });

  ipc.handle("auth:updateProfile", (_event, payload: { nickname?: string }) => {
    const session = getCurrentSession();
    if (!session?.userId) return { ok: false, error: "请先登录" };
    const user = loadUsers().users.find((item) => item.id === session.userId);
    if (!user) return { ok: false, error: "用户不存在" };
    const nickname = String(payload?.nickname || "").trim();
    if (!nickname) return { ok: false, error: "请输入昵称" };
    const next = { ...user, nickname, updatedAt: nowIso() };
    persistUser(next);
    return { ok: true, user: toPublicUser(next) };
  });

  ipc.handle("userData:getCurrentUserDataPath", () => getCurrentUserDataPathSync());
  ipc.handle("userData:switchUser", () => ({ ok: false, error: "请先退出当前账号后再切换用户" }));
}
