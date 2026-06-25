# 🧠 Cross-Application Automation and Execution Agent Based on VLM 设计文档

## 📘 1. 文档概述

本文档用于说明 **Cross-Application Automation and Execution Agent Based on VLM** 项目的整体设计、核心架构、模块职责、运行流程、关键技术方案、安全边界以及后续可扩展方向。

该项目是一个基于视觉语言模型（VLM）的桌面 GUI 自动化 Agent。用户输入自然语言任务后，系统会截取当前桌面画面，将截图和历史操作上下文发送给视觉语言模型，由模型判断下一步应执行的鼠标、键盘或等待动作，再通过 PyAutoGUI 执行动作，并持续循环，直到任务完成或达到最大步数。

---

## 🎯 2. 设计目标

项目的核心目标是构建一个能够跨应用执行桌面任务的视觉 Agent，使用户可以通过自然语言控制电脑完成 GUI 操作。

主要设计目标如下：

1. **自然语言驱动**
   - 用户无需编写脚本，只需输入自然语言任务。
   - 系统自动理解任务意图并拆解为具体 GUI 操作。

2. **基于截图的通用 GUI 理解**
   - 不依赖特定应用 API。
   - 不依赖 DOM、Accessibility Tree 或固定控件 ID。
   - 通过视觉语言模型理解当前屏幕状态。

3. **跨应用自动化**
   - 支持浏览器、桌面软件、系统窗口等不同 GUI 环境。
   - 通过鼠标、键盘、快捷键、滚动、拖拽等通用动作完成操作。

4. **可观察、可追踪**
   - 每一步执行前保存截图。
   - 每一步执行后生成标注截图。
   - 支持在桌面端查看任务运行过程与历史记录。

5. **多运行模式**
   - 支持 Python 终端模式。
   - 支持 Electron 桌面应用模式。
   - 支持 Bridge 模式用于前后端通信和调试。

---

## 🏗️ 3. 总体架构

系统采用“观察—规划—执行—反馈”的闭环架构。

```text
用户
 │
 │ 自然语言任务
 ▼
Electron 桌面端 / Python 终端入口
 │
 │ 任务参数、API 配置
 ▼
agent_bridge.py / run_gui_owl_1_5_for_pc.py
 │
 │ LangGraph 状态机
 ▼
Observe → Build Messages → Plan → Parse → Resize → Act → Update History
 │                                                        │
 │ 桌面截图                                                │ PyAutoGUI
 ▼                                                        ▼
视觉语言模型 / OpenAI-compatible API                桌面应用、网页、系统 UI
```

整体流程如下：

1. 用户输入自然语言任务。
2. 系统截取当前屏幕画面。
3. 将截图、用户任务、历史步骤构造成多模态消息。
4. 调用视觉语言模型生成下一步操作。
5. 解析模型返回的工具调用。
6. 将模型输出坐标转换为真实屏幕坐标。
7. 使用 PyAutoGUI 执行鼠标或键盘动作。
8. 保存执行结果和标注截图。
9. 重复上述过程，直到任务完成或达到最大步数。

---

## 🧰 4. 技术栈

### 🐍 4.1 Python 核心侧

| 技术 | 作用 |
|---|---|
| Python 3.10+ | 核心运行环境 |
| PyAutoGUI | 执行鼠标、键盘、截图等桌面操作 |
| Pyperclip | 支持文本粘贴，提升中文输入稳定性 |
| Pillow | 图片处理、截图标注 |
| NumPy | 图片尺寸和坐标处理 |
| OpenAI Python SDK | 调用 OpenAI-compatible 视觉模型接口 |
| LangGraph | 构建 Agent 状态机 |
| Tkinter | 用户交互弹窗 |

### 🖥️ 4.2 桌面端

| 技术 | 作用 |
|---|---|
| Electron | 桌面应用容器 |
| TypeScript | 主进程和渲染进程开发语言 |
| SolidJS | 前端 UI 框架 |
| Tailwind CSS | 样式系统 |
| Electron IPC | 前后端通信 |
| Electron safeStorage | 本地 API Key 加密存储 |
| Node.js child_process | 启动和管理 Python 子进程 |

