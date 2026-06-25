"""
Desktop GUI Automation Agent - Interactive Mode

Run:
    python run_gui_owl_1_5_for_pc.py
"""

import os
import time

from PIL import Image

from utils import (
    ComputerTools,
    StepPopup,
    annotate_screenshot,
    build_messages,
    extract_tool_calls,
    get_output_dir,
    sanitize_filename,
    smart_resize,
    GUIOwlWrapper,
    VLM_IMAGE_FACTOR,
    VLM_MIN_PIXELS,
    VLM_MAX_PIXELS,
)

from typing import Any, Dict, List, Optional, TypedDict
from langgraph.graph import StateGraph, START, END
from agent_skills import selected_skill_ids
from agent_planner import build_task_plan, render_task_plan
from artifact_manager import ArtifactManager
from desktop_state import capture_desktop_state, render_desktop_state
from failure_recovery import RecoveryTracker, action_signature

API_KEY = "sk-ws-H.RPEIMEH.dBrN.MEQCIFzV2Scc_QsDTvs1a2WVrw2t1TeMMNfqH5qi6Gqof5arAiAzllm-aN8hRipTNj6E8MLreHHil0ThualYvWngnH4qog"
BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
MODEL_NAME = "qwen3-vl-plus"
MAX_STEPS = 50
POST_ACTION_WAIT_SECONDS = 0.6


def rescale_coordinates(action_parameter, resized_width, resized_height):
    """
    将bbox 1000×1000坐标转换为屏幕尺寸的真实坐标
    """
    for key in ("coordinate", "coordinate1", "coordinate2"):
        if key in action_parameter:
            x, y = action_parameter[key][:2]
            action_parameter[key][0] = int(float(x) / 1000 * resized_width)
            action_parameter[key][1] = int(float(y) / 1000 * resized_height)


def clamp_coordinates(action_parameter, screen_width, screen_height):
    for key in ("coordinate", "coordinate1", "coordinate2"):
        if key not in action_parameter:
            continue
        x, y = action_parameter[key][:2]
        action_parameter[key][0] = max(0, min(int(x), screen_width - 1))
        action_parameter[key][1] = max(0, min(int(y), screen_height - 1))


def _normalize_coordinate_keys(action_parameter):
    for key in list(action_parameter.keys()):
        if key in ("coordinate", "coordinate1", "coordinate2"):
            continue
        if key in ("x", "y"):
            continue
        if key.startswith("coordinate"):
            if key.startswith("coordinate2"):
                clean = "coordinate2"
            elif key.startswith("coordinate1"):
                clean = "coordinate1"
            else:
                clean = "coordinate"
            if clean not in action_parameter:
                action_parameter[clean] = action_parameter.pop(key)
    if "coordinate" not in action_parameter and "x" in action_parameter and "y" in action_parameter:
        action_parameter["coordinate"] = [action_parameter.pop("x"), action_parameter.pop("y")]


def _normalize_action_type(action_parameter):
    action_type = action_parameter.get("action")
    if not isinstance(action_type, str):
        return
    normalized = action_type.strip().lower().replace("-", "_")
    aliases = {
        "left click": "left_click",
        "left_click": "left_click",
        "click": "left_click",
        "right click": "right_click",
        "right_click": "right_click",
        "middle click": "middle_click",
        "middle_click": "middle_click",
        "double click": "double_click",
        "double_click": "double_click",
        "triple click": "triple_click",
        "triple_click": "triple_click",
        "drag": "left_click_drag",
        "left drag": "left_click_drag",
        "left_click_drag": "left_click_drag",
        "hot key": "hotkey",
        "hotkey": "hotkey",
        "press_key": "key",
        "keyboard": "key",
        "input": "type",
        "text": "type",
        "open app": "open_app",
        "open_app": "open_app",
        "search web": "search_web",
        "web_search": "search_web",
        "search_web": "search_web",
        "open url": "open_url",
        "open_url": "open_url",
        "show desktop": "show_desktop",
        "show_desktop": "show_desktop",
        "minimize all": "show_desktop",
        "minimize_all": "show_desktop",
    }
    action_parameter["action"] = aliases.get(normalized, action_type.strip())
    if action_parameter["action"] == "open_app" and not action_parameter.get("app_name") and action_parameter.get("text"):
        action_parameter["app_name"] = action_parameter["text"]


