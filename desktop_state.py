"""Best-effort desktop/window state helpers."""

from __future__ import annotations

import ctypes
import sys
import time
from typing import Any, Dict, List

import pyautogui


APP_ALIASES = {
    "wechat": ("wechat", "weixin", "微信"),
    "weixin": ("wechat", "weixin", "微信"),
    "微信": ("wechat", "weixin", "微信"),
    "qq": ("qq", "腾讯qq"),
    "edge": ("edge", "microsoft edge"),
    "chrome": ("chrome", "google chrome"),
    "browser": ("edge", "chrome", "firefox", "浏览器"),
    "file explorer": ("file explorer", "explorer", "文件资源管理器", "资源管理器"),
    "文件资源管理器": ("file explorer", "explorer", "文件资源管理器", "资源管理器"),
    "wps": ("wps", "word", "excel", "powerpoint", "演示", "文字", "表格"),
    "mail": ("mail", "outlook", "邮箱", "邮件"),
    "邮箱": ("mail", "outlook", "邮箱", "邮件"),
}


def _get_active_window_title_win32() -> str:
    if sys.platform != "win32":
        return ""
    try:
        user32 = ctypes.windll.user32
        hwnd = user32.GetForegroundWindow()
        length = user32.GetWindowTextLengthW(hwnd)
        buffer = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buffer, length + 1)
        return buffer.value or ""
    except Exception:
        return ""


def _get_windows_pygetwindow() -> List[Dict[str, Any]]:
    try:
        import pygetwindow as gw  # type: ignore
    except Exception:
        return []

    windows: List[Dict[str, Any]] = []
    try:
        for win in gw.getAllWindows():
            title = getattr(win, "title", "") or ""
            if not title.strip():
                continue
            windows.append({
                "title": title,
                "is_active": bool(getattr(win, "isActive", False)),
                "is_minimized": bool(getattr(win, "isMinimized", False)),
                "left": getattr(win, "left", None),
                "top": getattr(win, "top", None),
                "width": getattr(win, "width", None),
                "height": getattr(win, "height", None),
            })
    except Exception:
        return []
    return windows[:30]


def capture_desktop_state() -> Dict[str, Any]:
    width, height = pyautogui.size()
    windows = _get_windows_pygetwindow()
    active_title = ""
    for item in windows:
        if item.get("is_active"):
            active_title = str(item.get("title") or "")
            break
    if not active_title:
        active_title = _get_active_window_title_win32()

    return {
        "platform": sys.platform,
        "screen_size": [int(width), int(height)],
        "active_window_title": active_title,
        "open_windows": windows,
    }


def _aliases_for(app_name: str) -> tuple[str, ...]:
    key = (app_name or "").strip().lower()
    aliases = APP_ALIASES.get(key)
    if aliases:
        return tuple(alias.lower() for alias in aliases)
    return (key,)


def app_appears_open(app_name: str, desktop_state: Dict[str, Any]) -> bool:
    aliases = _aliases_for(app_name)
    for item in desktop_state.get("open_windows", []) or []:
        title = str(item.get("title") or "").lower()
        if title and any(alias in title for alias in aliases):
            return True
    active_title = str(desktop_state.get("active_window_title") or "").lower()
    return bool(active_title and any(alias in active_title for alias in aliases))


def focus_existing_window(app_name: str) -> bool:
    """Try to focus an already-open window before launching another instance."""
    try:
        import pygetwindow as gw  # type: ignore
    except Exception:
        return False

    aliases = _aliases_for(app_name)
    try:
        candidates = []
        for win in gw.getAllWindows():
            title = (getattr(win, "title", "") or "").lower()
            if title and any(alias in title for alias in aliases):
                candidates.append(win)
        if not candidates:
            return False
        win = candidates[0]
        if getattr(win, "isMinimized", False):
            win.restore()
            time.sleep(0.2)
        win.activate()
        time.sleep(0.3)
        return True
    except Exception:
        return False


def render_desktop_state(state: Dict[str, Any]) -> str:
    if not state:
        return "Desktop state: unavailable."

    lines = [
        "Desktop/window state:",
        f"- platform: {state.get('platform')}",
        f"- screen_size: {state.get('screen_size')}",
        f"- active_window: {state.get('active_window_title') or 'unknown'}",
    ]
    windows = state.get("open_windows") or []
    if windows:
        titles = [str(item.get("title") or "") for item in windows[:8]]
        lines.append("- visible/open windows: " + " | ".join(titles))
    else:
        lines.append("- visible/open windows: unavailable; rely on screenshot and app search.")
    lines.append("- If the required app is already open, focus/reuse it instead of opening a desktop shortcut again.")
    return "\n".join(lines)