---

## 🧩 5. 核心模块设计

### 🐍 5.1 Python 核心模块

#### 🚀 5.1.1 `run_gui_owl_1_5_for_pc.py`

该文件是 Python 核心 Agent 的主要入口，负责：

- 定义 Agent 状态结构。
- 构建 LangGraph 状态机。
- 实现观察、规划、解析、执行、更新历史等节点。
- 封装动作执行逻辑。
- 提供终端交互模式入口。

主要职责包括：

```text
任务输入
  ↓
初始化工具和模型
  ↓
构建 Agent 状态
  ↓
运行 LangGraph
  ↓
执行 GUI 自动化任务
```

核心函数包括：

| 函数 | 说明 |
|---|---|
| `build_gui_owl_graph()` | 构建 LangGraph 状态机 |
| `run_agent()` | 执行一次完整任务 |
| `execute_action()` | 根据模型输出执行具体动作 |
| `rescale_coordinates()` | 坐标归一化转换 |
| `main()` | 终端交互入口 |

#### 🛠️ 5.1.2 `utils.py`

`utils.py` 提供核心工具函数和基础类，主要包括：

| 功能 | 说明 |
|---|---|
| 截图 | 获取当前屏幕画面 |
| 图片缩放 | 将截图调整为适合模型输入的尺寸 |
| 图片编码 | 将本地图片转为 base64 data URI |
| 消息构造 | 构造 OpenAI-compatible 多模态消息 |
| 模型调用 | 封装视觉模型请求 |
| 工具调用解析 | 从模型文本中解析 `<tool_call>` JSON |
| 截图标注 | 在截图中绘制点击点或拖拽箭头 |
| 桌面操作 | 封装鼠标、键盘、滚动、拖拽等操作 |

主要类和函数：

| 名称 | 说明 |
|---|---|
| `ComputerTools` | 封装 PyAutoGUI 操作 |
| `GUIOwlWrapper` | 封装视觉语言模型调用 |
| `build_messages()` | 构建模型输入消息 |
| `extract_tool_calls()` | 解析模型工具调用 |
| `smart_resize()` | 智能调整图片尺寸 |
| `annotate_screenshot()` | 生成动作标注截图 |
| `get_output_dir()` | 获取截图输出目录 |

#### 🌉 5.1.3 `agent_bridge.py`

`agent_bridge.py` 是 Electron 桌面端与 Python Agent 之间的桥接层。

主要职责：

1. 接收 Electron 主进程传入的任务参数。
2. 从环境变量中读取 API Key。
3. 导入 Python 核心 Agent 模块。
4. 创建模型客户端和工具实例。
5. 调用 `run_agent()` 执行任务。
6. 将运行过程通过 JSON Lines 输出给 Electron。

Bridge 的设计价值：

- 避免 Electron 直接依赖核心 Python 脚本的终端输入逻辑。
- 支持桌面端动态传入模型配置。
- 将 Python 运行日志结构化，方便前端展示。
- 避免在命令行参数中暴露 API Key。

### 🖥️ 5.2 Electron 桌面端模块

#### 🪟 5.2.1 `desktop/src/main/main.ts`

Electron 主进程入口，负责：

- 创建主窗口。
- 注册 IPC 处理器。
- 注册本地截图文件协议。
- 管理悬浮球窗口。
- 管理历史记录事件。
- 连接渲染进程与 Python Runner。

主要职责：

```text
创建桌面窗口
  ↓
注册 IPC
  ↓
接收前端任务请求
  ↓
调用 Python Runner
  ↓
转发 Python Agent 事件
```

#### 🏃 5.2.2 `desktop/src/main/python-runner.ts`

该模块负责启动和管理 Python Agent 子进程。

主要职责：

