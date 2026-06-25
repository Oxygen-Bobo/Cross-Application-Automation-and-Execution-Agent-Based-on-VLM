"""
Lightweight strategy skills for desktop GUI automation.

These are not hard-coded app scripts. They provide task-specific operating
guidance to the VLM so long workflows keep using reliable desktop patterns.
"""

from dataclasses import dataclass
from typing import Iterable, List


@dataclass(frozen=True)
class AgentSkill:
    skill_id: str
    title: str
    keywords: tuple[str, ...]
    guidance: tuple[str, ...]
    priority: int = 50


GENERAL_DESKTOP_SKILL = AgentSkill(
    skill_id="desktop_core",
    title="General Desktop Control",
    keywords=(),
    priority=100,
    guidance=(
        "Prefer keyboard shortcuts, search boxes, menus, and visible UI text over blind coordinate clicks.",
        "Complete one concrete UI action per step, observe the result, then continue.",
        "Do not terminate after merely opening an application; terminate only after the user's final goal is visibly complete.",
        "If the target is not visible, use app search, in-app search, scrolling, or hotkeys before asking the user.",
        "When entering text, click/focus the input field first, then use the type action.",
    ),
)


WINDOWS_NAVIGATION_SKILL = AgentSkill(
    skill_id="windows_navigation",
    title="Windows Navigation",
    keywords=(
        "windows", "desktop", "taskbar", "start menu", "alt tab",
        "\u684c\u9762", "\u4efb\u52a1\u680f", "\u5f00\u59cb\u83dc\u5355",
        "\u5207\u6362\u7a97\u53e3",
    ),
    priority=90,
    guidance=(
        "Use open_app when the app name is known.",
        "Use Alt+Tab only when switching between already-open windows is clearly needed.",
        "If a window is hidden or minimized, restore/focus it before interacting with its content.",
        "After launching an app, wait or observe until the main window is visible before continuing.",
    ),
)


FILE_DIALOG_SKILL = AgentSkill(
    skill_id="file_dialog",
    title="File Dialogs",
    keywords=(
        "file picker", "open file", "save as", "attachment", "upload", "download",
        "\u6587\u4ef6\u9009\u62e9", "\u6253\u5f00\u6587\u4ef6", "\u53e6\u5b58\u4e3a",
        "\u9644\u4ef6", "\u4e0a\u4f20", "\u4e0b\u8f7d", "\u4fdd\u5b58",
    ),
    priority=86,
    guidance=(
        "In file dialogs, prefer focusing the path/name input area and pasting the full path when available.",
        "If the full path is not known, navigate by folders and use search inside the dialog.",
        "Confirm the selected file is visible before pressing Open/Save/Confirm.",
        "After choosing a file, observe the original app to verify the attachment or saved output appeared.",
    ),
)


CROSS_APP_WORKFLOW_SKILL = AgentSkill(
    skill_id="cross_app_workflow",
    title="Cross-App Workflows",
    keywords=(
        "copy", "paste", "send", "share", "report", "export", "attach",
        "\u590d\u5236", "\u7c98\u8d34", "\u53d1\u9001", "\u5206\u4eab",
        "\u62a5\u544a", "\u62a5\u8868", "\u5bfc\u51fa", "\u9644\u52a0",
    ),
    priority=84,
    guidance=(
        "Track the source app, destination app, and artifact being transferred.",
        "If a document/report must be sent, verify it exists or is attached before sending.",
        "Use clipboard/path-based workflows where possible, but verify the destination app received the content.",
        "For multi-app tasks, do not finish until the final receiving app shows the expected result.",
    ),
)


CHAT_MESSAGING_SKILL = AgentSkill(
    skill_id="chat_messaging",
    title="Chat Messaging",
    keywords=(
        "message", "chat", "contact", "send to", "file transfer assistant",
        "\u6d88\u606f", "\u804a\u5929", "\u8054\u7cfb\u4eba", "\u53d1\u7ed9",
        "\u6587\u4ef6\u4f20\u8f93\u52a9\u624b",
    ),
    priority=82,
    guidance=(
        "Open the chat app, search for the target contact/chat, open the matching result, then send.",
        "Prefer the app's search box over scanning long contact lists.",
        "Before sending, make sure the conversation title or visible chat target matches the user's target.",
        "After sending, observe the conversation and verify the sent text/file appears in the message area.",
    ),
)


WECHAT_SKILL = AgentSkill(
    skill_id="wechat",
    title="WeChat",
    keywords=(
        "wechat", "weixin", "file transfer assistant",
        "\u5fae\u4fe1", "\u6587\u4ef6\u4f20\u8f93\u52a9\u624b",
    ),
    priority=96,
    guidance=(
        "After opening WeChat, continue until the requested chat is open and the message/file is visibly sent.",
        "For File Transfer Assistant, search for '\u6587\u4ef6\u4f20\u8f93\u52a9\u624b' or 'File Transfer Assistant'.",
        "If search is visible, click it, type the contact/chat name, and open the matching result.",
        "To send a file/report, use the attachment button or file picker, choose the file, then click Send.",
        "Do not finish after only launching WeChat or opening the contact list.",
    ),
)


