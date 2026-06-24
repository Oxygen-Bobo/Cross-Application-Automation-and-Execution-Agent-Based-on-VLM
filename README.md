<h1 align="center">🖥️ Desktop Agent GUI Automation</h1>

<p align="center">
  <strong>基于 Qwen-VL、LangGraph、PyAutoGUI 与 Electron 的桌面 GUI 自动化智能体</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10%2B-blue?logo=python" alt="Python">
  <img src="https://img.shields.io/badge/LangGraph-Agent-orange" alt="LangGraph">
  <img src="https://img.shields.io/badge/Qwen-VL-purple" alt="Qwen VL">
  <img src="https://img.shields.io/badge/Electron-Desktop-47848F?logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows" alt="Windows">
</p>

---

## 📖 项目简介

Qwen-Agent Desktop GUI Automation 是一个基于视觉语言模型（VLM）的桌面操作智能体。

用户只需要输入自然语言任务，Agent 就可以：

1. 截取当前桌面画面；
2. 使用视觉模型理解界面内容；
3. 规划下一步鼠标或键盘操作；
4. 调用 PyAutoGUI 执行动作；
5. 再次观察界面并持续执行；
6. 直到任务完成或达到最大步骤数。

项目使用 **LangGraph StateGraph** 管理完整的多步骤执行流程，并同时提供：

- 💻 终端交互模式
- 🪟 Electron 桌面应用模式
- 🔌 JSON Lines Bridge 通信模式

---

## ✨ 核心能力

| 能力 | 说明 |
|---|---|
| 👁️ 桌面视觉理解 | 使用 Qwen-VL 等视觉语言模型分析桌面截图 |
| 🧠 自主任务规划 | 根据用户目标和当前界面动态决定下一步操作 |
| 🖱️ 鼠标操作 | 支持点击、双击、右键、拖拽和滚动 |
| ⌨️ 键盘操作 | 支持文本输入、快捷键和剪贴板操作 |
| 🔁 多步骤执行 | 持续执行“观察 → 规划 → 操作 → 再观察”循环 |
| 🧩 LangGraph 流程管理 | 使用 StateGraph 管理 Agent 状态与执行节点 |
| 🖼️ 坐标自动换算 | 将模型输出的 0～1000 坐标映射为实际屏幕坐标 |
| 📡 实时状态输出 | Electron 模式通过 JSON Lines 接收执行日志和状态 |
| 🌏 中文支持 | 支持中文任务、中文路径和 Windows UTF-8 输出 |
| ⚙️ 模型配置 | 支持自定义 API Key、Base URL 和模型名称 |

---

## 🎯 使用示例

```text
上网查找今天的金价信息，并总结成报告发送给微信联系人李浩瑜
```

```text
打开浏览器，搜索 LangGraph，进入官方文档，将信息总结成word文档
```

```text
打开记事本，输入“Hello Qwen Agent”，保存到桌面并以eamil形式发送给xxx@xx.com
```


---

## 🔄 LangGraph 执行流程

| 节点 | 作用 |
|---|---|
| `observe` | 获取当前桌面截图 |
| `build_messages` | 构建文本、截图和历史记录组成的多模态消息 |
| `plan` | 调用视觉语言模型生成下一步操作 |
| `parse` | 提取模型返回的动作和参数 |
| `resize` | 将归一化坐标转换为实际像素坐标 |
| `act` | 使用 PyAutoGUI 执行动作 |
| `update_history` | 保存当前步骤结果并进入下一轮 |

---

## 🚀 运行方式

项目提供三种运行方式。

| 模式 | 入口 | 适用场景 |
|---|---|---|
| 💻 终端交互模式 | `run_gui_owl_1_5_for_pc.py` | 快速调试 Agent 核心能力 |
| 🪟 Electron 桌面模式 | `desktop/` | 图形化操作与实时状态展示 |
| 🔌 Bridge 调试模式 | `agent_bridge.py` | 调试 Electron 与 Python 通信 |

---

## 1️⃣ 终端交互模式

运行：

```powershell
python run_gui_owl_1_5_for_pc.py
```

启动后，在终端输入任务：

```text
请输入任务：打开记事本并输入测试内容
```

终端入口当前从文件顶部读取模型配置：

```python
API_KEY = "your-api-key"
BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
MODEL_NAME = "qwen3-vl-plus"
```

> ⚠️ 不要将真实 API Key 提交到 GitHub。

---

## 2️⃣ Electron 桌面模式

进入桌面应用目录：

```powershell
cd desktop
```

安装依赖：

```powershell
npm install
```

启动开发环境：

```powershell
npm run dev
```

