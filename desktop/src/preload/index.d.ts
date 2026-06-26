export interface ApiConfig {
  baseUrl: string;
  modelName: string;
  maxRetry: number;
  timeout: number;
  hasApiKey: boolean;
  maskedKey: string;
}

export interface AgentStartParams {
  instruction: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  maxSteps: number;
  outputDir: string;
}
export type ScheduleRepeat = "once" | "daily" | "weekday" | "weekly";
export interface ScheduledTaskDTO {
  id: string;
  enabled: boolean;
  instruction: string;
  targetApp: string;
  targetAppLabel: string;
  scheduledDate: string | null;
  scheduledTime: string;
  repeat: ScheduleRepeat;
  repeatDay?: number;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  lastRunAt?: string;
  lastRunStatus?: string;
  lastRunError?: string;
  createdAt: string;
  updatedAt: string;
  nextRunAt: string | null;
}

export type PlanType = "basic" | "pro";
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
export type PaymentPlan = "pro_monthly" | "pro_yearly";
export type PaymentChannel = "wechat" | "alipay";
export type PaymentStatus = "pending" | "paid_pending_review" | "activated" | "cancelled";
export interface PaymentOrder {
  id: string;
  userId: string;
  plan: PaymentPlan;
  amount: number;
  channel: PaymentChannel;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FloatingUpdate {
  status: string;
  currentStep?: number;
  maxSteps?: number;
  actionText?: string;
  elapsedMs?: number;
  instruction?: string;
  currentPhase?: string;
  progressPercent?: number;
}

export interface ElectronAPI {
  auth: {
    register: (payload: {
      nickname: string;
      email: string;
      password: string;
      rememberMe?: boolean;
    }) => Promise<{ ok: boolean; user?: PublicUserProfile; error?: string }>;
    login: (payload: {
      email: string;
      password: string;
      rememberMe?: boolean;
    }) => Promise<{ ok: boolean; user?: PublicUserProfile; error?: string }>;
    logout: () => Promise<{ ok: boolean; error?: string }>;
    getCurrentUser: () => Promise<PublicUserProfile | null>;
    getSession: () => Promise<{ session: AuthSession | null; user: PublicUserProfile | null }>;
    updateProfile: (payload: { nickname: string }) => Promise<{ ok: boolean; user?: PublicUserProfile; error?: string }>;
    onChanged: (cb: () => void) => () => void;
  };
  payment: {
    createOrder: (payload: { plan: PaymentPlan; channel: PaymentChannel }) => Promise<{ ok: boolean; order?: PaymentOrder; error?: string }>;
    markPaid: (orderId: string) => Promise<{ ok: boolean; order?: PaymentOrder; error?: string }>;
    cancelOrder: (orderId: string) => Promise<{ ok: boolean; order?: PaymentOrder; error?: string }>;
    activateProDev: (orderId: string) => Promise<{ ok: boolean; order?: PaymentOrder; user?: PublicUserProfile; error?: string }>;
    getOrders: () => Promise<PaymentOrder[]>;
  };
  userData: {
    getCurrentUserDataPath: () => Promise<string | null>;
    switchUser: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  };
  config: {
    get: () => Promise<ApiConfig>;
    save: (cfg: {
      baseUrl: string;
      modelName: string;
      maxRetry: number;
      timeout: number;
      apiKey?: string;
    }) => Promise<{ ok: boolean; error?: string }>;
    getApiKey: () => Promise<string | null>;
    testConnection: (params: {
      apiKey: string;
      baseUrl: string;
      modelName: string;
    }) => Promise<{ ok: boolean; error?: string }>;
    clearKey: () => Promise<{ ok: boolean }>;
  };
  agent: {
    start: (params: AgentStartParams) => Promise<{ ok: boolean; error?: string }>;
    stop: () => Promise<{ ok: boolean; error?: string }>;
    undo: () => Promise<{ ok: boolean; error?: string }>;
    redo: () => Promise<{ ok: boolean; error?: string }>;
    rerunLastStep: () => Promise<{ ok: boolean; error?: string }>;
    openOutputFolder: (outputDir: string) => Promise<void>;
    getDefaultOutputDir: () => Promise<string>;
    onEvent: (cb: (evt: any) => void) => () => void;
    onStdout: (cb: (data: { text: string }) => void) => () => void;
    onStderr: (cb: (data: { text: string }) => void) => () => void;
    onFinished: (cb: (data: { exitCode: number | null }) => void) => () => void;
    onError: (cb: (data: { message: string }) => void) => () => void;
    getHistory: () => Promise<any[]>;
    saveHistory: (run: any) => Promise<void>;
    saveFullRun: (run: any) => Promise<void>;
    loadFullRun: (id: string) => Promise<any>;
    clearHistory: () => Promise<void>;
    deleteHistory: (id: string) => Promise<boolean>;
    repairHistory: () => Promise<any[]>;
  };
  floating: {
    show: () => Promise<void>;
    hide: () => Promise<void>;
    update: (d: FloatingUpdate) => Promise<void>;
    showMainWindow: () => Promise<void>;
    setInteractive: (interactive: boolean) => Promise<void>;
    dragStart: (point: {
      screenX: number;
      screenY: number;
      orbLeft?: number;
      orbTop?: number;
      orbWidth?: number;
      orbHeight?: number;
    }) => Promise<void>;
    dragMove: (point: {
      screenX: number;
      screenY: number;
      orbLeft?: number;
      orbTop?: number;
      orbWidth?: number;
      orbHeight?: number;
    }) => Promise<void>;
    dragEnd: () => Promise<void>;
    onStatusChanged: (cb: (d: any) => void) => () => void;
    onStopTask: (cb: () => void) => () => void;
  };
  scheduler: {
    list: () => Promise<ScheduledTaskDTO[]>;
    create: (params: Partial<ScheduledTaskDTO>) => Promise<{ ok: boolean; task?: ScheduledTaskDTO; error?: string }>;
    update: (id: string, patch: Partial<ScheduledTaskDTO>) => Promise<{ ok: boolean; task?: ScheduledTaskDTO; error?: string }>;
    delete: (id: string) => Promise<{ ok: boolean; error?: string }>;
    toggle: (id: string, enabled: boolean) => Promise<{ ok: boolean; task?: ScheduledTaskDTO; error?: string }>;
    runNow: (id: string) => Promise<{ ok: boolean; error?: string }>;
    onTaskStarted: (cb: (d: any) => void) => () => void;
    onTaskFinished: (cb: (d: any) => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