| 功能 | 说明 |
|---|---|
| 启动 Agent | 使用 `spawn()` 启动 `agent_bridge.py` |
| 停止 Agent | 发送终止信号停止 Python 进程 |
| 状态管理 | 判断当前是否已有任务运行 |
| stdout 解析 | 按行解析 Python 输出 |
| JSON 事件转发 | 将 JSON Lines 转发给前端 |
| stderr 处理 | 将错误日志转发给前端 |
| 环境变量注入 | 通过 `AGENT_API_KEY` 传递密钥 |

启动 Python 时会传入：

```text
--instruction
--base-url
--model-name
--max-steps
--output-dir
```

同时设置：

```text
AGENT_API_KEY
PYTHONIOENCODING=utf-8
PYTHONUTF8=1
```

#### 🔐 5.2.3 `desktop/src/main/config-store.ts`

该模块负责桌面端配置管理。

主要职责：

| 功能 | 说明 |
|---|---|
| 保存 API 配置 | 保存 Base URL、模型名、最大重试次数等 |
| 加密 API Key | 使用 Electron safeStorage 加密存储 |
| 脱敏显示 | 不向前端返回明文密钥 |
| 连接测试 | 调用模型服务 `/models` 接口验证配置 |
| 配置重置 | 恢复默认配置 |

配置项包括：

```text
baseUrl
modelName
apiKey
maxRetries
maxSteps
```

安全设计：

- 前端不能直接读取明文 API Key。
- API Key 只在启动 Python 进程时由主进程解密。
- 错误信息中会对密钥进行脱敏处理。

---

## 🔄 6. Agent 状态机设计

系统使用 LangGraph 构建状态机。

### 📦 6.1 状态结构

Agent 状态包含以下关键字段：

| 字段 | 说明 |
|---|---|
| `instruction` | 用户输入的任务指令 |
| `output_dir` | 截图和标注图输出目录 |
| `max_steps` | 最大执行步数 |
| `step` | 当前执行步数 |
| `history` | 历史步骤信息 |
| `stop_flag` | 是否停止任务 |
| `screenshot_path` | 当前步骤截图路径 |
| `messages` | 发送给模型的消息 |
| `model_output` | 模型原始输出 |
| `tool_calls` | 解析出的工具调用 |
| `resized_width` | 模型输入图像宽度 |
| `resized_height` | 模型输入图像高度 |
| `screenshot_ok` | 截图是否成功 |
| `computer` | 桌面操作工具实例 |
| `model` | 视觉模型调用实例 |

### 🔗 6.2 状态机节点

```text
START
  ↓
observe
  ↓
build_messages
  ↓
plan
  ↓
parse
  ↓
resize
  ↓
act
  ↓
update_history
  ↓
observe / END
```

各节点职责如下：

| 节点 | 职责 |
|---|---|
| `observe_node` | 截取当前屏幕并保存截图 |
| `build_messages_node` | 构造模型输入消息 |
| `plan_node` | 调用视觉语言模型生成下一步动作 |
| `parse_node` | 解析模型输出中的工具调用 |
| `resize_node` | 计算模型输入图片尺寸 |
| `act_node` | 执行模型指定的 GUI 动作 |
| `update_history_node` | 更新历史记录和当前步数 |
| `route_after_step` | 判断继续循环还是结束任务 |

### 🧭 6.3 状态流转逻辑

```text
observe_node
  ↓
如果截图成功，进入 build_messages_node
如果截图失败，任务结束

build_messages_node
  ↓
将任务、历史步骤、当前截图组装为模型输入

plan_node
  ↓
调用视觉语言模型

parse_node
  ↓
从模型输出中解析工具调用

resize_node
  ↓
计算截图缩放尺寸，用于坐标转换

act_node
  ↓
执行点击、输入、滚动、拖拽等操作

update_history_node
  ↓
记录模型输出和截图
判断是否继续下一步
```

结束条件包括：

1. 模型返回 `finished`、`done`、`stop` 等结束动作。
2. 用户或系统触发停止标志。
3. 当前步数达到 `max_steps`。
4. 截图失败或模型调用失败。
5. 无法解析出有效工具调用。

---

## 🖼️ 7. 多模态消息设计

