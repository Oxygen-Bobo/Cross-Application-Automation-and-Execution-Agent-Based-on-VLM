"""Loop detection and recovery hints for long desktop tasks."""

from __future__ import annotations

import hashlib
import json
from collections import Counter, deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, List, Optional


def action_signature(action_parameter: Dict[str, Any]) -> str:
    action_type = str(action_parameter.get("action") or "")
    compact: Dict[str, Any] = {"action": action_type}
    for key in ("app_name", "keys", "text", "coordinate", "coordinate1", "coordinate2", "pixels"):
        if key not in action_parameter:
            continue
        value = action_parameter[key]
        if key == "text" and isinstance(value, str):
            value = value[:80]
        compact[key] = value
    try:
        raw = json.dumps(compact, ensure_ascii=False, sort_keys=True)
    except Exception:
        raw = repr(compact)
    return hashlib.sha1(raw.encode("utf-8", errors="ignore")).hexdigest()[:16] + ":" + raw


@dataclass
class RecoveryDecision:
    should_execute: bool
    should_stop: bool = False
    reason: str = ""
    hint: str = ""


@dataclass
class RecoveryTracker:
    repeat_threshold: int = 3
    hard_stop_threshold: int = 5
    recent_signatures: Deque[str] = field(default_factory=lambda: deque(maxlen=10))
    signature_counts: Counter = field(default_factory=Counter)
    recent_model_hashes: Deque[str] = field(default_factory=lambda: deque(maxlen=6))
    hints: List[str] = field(default_factory=list)
    last_reason: str = ""

    def check_before_action(self, signature: str, step_id: int) -> RecoveryDecision:
        count = self.signature_counts[signature] + 1
        if count >= self.hard_stop_threshold:
            hint = (
                "The same action has repeated too many times. Stop this path, "
                "re-observe the screen, use a different UI route, or ask the user if credentials/manual input are required."
            )
            return RecoveryDecision(False, True, f"repeated action {count} times at step {step_id}", hint)
        if count >= self.repeat_threshold:
            hint = (
                "Avoid repeating the last UI action. Use a different recovery route: "
                "focus an existing window, use in-app search, use keyboard shortcuts, wait/observe, "
                "or ask the user for missing login/permission input."
            )
            return RecoveryDecision(False, False, f"loop risk: repeated action {count} times", hint)
        return RecoveryDecision(True)

    def record_action(self, signature: str) -> None:
        self.recent_signatures.append(signature)
        self.signature_counts[signature] += 1

    def record_model_output(self, output_text: str) -> Optional[str]:
        normalized = " ".join((output_text or "").split())
        digest = hashlib.sha1(normalized.encode("utf-8", errors="ignore")).hexdigest()[:16]
        self.recent_model_hashes.append(digest)
        if len(self.recent_model_hashes) >= 3:
            recent = list(self.recent_model_hashes)[-3:]
            if len(set(recent)) == 1:
                hint = (
                    "The model is producing nearly identical output. Force a new route: "
                    "observe current state, do not click the same coordinate, and try search/hotkeys/path input."
                )
                self.add_hint(hint)
                return hint
        return None

    def add_hint(self, hint: str, reason: str = "") -> None:
        if hint and hint not in self.hints:
            self.hints.append(hint)
        if reason:
            self.last_reason = reason
        self.hints = self.hints[-6:]

    def render_for_prompt(self) -> str:
        lines = [
            "Failure recovery and anti-loop rules:",
            f"- Do not repeat the same click/open/type action more than {self.repeat_threshold - 1} times.",
            "- If an app is already open or a login screen blocks progress, do not reopen it from the desktop.",
            "- When stuck, change strategy: use search, hotkeys, file paths, wait/observe, or ask the user for credentials/manual confirmation.",
        ]
        if self.last_reason:
            lines.append(f"- Last recovery reason: {self.last_reason}")
        if self.hints:
            lines.append("- Active recovery hints:")
            lines.extend(f"  * {hint}" for hint in self.hints[-4:])
        return "\n".join(lines)
