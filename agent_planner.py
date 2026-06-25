"""Heuristic task planning for the desktop automation agent."""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional


@dataclass
class TaskPlanStep:
    index: int
    title: str
    goal: str
    success_condition: str
    skill: str
    max_attempts: int = 4
    fallback: str = "If progress stalls, use app search, keyboard shortcuts, or ask the user for the missing credential/context."

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    lowered = text.lower()
    return any(keyword.lower() in lowered for keyword in keywords)


def build_task_plan(instruction: str) -> List[Dict[str, Any]]:
    """Build a compact execution plan that can be shown to the VLM each step."""
    plan: List[TaskPlanStep] = []

    needs_research = _contains_any(
        instruction,
        (
            "search", "find", "web", "browser", "edge", "chrome", "gold price",
            "查找", "搜索", "上网", "网页", "浏览器", "查看", "查询", "今天", "今日", "信息", "金价",
        ),
    )
    needs_report = _contains_any(
        instruction,
        ("report", "summary", "summarize", "ppt", "document", "报告", "总结", "汇总", "文档", "幻灯片"),
    )
    needs_delivery = _contains_any(
        instruction,
        ("send", "share", "email", "wechat", "qq", "mail", "发送", "分享", "微信", "qq", "邮箱", "邮件"),
    )
    needs_file = _contains_any(
        instruction,
        ("file", "attachment", "upload", "download", "save", "文件", "附件", "上传", "下载", "保存"),
    )

    def add(title: str, goal: str, success: str, skill: str, attempts: int = 4, fallback: Optional[str] = None) -> None:
        plan.append(TaskPlanStep(
            index=len(plan) + 1,
            title=title,
            goal=goal,
            success_condition=success,
            skill=skill,
            max_attempts=attempts,
            fallback=fallback or TaskPlanStep(0, "", "", "", "").fallback,
        ))

    add(
        "确认当前桌面状态",
        "Identify the active app/window and decide whether an existing app window can be reused.",
        "The next action targets the visible active window or focuses the correct existing app.",
        "windows_navigation",
        attempts=3,
        fallback="Use open_app only after checking whether the target app is already open.",
    )

    if needs_research:
        add(
            "检索并核对信息",
            "Use a browser/search page to find the requested information and verify the page content matches the task.",
            "Relevant information is visible or captured in the conversation history.",
            "browser",
            attempts=6,
            fallback="Use the browser address/search bar directly, then wait and observe the loaded page.",
        )

    if needs_report:
        add(
            "整理报告内容",
            "Create a concise report/summary from the collected information and save it as a reusable artifact when possible.",
            "A report file or complete report text exists and can be sent or copied.",
            "report_delivery",
            attempts=5,
            fallback="Use create_text_file to save a Markdown/text report under AgentOutputs before switching apps.",
        )

    if needs_file:
        add(
            "定位或保存文件",
            "Use known artifact paths or save generated files into AgentOutputs so later apps can find them.",
            "The exact file path is known, exists, and is ready for upload/attachment.",
            "file_dialog",
            attempts=4,
            fallback="Paste the absolute artifact path into the file picker instead of browsing by coordinates.",
        )

    if needs_delivery:
        add(
            "发送到目标应用",
            "Open or focus the destination app, search the target contact/chat/mail recipient, attach or paste the content, and send.",
            "The destination app visibly shows the sent message, file, or email.",
            "cross_app_workflow",
            attempts=7,
            fallback="Use in-app search for the recipient/chat and verify the title before sending.",
        )

    add(
        "验证最终结果",
        "Observe the destination/output screen and confirm the user-visible result matches the requested task.",
        "The final result is visible; only then terminate with success.",
        "desktop_core",
        attempts=3,
        fallback="If the result is not visible, navigate back to the destination app and verify before terminating.",
    )

    return [step.to_dict() for step in plan]


def render_task_plan(plan: List[Dict[str, Any]]) -> str:
    if not plan:
        return "Task plan: not available."

    lines = ["Task plan and checkpoints:"]
    for step in plan:
        lines.append(
            f"{step.get('index')}. {step.get('title')} | "
            f"goal: {step.get('goal')} | "
            f"success: {step.get('success_condition')} | "
            f"skill: {step.get('skill')} | "
            f"max_attempts: {step.get('max_attempts')}"
        )
    return "\n".join(lines)