### 📨 7.1 消息构造流程

```text
当前屏幕截图
  ↓
smart_resize()
  ↓
build_messages()
  ↓
convert_messages_format_to_openaiurl()
  ↓
base64 data URI
  ↓
OpenAI-compatible Chat Completions API
```

模型输入内容包括：

1. 系统提示词。
2. 用户任务指令。
3. 最近若干步历史模型输出。
4. 最近若干步历史截图。
5. 当前桌面截图。

### 🕘 7.2 历史上下文设计

系统会保留最近若干步历史，默认历史窗口为 4。

历史信息包括：

- 上一步模型输出。
- 上一步执行的工具调用。
- 上一步截图。
- 上一步标注截图。

这样可以帮助模型理解：

- 当前任务已经完成到哪一步。
- 前一步点击或输入了什么。
- 当前界面变化是否符合预期。
- 下一步应该继续执行什么操作。

### 🖼️ 7.3 图片输入格式

图片会被转换为 OpenAI-compatible 多模态格式：

```json
{
  "type": "image_url",
  "image_url": {
    "url": "data:image/png;base64,..."
  }
}
```

这种设计使系统可以对接支持视觉输入的 OpenAI-compatible 模型服务。

---

## 🧪 8. 工具调用协议设计

### 📐 8.1 工具调用格式

系统要求模型以如下格式输出动作：

```xml
<tool_call>
{
  "name": "computer_use",
  "arguments": {
    "action": "click",
    "coordinate": [500, 300]
  }
}
</tool_call>
```

其中：

- `name` 固定为 `computer_use`。
- `arguments.action` 表示动作类型。
- `arguments.coordinate` 表示目标坐标。
- 坐标采用 0–1000 归一化坐标系。

### 🕹️ 8.2 支持的动作类型

| 动作 | 说明 |
|---|---|
| `click` / `left_click` | 单击 |
| `double_click` | 双击 |
| `triple_click` | 三击 |
| `right_click` | 右键点击 |
| `middle_click` | 中键点击 |
| `mouse_move` | 移动鼠标 |
| `type` | 输入文本 |
| `hotkey` / `key` | 执行快捷键或按键 |
| `scroll` | 滚动页面 |
| `drag` | 拖拽 |
| `open_app` | 打开应用 |
| `wait` | 等待 |
| `answer` | 输出回答 |
| `done` / `stop` / `finished` | 结束任务 |
| `call_user` / `interact` | 调用用户确认或交互 |

### ⚙️ 8.3 动作执行分发

动作执行由 `execute_action()` 负责分发：

```text
模型工具调用
  ↓
解析 action
  ↓
坐标转换
  ↓
调用 ComputerTools
  ↓
执行 PyAutoGUI 动作
  ↓
生成标注截图
```

示例：

```text
click       → ComputerTools.left_click()
type        → ComputerTools.type()
hotkey      → ComputerTools.press_key()
scroll      → ComputerTools.scroll()
drag        → ComputerTools.left_click_drag()
wait        → time.sleep()
call_user   → 弹窗等待用户输入
finished    → 设置 stop_flag
```

---

## 📍 9. 坐标系统设计

### 🧭 9.1 坐标规范

模型输出坐标采用 0–1000 的归一化坐标系。

例如：

```json
{
  "coordinate": [500, 500]
}
```

表示点击图片中心位置。

### 🔢 9.2 坐标转换

坐标转换公式如下：

```text
real_x = normalized_x / 1000 * image_width
real_y = normalized_y / 1000 * image_height
```

如果模型输出拖拽动作：

```json
{
  "coordinate1": [100, 200],
  "coordinate2": [800, 200]
}
```

系统会分别转换起点和终点坐标。

### ✅ 9.3 坐标设计优点

这种设计有以下优点：

1. 模型输出不依赖具体屏幕分辨率。
2. 不同尺寸截图可以复用同一坐标协议。
3. 便于视觉模型理解和输出。
4. 有利于桌面端展示和调试。

### ⚠️ 9.4 坐标设计风险

可能出现以下问题：