def normalize_action_parameter(action_parameter):
    _normalize_coordinate_keys(action_parameter)
    _normalize_action_type(action_parameter)
    if not action_parameter.get("action"):
        if "coordinate1" in action_parameter and "coordinate2" in action_parameter:
            action_parameter["action"] = "left_click_drag"
        elif "coordinate" in action_parameter:
            action_parameter["action"] = "left_click"
        elif action_parameter.get("app_name"):
            action_parameter["action"] = "open_app"
        elif action_parameter.get("query"):
            action_parameter["action"] = "search_web"
        elif action_parameter.get("url"):
            action_parameter["action"] = "open_url"
        elif action_parameter.get("keys"):
            action_parameter["action"] = "key"
    return action_parameter


def execute_action(computer_tools, action_parameter, artifact_manager=None, output_dir=None):
    normalize_action_parameter(action_parameter)

    action_type = action_parameter["action"]

    if action_type in ("click", "left_click"):
        computer_tools.left_click(
            action_parameter["coordinate"][0],
            action_parameter["coordinate"][1],
        )
    elif action_type == "mouse_move":
        computer_tools.mouse_move(
            action_parameter["coordinate"][0],
            action_parameter["coordinate"][1],
        )
    elif action_type == "middle_click":
        computer_tools.middle_click(
            action_parameter["coordinate"][0],
            action_parameter["coordinate"][1],
        )
    elif action_type in ("right click", "right_click"):
        computer_tools.right_click(
            action_parameter["coordinate"][0],
            action_parameter["coordinate"][1],
        )
    elif action_type in ("open app", "open_app"):
        computer_tools.open_app(action_parameter["app_name"])
    elif action_type == "search_web":
        computer_tools.search_web(action_parameter["query"], action_parameter.get("browser", "Edge"))
    elif action_type == "open_url":
        computer_tools.open_url(action_parameter["url"], action_parameter.get("browser", "Edge"))
    elif action_type == "show_desktop":
        computer_tools.show_desktop()
    elif action_type in ("key", "hotkey"):
        computer_tools.press_key(action_parameter["keys"])
    elif action_type == "type":
        computer_tools.type(action_parameter["text"])
    elif action_type == "create_text_file":
        text = action_parameter.get("text", "")
        filename = action_parameter.get("filename") or "agent_report.md"
        if artifact_manager is not None:
            record = artifact_manager.create_text_file(filename, text)
            action_parameter["path"] = record["path"]
            print(f"[INFO] Created artifact: {record['path']}")
        else:
            target_dir = output_dir or os.getcwd()
            os.makedirs(target_dir, exist_ok=True)
            target_path = os.path.join(target_dir, filename)
            with open(target_path, "w", encoding="utf-8") as fp:
                fp.write(text)
            action_parameter["path"] = target_path
            print(f"[INFO] Created file: {target_path}")
    elif action_type == "create_docx_file":
        text = action_parameter.get("text", "")
        filename = action_parameter.get("filename") or "agent_report.docx"
        title = action_parameter.get("title") or "Agent Report"
        if artifact_manager is not None:
            record = artifact_manager.create_docx_file(filename, text, title=title)
            action_parameter["path"] = record["path"]
            print(f"[INFO] Created DOCX artifact: {record['path']}")
        else:
            raise RuntimeError("create_docx_file requires an artifact manager")
    elif action_type in ("drag", "left_click_drag"):
        if "coordinate1" in action_parameter and "coordinate2" in action_parameter:
            computer_tools.drag_between(
                action_parameter["coordinate1"][0],
                action_parameter["coordinate1"][1],
                action_parameter["coordinate2"][0],
                action_parameter["coordinate2"][1],
            )
        else:
            computer_tools.left_click_drag(
                action_parameter["coordinate"][0],
                action_parameter["coordinate"][1],
            )
    elif action_type == "scroll":
        if "coordinate" in action_parameter:
            computer_tools.mouse_move(
                action_parameter["coordinate"][0],
                action_parameter["coordinate"][1],
            )
        computer_tools.scroll(action_parameter.get("pixels", 1))
    elif action_type == "hscroll":
        if "coordinate" in action_parameter:
            computer_tools.mouse_move(
                action_parameter["coordinate"][0],
                action_parameter["coordinate"][1],
            )
        computer_tools.hscroll(action_parameter.get("pixels", 1))
    elif action_type in ("computer_double_click", "double_click"):
        computer_tools.double_click(
            action_parameter["coordinate"][0],
            action_parameter["coordinate"][1],
        )
    elif action_type == "triple_click":
        computer_tools.triple_click(
            action_parameter["coordinate"][0],
            action_parameter["coordinate"][1],
        )
    elif action_type == "call_user":
        """
        主动发出用户互动请求，避免程序直接终止报错
        """
        StepPopup.show_blocking(
            "User Interaction Required",
            "Please perform the requested manual operation.",
            image_path="",
            timeout_sec=120,
            width=960,
            height=540,
        )
        print("Manual action completed, resuming...")
    elif action_type == "wait":
        time.sleep(action_parameter.get("time", 2))
    elif action_type == "answer":
        StepPopup.show_blocking(
            "Task Finished",
            action_parameter["text"],
            image_path="",
            timeout_sec=120,
            width=960,
            height=540,
        )
        return True, "success", action_parameter["text"]
    elif action_type in ("stop", "terminate", "done"):
        status = action_parameter.get("status", "success")
        StepPopup.show_blocking(
            "Task Completed",
            f"Task completed with status: {status}",
            image_path="",
            timeout_sec=120,
            width=960,
            height=540,
        )
        return True, status, f"Task completed with status: {status}"
    elif action_type == "interact":
        StepPopup.show_blocking(
            "User Interaction Required",
            action_parameter.get("text", "Please interact with the dialog."),
            image_path="",
            timeout_sec=120,
            width=960,
            height=540,
        )
        print("User interaction completed, resuming...")
    else:
        raise ValueError(f"Unsupported action type: {action_type}")

    return False, None, None


