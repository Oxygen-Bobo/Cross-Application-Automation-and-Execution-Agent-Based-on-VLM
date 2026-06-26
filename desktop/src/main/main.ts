import { app, BrowserWindow, shell, ipcMain, protocol, net, Menu } from "electron";
import { existsSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { registerConfigHandlers } from "./config-store";
import { registerPythonHandlers } from "./python-runner";
import {
  createFloatingBall,
  showFloating,
  hideFloating,
  sendToFloating,
  setFloatingInteractive,
  startFloatingDrag,
  moveFloating,
  endFloatingDrag,
} from "./floating-ball";
import { HistoryStore } from "./historyStore";
import { initScheduler, reloadSchedulerForCurrentUser, stopScheduler } from "./scheduler";
import { registerAuthHandlers } from "./services/authService";
import { registerPaymentHandlers } from "./services/paymentService";

const historyStore = new HistoryStore();

app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
}

function notifyHistoryUpdated() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("history:updated");
  }
}

function notifyAuthChanged() {
  historyStore.refreshPaths();
  reloadSchedulerForCurrentUser();
  notifyHistoryUpdated();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("auth:changed");
  }
}

let mainWindow: BrowserWindow | null = null;

function isAlive(win: BrowserWindow | null): win is BrowserWindow {
  return !!win && !win.isDestroyed();
}

function registerProtocols() {
  protocol.handle("agent-file", (request) => {
    const filePath = decodeURIComponent(request.url.replace("agent-file://", ""));
    if (!existsSync(filePath)) {
      return new Response("", { status: 404 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1200, minHeight: 760,
    backgroundColor: "#f5f6f8",
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false, contextIsolation: true, nodeIntegration: false,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.on("ready-to-show", () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:") || url.startsWith("http:")) shell.openExternal(url);
    return { action: "deny" };
  });

  createFloatingBall(mainWindow!);

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerProtocols();
  registerAuthHandlers(ipcMain, notifyAuthChanged);
  registerPaymentHandlers(ipcMain);
  registerConfigHandlers(ipcMain);
  registerPythonHandlers(ipcMain);
  initScheduler(ipcMain);

  // Floating window IPC
  const ACTIVE = ["running","planning","observing","capturing","thinking","acting","waiting"];
  const TERMINAL = ["completed","failed","stopped"];
  ipcMain.handle("floating:show", () => { showFloating(); });
  ipcMain.handle("floating:hide", () => { hideFloating(); });
  ipcMain.handle("floating:setInteractive", (_e, interactive: boolean) => {
    setFloatingInteractive(Boolean(interactive));
  });
  ipcMain.handle("floating:dragStart", (_e, point: { screenX: number; screenY: number }) => {
    startFloatingDrag(point);
  });
  ipcMain.handle("floating:dragMove", (_e, point: { screenX: number; screenY: number }) => {
    moveFloating(point);
  });
  ipcMain.handle("floating:dragEnd", () => {
    endFloatingDrag();
  });
  ipcMain.handle("floating:update", (_e, data) => {
    // Enrich with derived fields if renderer didn't provide them
    const enriched = { ...data };
    if (!enriched.currentPhase) {
      const phaseMap: Record<string, string> = {
        capturing: "正在截图", thinking: "AI 分析", planning: "AI 分析",
        observing: "AI 分析", acting: "执行中", waiting: "等待",
        running: "运行中", completed: "完成", failed: "失败", stopped: "已停止",
      };
      enriched.currentPhase = phaseMap[data?.status] || data?.status || "";
    }
    if (enriched.progressPercent == null) {
      const cur = enriched.currentStep ?? 1;
      const max = enriched.maxSteps ?? 50;
      enriched.progressPercent = Math.min(100, Math.max(0, Math.round((cur / max) * 100)));
    }
    sendToFloating("floating:statusChanged", enriched);
    if (ACTIVE.includes(data?.status)) showFloating();
    if (TERMINAL.includes(data?.status)) setTimeout(() => hideFloating(), 3000);
  });
  ipcMain.handle("floating:showMainWindow", () => {
    if (isAlive(mainWindow)) {
      mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
  // stopTask is handled by floating renderer → calls agent:stop via preload

  // History IPC
  ipcMain.handle("history:list", () => historyStore.list());
  ipcMain.handle("history:get", (_e, id: string) => historyStore.get(id));
  ipcMain.handle("history:create", (_e, detail) => { const item = historyStore.create(detail); notifyHistoryUpdated(); return item; });
  ipcMain.handle("history:update", (_e, p: { id: string; patch: any }) => { const item = historyStore.update(p.id, p.patch); notifyHistoryUpdated(); return item; });
  ipcMain.handle("history:delete", (_e, id: string) => { const ok = historyStore.delete(id); notifyHistoryUpdated(); return ok; });
  ipcMain.handle("history:clear", () => { historyStore.clear(); notifyHistoryUpdated(); return true; });
  ipcMain.handle("history:repair", () => { const list = historyStore.repair(); notifyHistoryUpdated(); return list; });

  createWindow();

  app.on("activate", () => { if (!isAlive(mainWindow)) createWindow(); });
});

app.on("second-instance", () => {
  if (isAlive(mainWindow)) {
    mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on("window-all-closed", () => {
  hideFloating();
  stopScheduler();
  if (process.platform !== "darwin") app.quit();
});