1. 高 DPI 缩放导致实际点击位置偏移。
2. 多显示器场景下坐标映射不准确。
3. 截图尺寸与真实屏幕尺寸不一致。
4. 窗口移动后历史坐标失效。
5. 系统缩放比例影响 PyAutoGUI 坐标。

改进建议：

- 增加 DPI 感知。
- 增加多显示器坐标映射。
- 在执行点击前进行目标区域二次确认。
- 对关键动作增加用户确认。
- 记录真实屏幕尺寸和截图尺寸的映射关系。

---

## 📸 10. 截图与标注设计

### 🖼️ 10.1 截图流程

每一步开始时，系统会截取当前桌面截图。

```text
observe_node
  ↓
ComputerTools.screenshot()
  ↓
保存当前截图
  ↓
传入模型
```

截图用于：

- 模型理解当前 GUI 状态。
- 历史步骤回放。
- 用户调试。
- 桌面端可视化展示。

### 🖍️ 10.2 标注截图

执行动作后，系统会生成标注截图。

标注规则：

| 动作类型 | 标注方式 |
|---|---|
| 点击类动作 | 在点击位置绘制红点 |
| 拖拽动作 | 从起点到终点绘制红色箭头 |
| 输入动作 | 通常不标注坐标 |
| 等待动作 | 通常不标注坐标 |

标注截图可以帮助用户判断：

- 模型点击的位置是否正确。
- 坐标转换是否准确。
- 动作执行是否符合预期。
- 失败步骤发生在哪里。

---

## 🔌 11. Electron 与 Python 通信设计

### 📡 11.1 通信方式

Electron 主进程通过 Node.js `child_process.spawn()` 启动 Python Bridge。

```text
Electron Renderer
  ↓ IPC
Electron Main
  ↓ spawn
agent_bridge.py
  ↓ import
Python Core Agent
```

Python Bridge 通过 stdout 输出 JSON Lines。

Electron 主进程逐行读取 stdout，并将事件转发给前端。

### 🧾 11.2 JSON Lines 事件

Python 输出格式示例：

```json
{"type": "run_started", "instruction": "打开记事本"}
{"type": "step_started", "step": 1}
{"type": "screenshot", "path": "xxx.png"}
{"type": "tool_call", "action": "click", "coordinate": [500, 300]}
{"type": "run_finished", "status": "success"}
```

这种设计的优点：

1. 易于流式处理。
2. 前端可以实时展示运行状态。
3. 日志和结构化事件可以共存。
4. 便于调试和历史记录保存。

### 🔑 11.3 API Key 传递

API Key 不通过命令行参数传递，而是通过环境变量传入 Python：

```text
AGENT_API_KEY=sk-xxx
```

优点：

- 避免命令行参数被系统进程列表暴露。
- 与桌面端加密配置存储结合更安全。
- Python Bridge 可以统一从环境变量读取密钥。

---

## 🛡️ 12. 配置与安全设计

### ⚙️ 12.1 配置管理

桌面端配置包括：

```text
baseUrl
modelName
apiKey
maxRetries
maxSteps
```

配置管理要求：

1. API Key 必须加密存储。
2. 前端不能读取明文 API Key。
3. 配置展示时只显示脱敏密钥。
4. 连接测试时需要过滤错误信息中的敏感内容。

### 🚧 12.2 安全边界

由于该项目可以直接控制用户电脑，必须重视安全边界。

建议增加以下安全机制：

1. **敏感动作确认**
   - 付款
   - 转账
   - 删除文件
   - 发送消息
   - 提交表单
   - 批量操作

2. **应用白名单**
   - 仅允许 Agent 操作指定应用。
   - 避免误操作系统设置、财务软件、聊天软件等敏感应用。

3. **任务级权限控制**
   - 普通任务可自动执行。
   - 高风险任务必须人工确认。
   - 禁止无人值守执行不可逆操作。

4. **紧急停止机制**
   - 保留 PyAutoGUI failsafe。
   - 提供桌面端停止按钮。
   - 支持快捷键中断任务。