def validate_action(action):
    if not isinstance(action, dict):
        return "tool call is not an object"
    if action.get("name") != "computer_use":
        return f"unsupported tool name: {action.get('name')}"
    args = action.get("arguments")
    if not isinstance(args, dict):
        return "tool call arguments must be an object"
    normalize_action_parameter(args)
    action_type = args.get("action")
    if not action_type:
        return "missing action"

    coordinate_actions = {
        "click", "left_click", "mouse_move", "middle_click", "right click",
        "right_click", "computer_double_click", "double_click", "triple_click",
    }
    if action_type in coordinate_actions and "coordinate" not in args:
        return f"{action_type} requires coordinate"
    if action_type in ("open app", "open_app") and not args.get("app_name"):
        return "open_app requires app_name"
    if action_type == "search_web" and not args.get("query"):
        return "search_web requires query"
    if action_type == "open_url" and not args.get("url"):
        return "open_url requires url"
    if action_type in ("key", "hotkey") and not args.get("keys"):
        return "key requires keys"
    if action_type == "type" and "text" not in args:
        return "type requires text"
    if action_type == "create_text_file" and not args.get("filename"):
        return "create_text_file requires filename"
    if action_type == "create_docx_file":
        if not args.get("filename"):
            return "create_docx_file requires filename"
        if "text" not in args:
            return "create_docx_file requires text"
    if action_type in ("drag", "left_click_drag") and not (
        "coordinate" in args or ("coordinate1" in args and "coordinate2" in args)
    ):
        return "drag requires coordinate or coordinate1/coordinate2"
    return None


class AgentState(TypedDict):
    instruction: str
    safe_instruction: str
    output_dir: str
    max_steps: int
    step_id: int

    history: List[Dict[str, str]]
    stop_flag: bool
    final_status: Optional[str]
    final_message: Optional[str]
    invalid_action_count: int
    task_plan: List[Dict[str, Any]]
    desktop_state: Dict[str, Any]
    artifact_manager: Any
    artifacts: List[Dict[str, Any]]
    recovery_tracker: Any
    recovery_hint: Optional[str]
    runtime_context: Optional[str]

    screenshot_path: Optional[str]
    messages: Optional[List[Dict[str, Any]]]
    output_text: Optional[str]
    action_list: List[Dict[str, Any]]
    error_message: Optional[str]

    resized_width: Optional[int]
    resized_height: Optional[int]

    screen_width: Optional[int]
    screen_height: Optional[int]

    capture_ok: bool

    computer_tools: Any
    vllm: Any


