import { contextBridge, ipcRenderer } from "electron";

export interface ApiConfig {
  baseUrl: string; modelName: string; maxRetry: number; timeout: number;
  hasApiKey: boolean; maskedKey: string;
}
export interface AgentStartParams {
  instruction: string; apiKey: string; baseUrl: string; modelName: string;
  maxSteps: number; outputDir: string;
}
export type ScheduleRepeat = "once" | "daily" | "weekday" | "weekly";
export interface ScheduledTaskDTO {
  id: string; enabled: boolean; instruction: string;
  targetApp: string; targetAppLabel: string;
  scheduledDate: string | null; scheduledTime: string;
  repeat: ScheduleRepeat; repeatDay?: number;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  lastRunAt?: string; lastRunStatus?: string; lastRunError?: string;
  createdAt: string; updatedAt: string; nextRunAt: string | null;
}
export type PlanType = "basic" | "pro";
export interface PublicUserProfile {
  id: string; email: string; nickname: string;
  plan: PlanType; proExpireAt?: string | null;
  createdAt: string; updatedAt: string; lastLoginAt?: string;
}
export interface AuthSession {
  userId: string; loginAt: string; rememberMe: boolean;
}
export type PaymentPlan = "pro_monthly" | "pro_yearly";
export type PaymentChannel = "wechat" | "alipay";
export type PaymentStatus = "pending" | "paid_pending_review" | "activated" | "cancelled";
export interface PaymentOrder {
  id: string; userId: string; plan: PaymentPlan; amount: number;
  channel: PaymentChannel; status: PaymentStatus; createdAt: string; updatedAt: string;
}