QQ_SKILL = AgentSkill(
    skill_id="qq",
    title="QQ",
    keywords=("qq", "QQ", "\u817e\u8bafQQ", "\u8054\u7cfb\u4eba", "\u7fa4\u804a"),
    priority=92,
    guidance=(
        "After opening QQ, search for the target contact/group before clicking list entries.",
        "Verify the chat title matches the target contact or group.",
        "Use the message input area at the bottom of the chat window, then send and verify the sent item appears.",
    ),
)


BROWSER_SKILL = AgentSkill(
    skill_id="browser",
    title="Browser",
    keywords=(
        "browser", "chrome", "edge", "firefox", "web", "search",
        "\u6d4f\u89c8\u5668", "\u7f51\u9875", "\u641c\u7d22", "\u67e5\u627e",
    ),
    priority=78,
    guidance=(
        "Use the address bar/search bar for navigation, not arbitrary page clicks.",
        "Wait/observe after navigation until the page content is visible.",
        "When extracting information, verify the page title/content matches the user's requested topic.",
    ),
)


FILE_EXPLORER_SKILL = AgentSkill(
    skill_id="file_explorer",
    title="File Explorer",
    keywords=(
        "file explorer", "folder", "directory", "desktop", "downloads",
        "\u8d44\u6e90\u7ba1\u7406\u5668", "\u6587\u4ef6\u5939", "\u76ee\u5f55",
        "\u684c\u9762", "\u4e0b\u8f7d",
    ),
    priority=80,
    guidance=(
        "Use the address bar or search box to navigate to folders quickly.",
        "Prefer keyboard selection and path input for known file locations.",
        "After moving/copying/renaming files, observe the folder to verify the result.",
    ),
)


OFFICE_SKILL = AgentSkill(
    skill_id="office_documents",
    title="Office and WPS Documents",
    keywords=(
        "word", "excel", "powerpoint", "ppt", "wps", "office", "document",
        "spreadsheet", "presentation",
        "\u6587\u6863", "\u8868\u683c", "\u5e7b\u706f\u7247", "\u6f14\u793a",
        "\u6c47\u603b", "\u7f16\u8f91", "\u751f\u6210\u62a5\u544a",
    ),
    priority=76,
    guidance=(
        "For Office/WPS, prefer menu/ribbon commands and common shortcuts such as Ctrl+S, Ctrl+O, Ctrl+F, Ctrl+P.",
        "For generated reports, verify the file is saved/exported before using it in another app.",
        "When editing content, focus the document body/cell/slide area before typing or pasting.",
        "For spreadsheets, use cells, formula bar, and visible sheet tabs rather than guessing chart/table coordinates.",
    ),
)


REPORT_DELIVERY_SKILL = AgentSkill(
    skill_id="report_delivery",
    title="Report Delivery",
    keywords=(
        "report", "summary", "deliver", "send report", "export report",
        "\u62a5\u544a", "\u62a5\u8868", "\u603b\u7ed3", "\u6c47\u603b",
        "\u53d1\u9001\u62a5\u544a", "\u5bfc\u51fa\u62a5\u544a",
    ),
    priority=88,
    guidance=(
        "A report-delivery task is not complete until the report exists and has been sent to the specified destination.",
        "If the report file path is known, carry that path forward into the sending app/file picker.",
        "If the report was just generated, verify the save/export result before switching apps.",
        "After sending, observe the destination chat/email/app and confirm the report attachment or message is visible.",
    ),
)


SKILL_REGISTRY: tuple[AgentSkill, ...] = (
    GENERAL_DESKTOP_SKILL,
    WINDOWS_NAVIGATION_SKILL,
    FILE_DIALOG_SKILL,
    CROSS_APP_WORKFLOW_SKILL,
    CHAT_MESSAGING_SKILL,
    WECHAT_SKILL,
    QQ_SKILL,
    BROWSER_SKILL,
    FILE_EXPLORER_SKILL,
    OFFICE_SKILL,
    REPORT_DELIVERY_SKILL,
)


def select_agent_skills(instruction: str, limit: int = 6) -> List[AgentSkill]:
    text = instruction.lower()
    selected = [GENERAL_DESKTOP_SKILL]

    for skill in SKILL_REGISTRY:
        if skill is GENERAL_DESKTOP_SKILL:
            continue
        if any(keyword.lower() in text for keyword in skill.keywords):
            selected.append(skill)

    selected.sort(key=lambda skill: skill.priority, reverse=True)
    return selected[:limit]


def render_operation_guidance(instruction: str) -> str:
    skills = select_agent_skills(instruction)
    lines = ["Relevant operating skills for this task:"]

    for skill in skills:
        lines.append(f"\n[{skill.title}]")
        lines.extend(f"- {item}" for item in skill.guidance)

    return "\n".join(lines)


def selected_skill_ids(instruction: str) -> list[str]:
    return [skill.skill_id for skill in select_agent_skills(instruction)]