def build_runtime_context(state: AgentState) -> str:
    artifact_manager = state.get("artifact_manager")
    artifact_text = (
        artifact_manager.render_for_prompt()
        if artifact_manager is not None
        else "Artifact/file workspace: unavailable."
    )
    recovery_tracker = state.get("recovery_tracker")
    recovery_text = (
        recovery_tracker.render_for_prompt()
        if recovery_tracker is not None
        else "Failure recovery and anti-loop rules: unavailable."
    )
    parts = [
        render_task_plan(state.get("task_plan") or []),
        render_desktop_state(state.get("desktop_state") or {}),
        artifact_text,
        recovery_text,
        (
            "Execution policy:\n"
            "- For online lookup/search tasks, prefer action=search_web with browser Edge instead of manually opening the browser, clicking the address bar, typing, and pressing Enter.\n"
            "- For known URLs, prefer action=open_url with browser Edge.\n"
            "- When using installed software such as mail, WeChat, QQ, WPS, or browsers, first reuse active/open taskbar windows; if none exists, use show_desktop first, then launch from desktop/start/search.\n"
            "- If WPS, a browser, or another full-screen window hides the desktop/taskbar target, use show_desktop before switching apps.\n"
            "- Complete the current checkpoint before moving to the next one.\n"
            "- Prefer existing app windows, app search, keyboard shortcuts, and absolute file paths over desktop icon double-clicks.\n"
            "- For research/report tasks, read the visible page content, extract facts, and compose a structured summary. Do not blindly select/copy the whole webpage as the report.\n"
            "- If the task asks for a DOCX report, use create_docx_file with a clear filename, title, and complete processed report content. Do not open WPS/Word just to type report content unless the user explicitly asks to edit in that app.\n"
            "- If the task requires a report and a text/Markdown report is acceptable, use create_text_file with a clear filename and complete content."
        ),
    ]
    if state.get("recovery_hint"):
        parts.append(f"Current recovery hint:\n- {state['recovery_hint']}")
    return "\n\n".join(parts)


def observe_node(state: AgentState) -> AgentState:
    step_id = state["step_id"]

    print(f"\nSTEP {step_id}:\n{'=' * 50}")

    screen_shot = os.path.join(
        state["output_dir"],
        f"{state['safe_instruction']}_{step_id}.png"
    )

    if not state["computer_tools"].get_screenshot(screen_shot):
        print(f"[ERROR] Failed to capture screenshot at step {step_id}")
        return {
            **state,
            "screenshot_path": screen_shot,
            "capture_ok": False,
        }

    with Image.open(screen_shot) as img:
        screen_width, screen_height = img.size
    desktop_state = capture_desktop_state()
    artifact_manager = state.get("artifact_manager")
    artifacts = artifact_manager.scan_existing() if artifact_manager is not None else state.get("artifacts", [])

    return {
        **state,
        "screenshot_path": screen_shot,
        "screen_width": screen_width,
        "screen_height": screen_height,
        "desktop_state": desktop_state,
        "artifacts": artifacts,
        "capture_ok": True,
    }


def skip_failed_step_node(state: AgentState) -> AgentState:
    return {
        **state,
        "step_id": state["step_id"] + 1,
    }


def build_messages_node(state: AgentState) -> AgentState:
    runtime_context = build_runtime_context(state)
    messages = build_messages(
        state["screenshot_path"],
        state["instruction"],
        state["history"],
        MODEL_NAME,
        runtime_context=runtime_context,
    )

    return {
        **state,
        "messages": messages,
        "runtime_context": runtime_context,
    }


def plan_node(state: AgentState) -> AgentState:
    output_text, _, _ = state["vllm"].predict_mm(state["messages"])
    print(output_text)
    recovery_hint = state.get("recovery_hint")
    recovery_tracker = state.get("recovery_tracker")
    if recovery_tracker is not None:
        repeated_hint = recovery_tracker.record_model_output(output_text or "")
        if repeated_hint:
            recovery_hint = repeated_hint

    return {
        **state,
        "output_text": output_text,
        "error_message": None,
        "recovery_hint": recovery_hint,
    }


def parse_node(state: AgentState) -> AgentState:
    action_list = extract_tool_calls(state["output_text"] or "")
    error_message = None
    if not action_list:
        error_message = (
            "模型没有输出可执行的工具调用。原因通常是 <tool_call> 为空、JSON 不完整，"
            "或缺少 action/app_name/coordinate 等必要参数。建议重试：让模型只输出一个完整 "
            '<tool_call>{"name":"computer_use","arguments":{"action":"open_app","app_name":"Edge"}}</tool_call> '
            "格式的动作。"
        )
        print(f"[WARN] {error_message}")
    if (state["output_text"] or "").strip() == "Error calling LLM":
        error_message = "LLM call failed after retries"
        print(f"[ERROR] {error_message}")

    return {
        **state,
        "action_list": action_list,
        "error_message": error_message,
        "stop_flag": state["stop_flag"] or error_message is not None,
        "final_status": "failed" if error_message else state.get("final_status"),
        "final_message": error_message or state.get("final_message"),
    }


