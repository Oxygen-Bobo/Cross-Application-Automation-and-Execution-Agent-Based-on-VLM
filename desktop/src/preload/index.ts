import { contextBridge, ipcRenderer } from "electron";

export interface ApiConfig {
  baseUrl: string; modelName: string; maxRetry: number; timeout: number;
  hasApiKey: boolean; maskedKey: string;
}
export interface AgentStartParams {
  instruction: string; apiKey: string; baseUrl: string; modelName: string;
  maxSteps: number; outputDir: string;
}

const electronAPI = {
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
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
export type ElectronAPI = typeof electronAPI;
