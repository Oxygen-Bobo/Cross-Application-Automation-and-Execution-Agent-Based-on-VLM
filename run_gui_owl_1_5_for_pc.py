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
)

from typing import Any, Dict, List, Optional, TypedDict
from langgraph.graph import StateGraph, START, END

API_KEY = "sk-ws-H.RPEIMEH.dBrN.MEQCIFzV2Scc_QsDTvs1a2WVrw2t1TeMMNfqH5qi6Gqof5arAiAzllm-aN8hRipTNj6E8MLreHHil0ThualYvWngnH4qog"
BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
MODEL_NAME = "qwen3-vl-plus"
MAX_STEPS = 50


def rescale_coordinates(action_parameter, resized_width, resized_height):
    """
    将bbox 1000×1000坐标转换为屏幕尺寸的真实坐标
    """
    for key in ("coordinate", "coordinate1", "coordinate2"):
        if key in action_parameter:
            action_parameter[key][0] = int(
                action_parameter[key][0] / 1000 * resized_width
            )
            action_parameter[key][1] = int(
                action_parameter[key][1] / 1000 * resized_height
            )


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
    elif action_type == "open app":
        computer_tools.open_app(action_parameter["app_name"])
    elif action_type in ("key", "hotkey"):
        computer_tools.press_key(action_parameter["keys"])
    elif action_type == "type":
        computer_tools.type(action_parameter["text"])
    elif action_type == "drag":
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

    resized_width: Optional[int]
    resized_height: Optional[int]

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

    return {
        **state,
        "screenshot_path": screen_shot,
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
    }


def parse_node(state: AgentState) -> AgentState:
    action_list = extract_tool_calls(state["output_text"] or "")

    return {
        **state,
        "action_list": action_list,
    }


def resize_node(state: AgentState) -> AgentState:
    dummy_image = Image.open(state["screenshot_path"])

    resized_height, resized_width = smart_resize(
        dummy_image.height,
        dummy_image.width,
        factor=16,
        min_pixels=3136,
        max_pixels=1003520 * 200,
    )

    return {
        **state,
        "resized_height": resized_height,
        "resized_width": resized_width,
    }


def act_node(state: AgentState) -> AgentState:
    stop_flag = state["stop_flag"]

    for action_id, action in enumerate(state["action_list"]):
        action_parameter = action["arguments"]

        rescale_coordinates(
            action_parameter,
            state["resized_width"],
            state["resized_height"],
        )

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

    time.sleep(2)

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

        "capture_ok": False,

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
