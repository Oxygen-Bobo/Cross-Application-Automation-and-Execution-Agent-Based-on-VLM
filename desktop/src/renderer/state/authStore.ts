import { createSignal } from "solid-js";
import type { PublicUserProfile } from "../../preload/index";

export const [currentUser, setCurrentUser] = createSignal<PublicUserProfile | null>(null);

const CURRENT_USER_KEY = "desktop-agent.current-user";
const LOCAL_USERS_KEY = "desktop-agent.local-users";

export function createLocalUser(email: string, nickname?: string): PublicUserProfile {
  const cleanEmail = email.trim().toLowerCase();
  const now = new Date().toISOString();
  return {
    id: cleanEmail.replace(/[^a-z0-9_-]/g, "_") || "local_user",
    email: cleanEmail,
    nickname: nickname?.trim() || cleanEmail.split("@")[0] || "Agent User",
    plan: "basic",
    proExpireAt: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };
}

export function loadStoredUser(): PublicUserProfile | null {
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function persistCurrentUser(user: PublicUserProfile) {
  setCurrentUser(user);
  try {
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    saveRegisteredUser(user);
  } catch {}
}

export function clearCurrentUser() {
  setCurrentUser(null);
  try {
    window.localStorage.removeItem(CURRENT_USER_KEY);
  } catch {}
}

export function loadRegisteredUsers(): PublicUserProfile[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_USERS_KEY);
    const users = raw ? JSON.parse(raw) : [];
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

export function findRegisteredUser(email: string): PublicUserProfile | null {
  const cleanEmail = email.trim().toLowerCase();
  return loadRegisteredUsers().find((user) => user.email.toLowerCase() === cleanEmail) || null;
}

export function saveRegisteredUser(user: PublicUserProfile) {
  try {
    const users = loadRegisteredUsers();
    const next = [
      user,
      ...users.filter((item) => item.email.toLowerCase() !== user.email.toLowerCase()),
    ];
    window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(next));
  } catch {}
}
