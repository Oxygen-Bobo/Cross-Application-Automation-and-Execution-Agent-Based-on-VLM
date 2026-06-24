import { BrowserWindow, Menu, screen } from "electron";
import { join } from "path";

let floatingWin: BrowserWindow | null = null;
let mainRef: BrowserWindow | null = null;

export function createFloatingBall(mainWindow: BrowserWindow) {
  mainRef = mainWindow;
  if (floatingWin && !floatingWin.isDestroyed()) return;

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const W = 230, H = 250;

  floatingWin = new BrowserWindow({
    x: sw - W - 20,
    y: sh - H - 20,
    width: W,
    height: H,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  floatingWin.setAlwaysOnTop(true, "screen-saver");

  if (process.env.ELECTRON_RENDERER_URL) {
    floatingWin.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/floating`);
  } else {
    floatingWin.loadFile(join(__dirname, "../renderer/index.html"), { hash: "/floating" });
  }

  floatingWin.webContents.on("did-finish-load", () => {
    floatingWin?.webContents.insertCSS(
      "html,body,#root{background:transparent!important}"
    );
  });

  floatingWin.webContents.on("context-menu", () => {
    Menu.buildFromTemplate([
      { label: "显示主窗口", click: () => { mainRef?.restore(); mainRef?.show(); mainRef?.focus(); } },
      { label: "停止任务",   click: () => { floatingWin?.webContents.send("floating:stopTask"); } },
      { label: "隐藏悬浮球", click: () => floatingWin?.hide() },
    ]).popup();
  });
}

export function showFloating()  { floatingWin?.showInactive(); }
export function hideFloating()   { floatingWin?.hide(); }
export function sendToFloating(ch: string, data: unknown) { floatingWin?.webContents.send(ch, data); }
export function getFloating()    { return floatingWin; }