def resize_node(state: AgentState) -> AgentState:
    dummy_image = Image.open(state["screenshot_path"])

    resized_height, resized_width = smart_resize(
        dummy_image.height,
        dummy_image.width,
        factor=VLM_IMAGE_FACTOR,
        min_pixels=VLM_MIN_PIXELS,
        max_pixels=VLM_MAX_PIXELS,
    )

    return {
        **state,
        "resized_height": resized_height,
        "resized_width": resized_width,
    }


def act_node(state: AgentState) -> AgentState:
    stop_flag = state["stop_flag"]
    recovery_tracker = state.get("recovery_tracker")
    final_status = state.get("final_status")
    final_message = state.get("final_message")

    if state["error_message"]:
        return {
            **state,
            "stop_flag": stop_flag,
        }

    executed_any = False
    skipped_for_recovery = False
    validation_errors = []
    for action_id, action in enumerate(state["action_list"]):
        validation_error = validate_action(action)
        if validation_error:
            print(f"[WARN] Skipping invalid action: {validation_error}")
            validation_errors.append(validation_error)
            continue

        action_parameter = action["arguments"]

        rescale_coordinates(
            action_parameter,
            state["screen_width"],
            state["screen_height"],
        )
        clamp_coordinates(
            action_parameter,
            state["screen_width"],
            state["screen_height"],
        )

        signature = action_signature(action_parameter)
        if recovery_tracker is not None:
            decision = recovery_tracker.check_before_action(signature, state["step_id"])
            if decision.hint:
                recovery_tracker.add_hint(decision.hint, decision.reason)
            if not decision.should_execute:
                print(f"[WARN] Recovery skipped action: {decision.reason}")
                skipped_for_recovery = True
                if decision.should_stop:
                    stop_flag = True
                    final_status = "failed"
                    final_message = decision.reason
                continue

        print(f"[INFO] Executing action: {action_parameter}")
        executed_any = True

        should_stop, action_status, action_message = execute_action(
            state["computer_tools"],
            action_parameter,
            artifact_manager=state.get("artifact_manager"),
            output_dir=state["output_dir"],
        )
        if recovery_tracker is not None:
            recovery_tracker.record_action(signature)

        if should_stop:
            stop_flag = True
            final_status = action_status or "success"
            final_message = action_message or f"Task completed with status: {final_status}"
            break

        annotate_screenshot(
            state["screenshot_path"],
            action_parameter,
            os.path.join(
                state["output_dir"],
                f"anno_{state['safe_instruction']}_{state['step_id']}_{action_id}.png",
            ),
        )

    invalid_action_count = 0 if executed_any else state.get("invalid_action_count", 0)
    recovery_hint = state.get("recovery_hint")
    if state["action_list"] and not executed_any and not skipped_for_recovery:
        invalid_action_count += 1
        reason = "; ".join(validation_errors) if validation_errors else "unknown validation error"
        retry_hint = (
            f"The previous tool call was invalid: {reason}. "
            "Retry with a complete tool call. Include action explicitly, for example "
            '{"action":"open_app","app_name":"Edge"} or {"action":"left_click","coordinate":[x,y]}.'
        )
        print(f"[WARN] No executable action remained after validation: {reason}")
        print(f"[INFO] Retry guidance: {retry_hint}")
        recovery_hint = retry_hint
        if recovery_tracker is not None:
            recovery_tracker.add_hint(retry_hint, reason)
        if invalid_action_count >= 3:
            stop_flag = True
            final_status = "failed"
            final_message = (
                "连续 3 次生成了无效桌面动作。\n"
                f"失败原因：{reason}\n"
                "建议重试：重新描述目标应用和第一步动作，或切换模型后再运行。"
            )

    return {
        **state,
        "stop_flag": stop_flag,
        "final_status": final_status,
        "final_message": final_message,
        "invalid_action_count": invalid_action_count,
        "recovery_hint": recovery_hint,
    }


def update_history_node(state: AgentState) -> AgentState:
    history = list(state["history"])
    artifact_manager = state.get("artifact_manager")
    artifacts = artifact_manager.scan_existing() if artifact_manager is not None else state.get("artifacts", [])

    history.append({
        "output": state["output_text"],
        "image": state["screenshot_path"],
    })

    time.sleep(POST_ACTION_WAIT_SECONDS)

    return {
        **state,
        "history": history,
        "artifacts": artifacts,
        "step_id": state["step_id"] + 1,
    }