构建生产版本：

```powershell
npm run build
```

Electron 会自动启动 `agent_bridge.py`，并通过 JSON Lines 接收 Python Agent 的实时输出。

API Key 通过环境变量传递：

```powershell
$env:AGENT_API_KEY = "sk-xxx"
npm run dev
```

---

## 3️⃣ Bridge 手动调试

```powershell
$env:AGENT_API_KEY = "sk-xxx"

python agent_bridge.py `
  --instruction "打开浏览器并搜索 LangGraph" `
  --base-url "https://dashscope.aliyuncs.com/compatible-mode/v1" `
  --model-name "qwen3-vl-plus" `
  --output-dir "C:\Users\YourName\Desktop\anno" `
  --max-steps 50
```

### 参数说明

| 参数 | 是否必需 | 说明 |
|---|---:|---|
| `--instruction` | ✅ | 需要 Agent 执行的任务 |
| `--base-url` | ✅ | OpenAI 兼容 API 地址 |
| `--model-name` | ✅ | 视觉语言模型名称 |
| `--output-dir` | ❌ | 截图和标注结果目录 |
| `--max-steps` | ❌ | 最大执行步数 |
| `AGENT_API_KEY` | ✅ | 通过环境变量传递的 API Key |

---

## 📡 JSON Lines 通信

`agent_bridge.py` 会将运行状态持续输出为一行一个 JSON 对象。

示例：

```json
{"type":"status","message":"Agent started"}
{"type":"screenshot","path":"C:\\output\\step_1.png"}
{"type":"action","action":"click","x":520,"y":460}
{"type":"log","message":"Action completed successfully"}
{"type":"completed","message":"Task completed"}
```

Electron 主进程逐行读取这些数据，并将其展示在前端执行时间线中。

> `agent_bridge.py` 会重定向 Python 标准输出。需要输出原始调试信息时，应使用 `sys.__stdout__`。

---

## 📁 项目结构

```text
Qwen-Agent/
├── run_gui_owl_1_5_for_pc.py    # 终端交互入口
├── agent_bridge.py               # Electron 与 Python 的通信桥
├── utils.py                      # Agent、LangGraph、VLM 和动作执行逻辑
│
├── desktop/                      # Electron 桌面应用
│   ├── package.json
│   ├── src/
│   │   ├── main/
│   │   │   └── python-runner.ts  # 启动和管理 Python 子进程
│   │   └── renderer/             # 桌面应用前端界面
│   └── ...
│
├── screenshots/                  # Agent 截图目录
├── annotations/                  # 标注结果目录
└── README.md
```

---

## 🧩 核心模块

| 文件 / 模块 | 职责 |
|---|---|
| `run_gui_owl_1_5_for_pc.py` | 提供终端 REPL，读取用户输入并运行 Agent |
| `agent_bridge.py` | 接收 Electron 参数，启动 Agent 并输出 JSON Lines |
| `utils.py` | 包含 LangGraph、截图、模型调用、坐标转换和动作执行 |
| `GUIOwlWrapper` | 封装 OpenAI 兼容的视觉模型 API |
| `build_messages()` | 构建包含任务、截图和历史信息的多模态消息 |
| `smart_resize()` | 调整截图尺寸，使其符合视觉模型输入要求 |
| `rescale_coordinates()` | 将模型坐标转换为实际屏幕坐标 |
| `run_agent()` | 执行完整的 Agent 状态图 |
| `python-runner.ts` | Electron 主进程中的 Python 子进程管理器 |

---

## 🤖 模型调用流程

```text
桌面截图
   ↓
smart_resize()
   ↓
build_messages()
   ↓
convert_messages_format_to_openaiurl()
   ↓
图片转换为 Base64 Data URI
   ↓
OpenAI-compatible Chat Completions API
   ↓