const electronAPI = {
  auth: {
    register: (payload: { nickname: string; email: string; password: string; rememberMe?: boolean }): Promise<{ ok: boolean; user?: PublicUserProfile; error?: string }> => ipcRenderer.invoke("auth:register", payload),
    login: (payload: { email: string; password: string; rememberMe?: boolean }): Promise<{ ok: boolean; user?: PublicUserProfile; error?: string }> => ipcRenderer.invoke("auth:login", payload),
    logout: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("auth:logout"),
    getCurrentUser: (): Promise<PublicUserProfile | null> => ipcRenderer.invoke("auth:getCurrentUser"),
    getSession: (): Promise<{ session: AuthSession | null; user: PublicUserProfile | null }> => ipcRenderer.invoke("auth:getSession"),
    updateProfile: (payload: { nickname: string }): Promise<{ ok: boolean; user?: PublicUserProfile; error?: string }> => ipcRenderer.invoke("auth:updateProfile", payload),
    onChanged: (cb: () => void) => { const h = () => cb(); ipcRenderer.on("auth:changed", h); return () => ipcRenderer.removeListener("auth:changed", h); },
  },
  payment: {
    createOrder: (payload: { plan: PaymentPlan; channel: PaymentChannel }): Promise<{ ok: boolean; order?: PaymentOrder; error?: string }> => ipcRenderer.invoke("payment:createOrder", payload),
    markPaid: (orderId: string): Promise<{ ok: boolean; order?: PaymentOrder; error?: string }> => ipcRenderer.invoke("payment:markPaid", orderId),
    cancelOrder: (orderId: string): Promise<{ ok: boolean; order?: PaymentOrder; error?: string }> => ipcRenderer.invoke("payment:cancelOrder", orderId),
    activateProDev: (orderId: string): Promise<{ ok: boolean; order?: PaymentOrder; user?: PublicUserProfile; error?: string }> => ipcRenderer.invoke("payment:activateProDev", orderId),
    getOrders: (): Promise<PaymentOrder[]> => ipcRenderer.invoke("payment:getOrders"),
  },
  userData: {
    getCurrentUserDataPath: (): Promise<string | null> => ipcRenderer.invoke("userData:getCurrentUserDataPath"),
    switchUser: (userId: string): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("userData:switchUser", userId),
  },
  config: {
    get: (): Promise<ApiConfig> => ipcRenderer.invoke("config:get"),
    save: (cfg: { baseUrl: string; modelName: string; maxRetry: number; timeout: number; apiKey?: string }): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("config:save", cfg),
    getApiKey: (): Promise<string | null> => ipcRenderer.invoke("config:getApiKey"),
    testConnection: (p: { apiKey: string; baseUrl: string; modelName: string }): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("config:testConnection", p),
    clearKey: (): Promise<{ ok: boolean }> => ipcRenderer.invoke("config:clearKey"),
  },
  agent: {
    start: (p: AgentStartParams): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("agent:start", p),
    stop: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("agent:stop"),
    undo: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("agent:undo"),
    redo: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("agent:redo"),
    rerunLastStep: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("agent:rerunLastStep"),
    openOutputFolder: (d: string): Promise<void> => ipcRenderer.invoke("agent:openOutputFolder", d),
    getDefaultOutputDir: (): Promise<string> => ipcRenderer.invoke("agent:getDefaultOutputDir"),
    onEvent: (cb: (evt: any) => void) => { const h = (_: any, d: any) => cb(d); ipcRenderer.on("agent:event", h); return () => ipcRenderer.removeListener("agent:event", h); },
    onStdout: (cb: (d: { text: string }) => void) => { const h = (_: any, d: any) => cb(d); ipcRenderer.on("agent:stdout", h); return () => ipcRenderer.removeListener("agent:stdout", h); },
    onStderr: (cb: (d: { text: string }) => void) => { const h = (_: any, d: any) => cb(d); ipcRenderer.on("agent:stderr", h); return () => ipcRenderer.removeListener("agent:stderr", h); },
    onFinished: (cb: (d: { exitCode: number | null }) => void) => { const h = (_: any, d: any) => cb(d); ipcRenderer.on("agent:finished", h); return () => ipcRenderer.removeListener("agent:finished", h); },
    onError: (cb: (d: { message: string }) => void) => { const h = (_: any, d: any) => cb(d); ipcRenderer.on("agent:error", h); return () => ipcRenderer.removeListener("agent:error", h); },
    getHistory: (): Promise<any[]> => ipcRenderer.invoke("history:list"),
    saveHistory: (run: any): Promise<void> => { ipcRenderer.invoke("history:create", run); },
    saveFullRun: (run: any): Promise<void> => { ipcRenderer.invoke("history:update", { id: run.id, patch: run }); },
    loadFullRun: (id: string): Promise<any> => ipcRenderer.invoke("history:get", id),
    clearHistory: (): Promise<void> => { ipcRenderer.invoke("history:clear"); },
    deleteHistory: (id: string): Promise<boolean> => ipcRenderer.invoke("history:delete", id),
    repairHistory: (): Promise<any[]> => ipcRenderer.invoke("history:repair"),
  },
  floating: {
    show: (): Promise<void> => ipcRenderer.invoke("floating:show"),
    hide: (): Promise<void> => ipcRenderer.invoke("floating:hide"),
    update: (d: { status: string; currentStep?: number; maxSteps?: number; actionText?: string; elapsedMs?: number; instruction?: string; currentPhase?: string; progressPercent?: number }): Promise<void> => ipcRenderer.invoke("floating:update", d),
    showMainWindow: (): Promise<void> => ipcRenderer.invoke("floating:showMainWindow"),
    setInteractive: (interactive: boolean): Promise<void> => ipcRenderer.invoke("floating:setInteractive", interactive),
    dragStart: (point: { screenX: number; screenY: number; orbLeft?: number; orbTop?: number; orbWidth?: number; orbHeight?: number }): Promise<void> => ipcRenderer.invoke("floating:dragStart", point),
    dragMove: (point: { screenX: number; screenY: number; orbLeft?: number; orbTop?: number; orbWidth?: number; orbHeight?: number }): Promise<void> => ipcRenderer.invoke("floating:dragMove", point),
    dragEnd: (): Promise<void> => ipcRenderer.invoke("floating:dragEnd"),
    onStatusChanged: (cb: (d: any) => void) => { const h = (_: any, d: any) => cb(d); ipcRenderer.on("floating:statusChanged", h); return () => ipcRenderer.removeListener("floating:statusChanged", h); },
    onStopTask: (cb: () => void) => { const h = () => cb(); ipcRenderer.on("floating:stopTask", h); return () => ipcRenderer.removeListener("floating:stopTask", h); },
  },
  scheduler: {
    list: (): Promise<ScheduledTaskDTO[]> => ipcRenderer.invoke("scheduler:list"),
    create: (params: Partial<ScheduledTaskDTO>): Promise<{ ok: boolean; task?: ScheduledTaskDTO; error?: string }> => ipcRenderer.invoke("scheduler:create", params),
    update: (id: string, patch: Partial<ScheduledTaskDTO>): Promise<{ ok: boolean; task?: ScheduledTaskDTO; error?: string }> => ipcRenderer.invoke("scheduler:update", { id, patch }),
    delete: (id: string): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("scheduler:delete", id),
    toggle: (id: string, enabled: boolean): Promise<{ ok: boolean; task?: ScheduledTaskDTO; error?: string }> => ipcRenderer.invoke("scheduler:toggle", { id, enabled }),
    runNow: (id: string): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("scheduler:runNow", id),
    onTaskStarted: (cb: (d: any) => void) => { const h = (_: any, d: any) => cb(d); ipcRenderer.on("scheduler:taskStarted", h); return () => ipcRenderer.removeListener("scheduler:taskStarted", h); },
    onTaskFinished: (cb: (d: any) => void) => { const h = (_: any, d: any) => cb(d); ipcRenderer.on("scheduler:taskFinished", h); return () => ipcRenderer.removeListener("scheduler:taskFinished", h); },
  },
  speech: {
    transcribe: (payload: { audioBase64: string; mimeType?: string }): Promise<{ ok: boolean; text?: string; error?: string }> => ipcRenderer.invoke("speech:transcribe", payload),
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
export type ElectronAPI = typeof electronAPI;
