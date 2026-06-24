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
    onStatusChanged: (cb: (d: any) => void) => () => void;
    onStopTask: (cb: () => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
