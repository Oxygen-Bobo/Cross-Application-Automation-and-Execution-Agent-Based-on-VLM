import { BrowserWindow, Menu, screen } from "electron";
import { join } from "path";

let floatingWin: BrowserWindow | null = null;
let mainRef: BrowserWindow | null = null;
type DragPoint = {
  screenX: number;
  screenY: number;
  orbLeft?: number;
  orbTop?: number;
  orbWidth?: number;
  orbHeight?: number;
};

let dragState: {
  pointerOffsetX: number;
  pointerOffsetY: number;
  orbLeft: number;
  orbTop: number;
  orbWidth: number;
  orbHeight: number;
} | null = null;

function isAlive(win: BrowserWindow | null): win is BrowserWindow {
  return !!win && !win.isDestroyed();
}

function showMainWindow() {
  if (!isAlive(mainRef)) return;
  mainRef.restore();
  mainRef.show();
  mainRef.focus();
}

export function setFloatingInteractive(interactive: boolean) {
  if (!isAlive(floatingWin)) return;
  floatingWin.setIgnoreMouseEvents(!interactive, { forward: true });
}

export function startFloatingDrag(point: DragPoint) {
  if (!isAlive(floatingWin)) return;
  const bounds = floatingWin.getBounds();
  const orbLeft = Math.round(point.orbLeft ?? 12);
  const orbTop = Math.round(point.orbTop ?? 12);
  const orbWidth = Math.round(point.orbWidth ?? 78);
  const orbHeight = Math.round(point.orbHeight ?? 78);
  dragState = {
    pointerOffsetX: Math.round(point.screenX - bounds.x - orbLeft),
    pointerOffsetY: Math.round(point.screenY - bounds.y - orbTop),
    orbLeft,
    orbTop,
    orbWidth,
    orbHeight,
  };
  setFloatingInteractive(true);
}

export function moveFloating(point: DragPoint) {
  if (!isAlive(floatingWin) || !dragState) return;
  const display = screen.getDisplayNearestPoint({
    x: Math.round(point.screenX),
    y: Math.round(point.screenY),
  });
  const area = display.workArea;
  const orbX = Math.max(
    area.x,
    Math.min(
      Math.round(point.screenX - dragState.pointerOffsetX),
      area.x + area.width - dragState.orbWidth,
    ),
  );
  const orbY = Math.max(
    area.y,
    Math.min(
      Math.round(point.screenY - dragState.pointerOffsetY),
      area.y + area.height - dragState.orbHeight,
    ),
  );
  const nextX = orbX - dragState.orbLeft;
  const nextY = orbY - dragState.orbTop;
  floatingWin.setPosition(nextX, nextY, false);
}

export function endFloatingDrag() {
  dragState = null;
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
  setFloatingInteractive(false);

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