def route_after_observe(state: AgentState) -> str:
    if not state["capture_ok"]:
        return "skip_failed_step"
    return "build_messages"


def route_after_step(state: AgentState) -> str:
    if state["stop_flag"]:
        return "end"

    if state["step_id"] >= state["max_steps"]:
        print(f"\n[INFO] Reached maximum steps ({state['max_steps']}). Stopping.")
        return "end"

    return "observe"


def build_gui_owl_graph():
    graph = StateGraph(AgentState)

    graph.add_node("observe", observe_node)
    graph.add_node("skip_failed_step", skip_failed_step_node)
    graph.add_node("build_messages", build_messages_node)
    graph.add_node("plan", plan_node)
    graph.add_node("parse", parse_node)
    graph.add_node("resize", resize_node)
    graph.add_node("act", act_node)
    graph.add_node("update_history", update_history_node)

    graph.add_edge(START, "observe")

    graph.add_conditional_edges(
        "observe",
        route_after_observe,
        {
            "skip_failed_step": "skip_failed_step",
            "build_messages": "build_messages",
        },
    )

    graph.add_conditional_edges(
        "skip_failed_step",
        route_after_step,
        {
            "observe": "observe",
            "end": END,
        },
    )

    graph.add_edge("build_messages", "plan")
    graph.add_edge("plan", "parse")
    graph.add_edge("parse", "resize")
    graph.add_edge("resize", "act")
    graph.add_edge("act", "update_history")

    graph.add_conditional_edges(
        "update_history",
        route_after_step,
        {
            "observe": "observe",
            "end": END,
        },
    )

    return graph.compile()


def run_agent(computer_tools, vllm, instruction, output_dir, max_steps=50):
    safe_instruction = sanitize_filename(instruction)
    task_plan = build_task_plan(instruction)
    artifact_manager = ArtifactManager(output_dir, instruction)
    recovery_tracker = RecoveryTracker()

    app = build_gui_owl_graph()
    print(f"[INFO] Active skills: {', '.join(selected_skill_ids(instruction))}")
    print(f"[INFO] Artifact workspace: {artifact_manager.root_dir}")
    print(render_task_plan(task_plan))

    initial_state: AgentState = {
        "instruction": instruction,
        "safe_instruction": safe_instruction,
        "output_dir": output_dir,
        "max_steps": max_steps,
        "step_id": 0,

        "history": [],
        "stop_flag": False,
        "final_status": None,
        "final_message": None,
        "invalid_action_count": 0,
        "task_plan": task_plan,
        "desktop_state": {},
        "artifact_manager": artifact_manager,
        "artifacts": [],
        "recovery_tracker": recovery_tracker,
        "recovery_hint": None,
        "runtime_context": None,

        "screenshot_path": None,
        "messages": None,
        "output_text": None,
        "action_list": [],

        "resized_width": None,
        "resized_height": None,

        "screen_width": None,
        "screen_height": None,

        "capture_ok": False,
        "error_message": None,

        "computer_tools": computer_tools,
        "vllm": vllm,
    }

    final_state = app.invoke(initial_state)
    final_status = final_state.get("final_status")
    if final_status == "success":
        return {
            "status": "success",
            "message": final_state.get("final_message") or "Task completed successfully",
        }
    message = final_state.get("final_message")
    if not message:
        if final_state.get("step_id", 0) >= max_steps:
            message = f"Reached maximum steps ({max_steps}) before confirmed completion"
        else:
            message = "Task ended before confirmed completion"
    return {
        "status": "failed",
        "message": message,
    }


def main():
    computer_tools = ComputerTools()
    computer_tools.reset()
    vllm = GUIOwlWrapper(API_KEY, BASE_URL, MODEL_NAME)
    output_dir = get_output_dir()

    print("=" * 50)
    print("  Desktop GUI Automation Agent")
    print(f"  Model: {MODEL_NAME}")
    print("  Type 'quit' or 'exit' to stop.")
    print("=" * 50)

    while True:
        try:
            instruction = input("\n> What should I do? ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if instruction.lower() in ("quit", "exit", "q"):
            print("Goodbye!")
            break
        if not instruction:
            continue

        run_agent(computer_tools, vllm, instruction, output_dir, max_steps=MAX_STEPS)


if __name__ == "__main__":
    main()