5. **日志审计**
   - 记录每一步截图。
   - 记录模型输出。
   - 记录执行动作。
   - 记录用户确认行为。

---

## 🧯 13. 失败处理设计

### ❗ 13.1 可能失败场景

| 失败场景 | 可能原因 |
|---|---|
| 📸 截图失败 | 权限不足、桌面环境异常 |
| 🤖 模型调用失败 | API Key 错误、网络异常、接口不兼容 |
| 🧩 工具调用解析失败 | 模型输出格式不符合协议 |
| 📍 点击位置错误 | DPI、多屏、窗口变化导致坐标偏移 |
| ✍️ 输入失败 | 焦点丢失、输入法状态异常 |
| ⏳ 页面未加载完成 | 等待时间不足 |
| 🔢 任务超步数 | 模型规划失败或任务过复杂 |

### 🩺 13.2 当前处理方式

当前系统主要通过以下方式处理失败：

1. 截图失败时终止任务。
2. 模型调用异常时输出错误。
3. 无法解析工具调用时结束或等待下一步。
4. 达到最大步数时停止执行。
5. 对 `wait` 动作进行延迟等待。
6. 对 `call_user` 动作弹窗请求人工介入。

### ✨ 13.3 建议增强方式

建议后续增加：

1. 工具调用 JSON Schema 校验。
2. 模型输出格式错误时自动重试。
3. 点击前进行目标区域二次检测。
4. 页面加载失败时自动等待或刷新。
5. 动作执行异常时生成错误事件。
6. 对连续失败步骤进行熔断。
7. 支持人工接管后继续执行。

---

## 🧬 14. 可扩展设计

### 🤖 14.1 替换视觉模型

由于系统使用 OpenAI-compatible API，可以替换为其他支持视觉输入的模型。

替换模型时需要保证：

1. 支持图片输入。
2. 支持 Chat Completions 或兼容接口。
3. 能稳定遵循工具调用格式。
4. 能输出 0–1000 归一化坐标。
5. 支持足够长的上下文窗口。

### ➕ 14.2 新增动作类型

新增动作需要修改以下位置：

1. 系统提示词中的工具说明。
2. 工具调用解析逻辑。
3. `execute_action()` 动作分发逻辑。
4. `ComputerTools` 中的具体执行方法。
5. 前端工具调用展示逻辑。

示例新增动作：

| 动作 | 说明 |
|---|---|
| `screenshot_region` | 截取指定区域 |
| `ocr_region` | 对指定区域 OCR |
| `focus_window` | 聚焦指定窗口 |
| `close_window` | 关闭当前窗口 |
| `confirm_action` | 请求用户确认敏感动作 |

### 👁️ 14.3 增加结构化感知能力

当前系统主要基于截图理解界面。后续可增加：

1. OCR 文字识别。
2. Windows UI Automation。
3. 浏览器 DOM 辅助信息。
4. 当前窗口标题。
5. 当前活动应用名称。
6. 鼠标当前位置。
7. 剪贴板状态。

这样可以提升模型对 GUI 的理解能力，减少仅依赖截图带来的误判。

### ↩️ 14.4 增加回滚能力

当前系统尚不支持真正的 undo/redo。

后续可设计动作日志：

```json
{
  "step": 3,
  "action": "type",
  "content": "hello",
  "before_state": "...",
  "after_state": "...",
  "undo_action": "hotkey:ctrl+z"
}
```

可回滚动作示例：

| 原动作 | 可能回滚方式 |
|---|---|
| 输入文本 | `Ctrl + Z` |
| 拖拽文件 | 反向拖拽或撤销 |
| 删除内容 | `Ctrl + Z` |
| 打开窗口 | 关闭窗口 |
| 页面跳转 | 浏览器后退 |

但并非所有操作都可安全回滚，因此需要结合人工确认和操作风险分级。

---

## 🌊 15. 数据流设计

### 🚀 15.1 任务执行数据流

