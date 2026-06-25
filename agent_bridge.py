#!/usr/bin/env python3
"""
agent_bridge.py -- Python adapter bridging the Electron desktop app
and the core Qwen-Agent GUI automation engine.

Receives user API config from the desktop GUI (not hardcoded constants),
runs the existing agent logic unchanged, and emits JSON Lines on stdout
for real-time desktop UI updates.

API key is passed via AGENT_API_KEY environment variable (NOT command-line).
Other config is passed via CLI args.

Usage (called by Electron main process):
    AGENT_API_KEY=sk-xxx python agent_bridge.py \
        --instruction "open WeChat and send a message" \
        --base-url "https://dashscope.aliyuncs.com/compatible-mode/v1" \
        --model-name "qwen3-vl-plus" \
        --max-steps 50 \
        --output-dir "C:/Users/.../Desktop/anno"

Do NOT call core.main() -- that uses terminal input() and hardcoded config.
"""

import argparse
import json
import os
import sys
import threading
import time
import traceback

# Force UTF-8 on Windows (critical for Chinese character output)
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    sys.__stdout__.reconfigure(encoding="utf-8", errors="replace")
    sys.__stderr__.reconfigure(encoding="utf-8", errors="replace")

# ---------------------------------------------------------------------------
# Import the core agent module (unchanged)
# ---------------------------------------------------------------------------
import run_gui_owl_1_5_for_pc as core


def emit_json(data: dict) -> None:
    """Write a single JSON line to the *real* stdout (bypass redirect)."""
    sys.__stdout__.write(json.dumps(data, ensure_ascii=False) + "\n")
    sys.__stdout__.flush()


def watch_screenshots(
    output_dir: str,
    existing_files: set,
    stop_event: threading.Event,
) -> None:
    """Background daemon: poll output_dir for new PNGs, emit JSON events."""
    while not stop_event.is_set():
        try:
            current = set(os.listdir(output_dir))
            for fname in sorted(current - existing_files):
                if fname.endswith(".png"):
                    existing_files.add(fname)
                    full = os.path.join(output_dir, fname).replace("\\", "/")
                    if fname.startswith("anno_"):
                        emit_json({"type": "annotated_screenshot",
                                   "path": full, "filename": fname})
                    else:
                        emit_json({"type": "screenshot",
                                   "path": full, "filename": fname})
        except Exception:
            pass
        time.sleep(0.5)


class _JsonLinesStream:
    """
    Drop-in replacement for sys.stdout that:
      - echoes everything to the real stdout (for debugging)
      - parses lines for known patterns (STEP / ERROR / INFO)
      - emits structured JSON Lines for the Electron frontend
    """

    def __init__(self) -> None:
        self._buf = ""
        self._current_step = -1

    def write(self, s: str) -> None:
        sys.__stdout__.write(s)
        self._buf += s
        while "\n" in self._buf:
            line, self._buf = self._buf.split("\n", 1)
            self._emit_line(line.strip())

    def flush(self) -> None:
        sys.__stdout__.flush()

    # -- line classifier ----------------------------------------------------

    def _emit_line(self, text: str) -> None:
        if not text:
            return

        # STEP header  -->  step_started
        if text.startswith("STEP ") and "=" in text:
            try:
                self._current_step = int(
                    text.replace("STEP ", "").split(":")[0].strip()
                )
            except ValueError:
                pass
            emit_json({"type": "step_started", "step": self._current_step})
            return

        # Log level prefixes
        for prefix, level in (("[ERROR]", "error"),
                              ("[WARN]",  "warn"),
                              ("[INFO]",  "info")):
            if text.startswith(prefix):
                emit_json({"type": "log", "level": level, "text": text,
                           "step": self._current_step})
                return

        # Everything else is agent output
        emit_json({"type": "output", "text": text,
                   "step": self._current_step})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description="Desktop Agent Bridge")
    ap.add_argument("--instruction", required=True)
    ap.add_argument("--base-url", required=True)
    ap.add_argument("--model-name", required=True)
    ap.add_argument("--max-steps", type=int, default=50)
    ap.add_argument("--output-dir", required=True)
    args = ap.parse_args()

    # API key comes from environment variable, never CLI args
    api_key = os.environ.get("AGENT_API_KEY", "")
    if not api_key:
        emit_json({"type": "run_finished", "status": "failed",
                   "runId": "error", "error": "AGENT_API_KEY not set"})
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)

    # ---- screenshot watcher thread ----------------------------------------
    existing = set(os.listdir(args.output_dir)) if os.path.isdir(args.output_dir) else set()
    stop_event = threading.Event()
    watcher = threading.Thread(
        target=watch_screenshots,
        args=(args.output_dir, existing, stop_event),
        daemon=True,
    )
    watcher.start()

    # ---- redirect Python stdout to JSON Lines -----------------------------
    original_stdout = sys.stdout
    sys.stdout = _JsonLinesStream()

    run_id = os.path.basename(args.output_dir.rstrip("/\\")) or "run"

    try:
        emit_json({
            "type": "run_started",
            "runId": run_id,
            "instruction": args.instruction,
            "modelName": args.model_name,
            "maxSteps": args.max_steps,
            "outputDir": args.output_dir,
        })

        # Monkey-patch MODEL_NAME so build_messages uses the user's model
        core.MODEL_NAME = args.model_name

        computer_tools = core.ComputerTools()
        computer_tools.reset()

        vllm = core.GUIOwlWrapper(
            api_key=api_key,
            base_url=args.base_url,
            model_name=args.model_name,
        )

        # ------------------------------------------------------------------
        # Run the core agent (LangGraph graph, unchanged)
        # ------------------------------------------------------------------
        result = core.run_agent(
            computer_tools,
            vllm,
            args.instruction,
            args.output_dir,
            max_steps=args.max_steps,
        )

        emit_json({
            "type": "run_finished",
            "status": result.get("status", "failed"),
            "runId": run_id,
            "message": result.get("message", ""),
        })

    except Exception as exc:
        err = str(exc)
        # NEVER leak the API key in error output
        if api_key and api_key in err:
            err = err.replace(api_key, "sk-***")
        emit_json({
            "type": "run_finished",
            "status": "failed",
            "runId": run_id,
            "error": err,
        })
        traceback.print_exc(file=sys.__stdout__)

    finally:
        sys.stdout = original_stdout
        stop_event.set()
        watcher.join(timeout=2)


if __name__ == "__main__":
    main()
