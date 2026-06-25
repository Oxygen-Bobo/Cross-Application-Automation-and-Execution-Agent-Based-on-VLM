import { BrowserWindow, Menu, screen } from "electron";
import { join } from "path";

let floatingWin: BrowserWindow | null = null;
let mainRef: BrowserWindow | null = null;

function isAlive(win: BrowserWindow | null): win is BrowserWindow {
  return !!win && !win.isDestroyed();
}

function showMainWindow() {
  if (!isAlive(mainRef)) return;
  mainRef.restore();
  mainRef.show();
  mainRef.focus();
}

export function createFloatingBall(mainWindow: BrowserWindow) {
  mainRef = mainWindow;
  mainWindow.once("closed", () => {
    if (mainRef === mainWindow) mainRef = null;
  });

  if (isAlive(floatingWin)) return;

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const W = 230;
  const H = 250;

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

  floatingWin.once("closed", () => {
    floatingWin = null;
  });

  floatingWin.setAlwaysOnTop(true, "screen-saver");

  if (process.env.ELECTRON_RENDERER_URL) {
    floatingWin.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/floating`);
  } else {
    floatingWin.loadFile(join(__dirname, "../renderer/index.html"), { hash: "/floating" });
  }

  floatingWin.webContents.on("did-finish-load", () => {
    if (isAlive(floatingWin) && !floatingWin.webContents.isDestroyed()) {
      floatingWin.webContents.insertCSS("html,body,#root{background:transparent!important}");
    }
  });

  floatingWin.webContents.on("context-menu", () => {
    Menu.buildFromTemplate([
      { label: "显示主窗口", click: showMainWindow },
      {
        label: "停止任务",
        click: () => {
          if (isAlive(floatingWin) && !floatingWin.webContents.isDestroyed()) {
            floatingWin.webContents.send("floating:stopTask");
          }
        },
      },
      { label: "隐藏悬浮球", click: () => hideFloating() },
    ]).popup();
  });
}

export function showFloating() {
  if (isAlive(floatingWin)) floatingWin.showInactive();
}

export function hideFloating() {
  if (isAlive(floatingWin)) floatingWin.hide();
}

export function sendToFloating(channel: string, data: unknown) {
  if (isAlive(floatingWin) && !floatingWin.webContents.isDestroyed()) {
    floatingWin.webContents.send(channel, data);
  }
}

export function getFloating() {
  return floatingWin;
}

export function showMainFromFloating() {
  showMainWindow();
}