模型返回桌面操作
```

模型消息示例：

```python
messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "image_url",
                "image_url": {
                    "url": "data:image/png;base64,..."
                }
            },
            {
                "type": "text",
                "text": "请根据当前桌面完成用户任务"
            }
        ]
    }
]
```

---

## 📐 坐标系统

模型使用 `0～1000` 的归一化坐标：

| 模型坐标 | 对应位置 |
|---|---|
| `(0, 0)` | 左上角 |
| `(500, 500)` | 屏幕中心 |
| `(1000, 1000)` | 右下角 |

转换公式：

```python
real_x = normalized_x / 1000 * image_width
real_y = normalized_y / 1000 * image_height
```

例如，截图尺寸为 `1920 × 1080`：

```text
模型坐标：(500, 500)
实际坐标：(960, 540)
```

---

## 🖱️ 支持的操作

| 操作 | 说明 |
|---|---|
| `click` | 单击指定坐标 |
| `double_click` | 双击指定坐标 |
| `right_click` | 右键点击 |
| `type` | 输入文本 |
| `hotkey` | 执行组合快捷键 |
| `scroll` | 页面滚动 |
| `drag` | 从起点拖拽到终点 |
| `wait` | 等待页面加载 |
| `finished` | 标记任务完成 |
| `call_user` | 请求用户介入 |

---

## 📦 环境要求

### Python

- Python 3.10+
- Windows 10 / Windows 11

安装依赖：

```powershell
pip install pyautogui pyperclip pillow numpy openai langgraph
```

| Python 依赖 | 用途 |
|---|---|
| `pyautogui` | 鼠标和键盘自动化 |
| `pyperclip` | 剪贴板输入 |
| `Pillow` | 桌面截图与图片处理 |
| `numpy` | 图像和数组处理 |
| `openai` | 调用 OpenAI 兼容接口 |
| `langgraph` | Agent 状态图 |
| `tkinter` | 桌面步骤弹窗，通常随 Python 安装 |

### Electron

- Node.js 18+
- npm 9+

```powershell
cd desktop
npm install
```

---

## ⚙️ API 配置

推荐使用环境变量保存敏感配置：

```powershell
$env:AGENT_API_KEY = "sk-xxx"
$env:AGENT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
$env:AGENT_MODEL_NAME = "qwen3-vl-plus"
```

推荐的 `.gitignore`：

```gitignore
.env
.env.*
*.key

__pycache__/
*.pyc

desktop/node_modules/
desktop/dist/

screenshots/
annotations/
output/
```

---

## ⚠️ 已知注意事项

| 问题 | 说明 |
|---|---|
| API Key 硬编码 | 终端入口当前仍可能包含模块级 API 配置 |
| 图片缩放不一致 | `resize_node` 和 `image_to_base64()` 的 `max_pixels` 需要保持一致 |
| 坐标偏移 | 高 DPI、多显示器和不同缩放参数可能造成点击偏差 |
| Bridge 标准输出 | `stdout` 已被转换为 JSON Lines，原始输出需使用 `sys.__stdout__` |
| 模型名称同步 | Bridge 会修改核心模块中的 `MODEL_NAME` |
| Agent 无限循环 | 应设置合理的 `max_steps` |
| 页面加载延迟 | 每次动作后应预留一定等待时间 |

---

## 🔐 安全提示

桌面 Agent 会直接控制当前计算机，请注意：

- 🔑 不要将真实 API Key 提交到仓库；
- 💾 运行前保存正在编辑的文件；
- 🛑 保留 PyAutoGUI Fail-safe；
- 🖱️ Agent 运行时尽量不要手动操作鼠标；
- 💳 不建议直接执行支付、转账等高风险操作；
- 🗑️ 删除文件、发送消息等操作建议增加人工确认；
- 🔢 设置合理的最大执行步数。

建议启用：

```python
pyautogui.FAILSAFE = True
```

紧急情况下，将鼠标快速移动到屏幕左上角即可中断 PyAutoGUI。

---

## 🛠️ 开发计划

- [ ] 将终端模式配置迁移到环境变量
- [ ] 增加 `requirements.txt`
- [ ] 增加 `pyproject.toml`
- [ ] 统一截图缩放参数
- [ ] 优化高 DPI 和多显示器坐标适配
- [ ] 增加模型输出 JSON Schema 校验
- [ ] 增加任务暂停和取消功能
- [ ] 增加高风险动作二次确认
- [ ] 增加历史任务管理
- [ ] 完善 Electron 执行时间线
- [ ] 增加自动化测试
- [ ] 增加截图和日志自动清理

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。

建议贡献流程：

```bash
git checkout -b feature/your-feature
git commit -m "feat: add your feature"
git push origin feature/your-feature
```

然后在 GitHub 中创建 Pull Request。

---

## 📄 License

本项目许可证请根据仓库实际情况补充。

推荐使用：

```text
MIT License
```

---

## 🙏 致谢

本项目基于或使用了以下技术：

- [Qwen](https://github.com/QwenLM)
- [LangGraph](https://github.com/langchain-ai/langgraph)
- [PyAutoGUI](https://github.com/asweigart/pyautogui)
- [OpenAI Python SDK](https://github.com/openai/openai-python)
- [Electron](https://github.com/electron/electron)
- [Vite](https://github.com/vitejs/vite)

---

<p align="center">
  <strong>🚀 Let AI see your desktop and complete tasks for you.</strong>
</p>

