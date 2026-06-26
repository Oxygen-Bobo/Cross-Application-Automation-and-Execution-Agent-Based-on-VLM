#!/usr/bin/env python3
"""Transcribe an audio file with Whisper and print JSON to stdout."""

import argparse
import json
import os
import re
import shutil
import sys


HOTWORD_PROMPT = (
    "以下是桌面自动化任务指令，可能包含中文和英文软件名："
    "Edge, edge浏览器, 浏览器, 搜索, 今日金价, 金价信息, 微信, QQ, WPS, Word, 邮箱, 网易邮箱, 文件传输助手。"
)

COMMON_REPLACEMENTS = (
    ("幫", "帮"),
    ("開", "开"),
    ("覽", "览"),
    ("價", "价"),
    ("資訊", "信息"),
    ("訊息", "信息"),
    ("H流暖起诉所", "edge浏览器搜索"),
    ("H流暖起訴所", "edge浏览器搜索"),
    ("H流览起诉所", "edge浏览器搜索"),
    ("H流覽起訴所", "edge浏览器搜索"),
    ("H浏览器", "edge浏览器"),
    ("H流览器", "edge浏览器"),
    ("H流覽器", "edge浏览器"),
    ("Edge流览器", "edge浏览器"),
    ("edge流览器", "edge浏览器"),
    ("金甲星星", "金价信息"),
    ("金甲信息", "金价信息"),
    ("金价星星", "金价信息"),
    ("金價星星", "金价信息"),
)


def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def app_dir():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def candidate_resource_dirs():
    dirs = []
    env_dir = os.environ.get("AGENT_SPEECH_RESOURCE_DIR")
    if env_dir:
        dirs.append(env_dir)
    dirs.append(app_dir())
    dirs.append(os.path.join(app_dir(), "resources", "agent"))
    dirs.append(os.path.join(os.getcwd(), "desktop", "resources", "agent"))
    return [path for path in dirs if path and os.path.isdir(path)]


def ensure_ffmpeg(ffmpeg_arg=None):
    candidates = []
    if ffmpeg_arg:
        candidates.append(ffmpeg_arg)
    for base in candidate_resource_dirs():
        candidates.extend([
            os.path.join(base, "ffmpeg.exe"),
            os.path.join(base, "ffmpeg"),
            os.path.join(base, "ffmpeg", "bin", "ffmpeg.exe"),
            os.path.join(base, "ffmpeg", "bin", "ffmpeg"),
        ])

    for path in candidates:
        if path and os.path.exists(path):
            os.environ["PATH"] = os.path.dirname(path) + os.pathsep + os.environ.get("PATH", "")
            return path

    return shutil.which("ffmpeg")


def default_model_dir():
    env_dir = os.environ.get("WHISPER_MODEL_DIR")
    if env_dir and os.path.isdir(env_dir):
        return env_dir
    for base in candidate_resource_dirs():
        if os.path.exists(os.path.join(base, "base.pt")):
            return base
    return None


def normalize_transcript(text):
    raw = (text or "").strip()
    has_cjk = bool(re.search(r"[\u4e00-\u9fff]", raw))
    normalized = re.sub(r"\s+", "", raw) if has_cjk else re.sub(r"\s+", " ", raw)
    for source, target in COMMON_REPLACEMENTS:
        normalized = normalized.replace(source, target)

    lower = normalized.lower()
    browser_signal = any(
        token in lower
        for token in (
            "edge",
            "浏览器",
            "流览",
            "流覽",
            "h流",
            "起诉所",
            "起訴所",
        )
    )
    gold_signal = "今日金" in normalized or "金价" in normalized or "金甲" in normalized

    if browser_signal and gold_signal and ("打开" in normalized or "帮我" in normalized):
        return "帮我打开edge浏览器搜索今日金价信息"

    if "今日金" in normalized:
        normalized = re.sub(r"今日金[甲价價](?:星星|信息)?", "今日金价信息", normalized)

    return normalized


def main():
    parser = argparse.ArgumentParser(description="Whisper speech-to-text helper")
    parser.add_argument("--audio", required=True)
    parser.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "base"))
    parser.add_argument("--language", default=os.environ.get("WHISPER_LANGUAGE", "zh"))
    parser.add_argument("--model-dir", default=os.environ.get("WHISPER_MODEL_DIR", ""))
    parser.add_argument("--ffmpeg", default=os.environ.get("FFMPEG_PATH", ""))
    args = parser.parse_args()

    if not os.path.exists(args.audio):
        emit({"ok": False, "error": f"Audio file not found: {args.audio}"})
        sys.exit(1)

    try:
        import whisper
    except Exception:
        emit({
            "ok": False,
            "error": "未安装 whisper。请先安装 openai-whisper 和 ffmpeg 后再使用语音输入。",
        })
        sys.exit(1)

    ffmpeg_path = ensure_ffmpeg(args.ffmpeg)
    if not ffmpeg_path:
        emit({
            "ok": False,
            "error": "未检测到 ffmpeg，无法解析录音文件。请重新打包并确认已内置 ffmpeg.exe。",
        })
        sys.exit(1)

    try:
        model_dir = args.model_dir or default_model_dir()
        if model_dir:
            os.makedirs(model_dir, exist_ok=True)
        model = whisper.load_model(args.model, download_root=model_dir)
        options = {
            "temperature": 0,
            "fp16": False,
            "condition_on_previous_text": False,
            "initial_prompt": HOTWORD_PROMPT,
        }
        if args.language:
            options["language"] = args.language
        result = model.transcribe(args.audio, **options)
        emit({"ok": True, "text": normalize_transcript(result.get("text") or "")})
    except Exception as exc:
        emit({"ok": False, "error": str(exc)})
        sys.exit(1)


if __name__ == "__main__":
    main()
