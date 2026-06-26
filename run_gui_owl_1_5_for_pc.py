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

API_KEY = ""
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
        if key.startswith("coordinate"):
            if key.startswith("coordinate2"):
                clean = "coordinate2"
            elif key.startswith("coordinate1"):
                clean = "coordinate1"
            else:
                clean = "coordinate"
            if clean not in action_parameter:
                action_parameter[clean] = action_parameter.pop(key)


def execute_action(computer_tools, action_parameter):
    _normalize_coordinate_keys(action_parameter)

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
    elif action_type in ("key", "hotkey"):
        computer_tools.press_key(action_parameter["keys"])
    elif action_type == "type":
        computer_tools.type(action_parameter["text"])
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
        return True
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
        return True
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

    return False


def validate_action(action):
    if not isinstance(action, dict):
        return "tool call is not an object"
    if action.get("name") != "computer_use":
        return f"unsupported tool name: {action.get('name')}"
    args = action.get("arguments")
    if not isinstance(args, dict):
        return "tool call arguments must be an object"
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
    if action_type in ("key", "hotkey") and not args.get("keys"):
        return "key requires keys"
    if action_type == "type" and "text" not in args:
        return "type requires text"
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

    return {
        **state,
        "screenshot_path": screen_shot,
        "screen_width": screen_width,
        "screen_height": screen_height,
        "capture_ok": True,
    }


def skip_failed_step_node(state: AgentState) -> AgentState:
    return {
        **state,
        "step_id": state["step_id"] + 1,
    }


def build_messages_node(state: AgentState) -> AgentState:
    messages = build_messages(
        state["screenshot_path"],
        state["instruction"],
        state["history"],
        MODEL_NAME,
    )

    return {
        **state,
        "messages": messages,
    }


def plan_node(state: AgentState) -> AgentState:
    output_text, _, _ = state["vllm"].predict_mm(state["messages"])
    print(output_text)

    return {
        **state,
        "output_text": output_text,
        "error_message": None,
    }


def parse_node(state: AgentState) -> AgentState:
    action_list = extract_tool_calls(state["output_text"] or "")
    error_message = None
    if not action_list:
        error_message = "No valid tool_call found in model output"
        print(f"[WARN] {error_message}")
    if (state["output_text"] or "").strip() == "Error calling LLM":
        error_message = "LLM call failed after retries"
        print(f"[ERROR] {error_message}")

    return {
        **state,
        "action_list": action_list,
        "error_message": error_message,
        "stop_flag": state["stop_flag"] or error_message is not None,
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

    if state["error_message"]:
        return {
            **state,
            "stop_flag": stop_flag,
        }

    executed_any = False
    for action_id, action in enumerate(state["action_list"]):
        validation_error = validate_action(action)
        if validation_error:
            print(f"[WARN] Skipping invalid action: {validation_error}")
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

        print(f"[INFO] Executing action: {action_parameter}")
        executed_any = True

        should_stop = execute_action(
            state["computer_tools"],
            action_parameter,
        )

        if should_stop:
            stop_flag = True
            break

        annotate_screenshot(
            state["screenshot_path"],
            action_parameter,
            os.path.join(
                state["output_dir"],
                f"anno_{state['safe_instruction']}_{state['step_id']}_{action_id}.png",
            ),
        )

    if state["action_list"] and not executed_any:
        print("[WARN] No executable action remained after validation")
        stop_flag = True

    return {
        **state,
        "stop_flag": stop_flag,
    }


def update_history_node(state: AgentState) -> AgentState:
    history = list(state["history"])

    history.append({
        "output": state["output_text"],
        "image": state["screenshot_path"],
    })

    time.sleep(POST_ACTION_WAIT_SECONDS)

    return {
        **state,
        "history": history,
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

    app = build_gui_owl_graph()

    initial_state: AgentState = {
        "instruction": instruction,
        "safe_instruction": safe_instruction,
        "output_dir": output_dir,
        "max_steps": max_steps,
        "step_id": 0,

        "history": [],
        "stop_flag": False,

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

    app.invoke(initial_state)


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