```text
用户输入任务
  ↓
前端提交任务
  ↓
Electron 主进程接收任务
  ↓
启动 Python Bridge
  ↓
Bridge 初始化 Agent
  ↓
Agent 截图
  ↓
构造模型输入
  ↓
调用 VLM
  ↓
解析工具调用
  ↓
执行 GUI 动作
  ↓
生成截图和事件
  ↓
返回前端展示
```

### 🧷 15.2 配置数据流

```text
用户填写配置
  ↓
前端发送 config:set
  ↓
Electron 主进程保存配置
  ↓
API Key 使用 safeStorage 加密
  ↓
启动任务时解密 API Key
  ↓
通过环境变量传给 Python Bridge
```

### 📷 15.3 截图数据流

```text
PyAutoGUI 截图
  ↓
保存到 output_dir
  ↓
用于模型输入
  ↓
动作执行后生成标注图
  ↓
通过 agent-file 协议给前端展示
  ↓
写入历史记录
```

---

## ⚠️ 16. 主要风险与改进建议

| 风险/问题 | 影响 | 改进建议 |
|---|---|---|
| 🔑 硬编码 API Key | 密钥泄露风险极高 | 使用环境变量或加密配置存储 |
| 📍 坐标漂移 | 点击错误位置 | 增加 DPI 感知和多屏映射 |
| 🤖 模型输出不稳定 | 🧩 工具调用解析失败 | 使用 JSON Schema 校验和自动重试 |
| 🛡️ 缺少权限控制 | 可能执行敏感误操作 | 增加动作权限和人工确认 |
| ↩️ 无真正回滚 | 错误动作难恢复 | 实现动作日志和可撤销操作 |
| 🖥️ 依赖当前屏幕状态 | 用户干扰会导致失败 | 检测窗口焦点变化并暂停任务 |
| 📸 仅基于截图理解 | 对隐藏状态理解不足 | 结合 OCR、UI Automation、DOM 信息 |
| 🌀 模型幻觉 | 可能点击不存在的目标 | 增加动作前视觉验证 |
| ⏳ 页面加载不稳定 | 过早执行下一步 | 增加等待策略和状态检测 |
| 🕘 历史上下文过短 | 长任务容易丢失目标 | 增加任务摘要和长期记忆机制 |

---

## 🛣️ 17. 后续演进方向

### 🧱 17.1 工程稳定性

- 增加单元测试。
- 增加集成测试。
- 增加模型调用重试机制。
- 增加任务失败诊断报告。
- 增加日志分级和日志导出。

### 🛡️ 17.2 安全能力

- 增加敏感动作确认机制。
- 增加应用白名单。
- 增加任务权限配置。
- 增加操作风险分级。
- 增加自动停止策略。

### 🤖 17.3 Agent 能力

- 增加 OCR。
- 增加 UI Automation。
- 增加 DOM 辅助。
- 增加窗口识别。
- 增加任务计划器。
- 增加失败自恢复策略。

### 🎨 17.4 桌面端体验

- 增加步骤时间线。
- 增加截图对比。
- 增加一键复盘。
- 增加任务模板。
- 增加任务历史搜索。
- 增加手动接管后继续运行。

---

## 🎉 18. 总结

该项目实现了一个完整的 VLM GUI Agent 原型，具备以下核心能力：

1. 通过自然语言接收用户任务。
2. 通过截图感知当前桌面状态。
3. 通过视觉语言模型规划下一步动作。
4. 通过 PyAutoGUI 执行跨应用 GUI 操作。
5. 通过 LangGraph 管理 Agent 状态流转。
6. 通过 Electron 提供桌面端可视化界面。
7. 通过 Python Bridge 实现前后端解耦通信。

整体架构清晰，具备较好的扩展性，适合作为视觉桌面自动化 Agent 的研究原型和工程基础。

若要进一步用于生产环境，建议优先完善以下能力：

1. API Key 安全管理。
2. 坐标系统鲁棒性。
3. 敏感动作权限控制。
4. 模型输出结构化校验。
5. 任务失败恢复机制。
6. 人工确认与人工接管能力。
7. 操作日志审计和回放能力。
