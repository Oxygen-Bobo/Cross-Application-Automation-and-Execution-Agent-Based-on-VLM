<h1 align="center">🧭 跨应用自动化执行 Agent 设计文档</h1>

<p align="center">
  <strong>面向 Windows 桌面自动化、跨应用任务执行与智能体工程化落地的系统设计说明</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Document-Design-blueviolet" alt="Design">
  <img src="https://img.shields.io/badge/Runtime-Electron%20%2B%20Python-47848F" alt="Runtime">
  <img src="https://img.shields.io/badge/Agent-LangGraph-FF6B35" alt="LangGraph">
  <img src="https://img.shields.io/badge/Speech-iFLYTEK-00A86B" alt="Speech">
</p>

---

## 1. 🎯 设计目标

本项目目标是构建一个能够在真实 Windows 桌面环境中执行复杂任务的跨应用自动化 Agent。系统不只关注“能点击”，更关注“能理解任务、能持续执行、能失败恢复、能让用户知道发生了什么”。

| 目标 | 设计要求 |
|---|---|
| 🧠 智能规划 | 将自然语言任务拆分为可执行步骤，并根据屏幕变化持续调整 |
| 👁️ 视觉理解 | 使用视觉语言模型理解桌面界面、按钮、输入框、窗口状态 |
| 🖱️ 类人操作 | 通过鼠标、键盘、快捷键、任务栏、桌面等通道完成操作 |
| 🔁 长任务稳定 | 防止死循环、误判完成、重复打开应用、找不到文件等问题 |
| 🧩 能力可扩展 | 通过 Skill 分层增强浏览器、微信、QQ、邮箱、WPS 等场景 |
| 🧾 过程可解释 | 每一步显示观察、理解、执行、失败原因和重试建议 |
| 📦 易发布 | 支持 Windows 安装包，降低普通用户部署成本 |

---

## 2. 🏗️ 总体架构

<table>
  <tr>
    <th>层级</th>
    <th>模块</th>
    <th>职责</th>
  </tr>
  <tr>
    <td>🎨 表现层</td>
    <td>SolidJS Renderer</td>
    <td>新建任务、执行时间线、定时任务、账号设置、悬浮状态球、语音输入按钮</td>
  </tr>
  <tr>
    <td>🧭 桌面协调层</td>
    <td>Electron Main</td>
    <td>窗口管理、IPC、Python 子进程、定时任务、语音识别、账号数据</td>
  </tr>
  <tr>
    <td>🤖 Agent 运行层</td>
    <td>Python + LangGraph</td>
    <td>观察、消息构建、模型调用、动作解析、桌面执行、历史状态更新</td>
  </tr>
  <tr>
    <td>🧩 能力层</td>
    <td>Skills / Planner / Recovery</td>
    <td>桌面导航、高频应用、报告交付、失败恢复、文件产物管理</td>
  </tr>
  <tr>
    <td>☁️ 外部服务层</td>
    <td>VLM API / iFLYTEK API</td>
    <td>视觉语言理解、语音转文字</td>
  </tr>
</table>

<p align="center">
  <kbd>用户目标</kbd> → <kbd>Electron</kbd> → <kbd>Python Agent</kbd> → <kbd>VLM 决策</kbd> → <kbd>桌面动作</kbd> → <kbd>结果验证</kbd>
</p>

---

## 3. 🔄 核心执行闭环

系统采用“观察 → 理解 → 规划 → 执行 → 反馈”的闭环。

<table>
  <tr>
    <td align="center"><strong>①</strong><br>👁️ 观察屏幕</td>
    <td align="center">➡️</td>
    <td align="center"><strong>②</strong><br>🧠 构建多模态上下文</td>
    <td align="center">➡️</td>
    <td align="center"><strong>③</strong><br>✨ 生成下一步动作</td>
  </tr>
  <tr>
    <td align="center"><strong>⑥</strong><br>📌 更新历史与状态</td>
    <td align="center">⬅️</td>
    <td align="center"><strong>⑤</strong><br>🖱️ 执行桌面操作</td>
    <td align="center">⬅️</td>
    <td align="center"><strong>④</strong><br>🧩 解析工具调用</td>
  </tr>
</table>

### 3.1 执行节点

| 节点 | 说明 |
|---|---|
| `observe` | 截取当前桌面画面 |
| `build_messages` | 组合用户任务、屏幕截图、历史步骤、Skill 提示 |
| `plan` | 调用视觉语言模型生成下一步动作 |
| `parse` | 解析模型输出中的工具调用 |
| `resize` | 将模型坐标映射到实际屏幕坐标 |
| `act` | 执行点击、输入、快捷键、等待等动作 |
| `update_history` | 记录状态、耗时、失败原因和下一轮上下文 |

---

## 4. 🧩 Skill 分层设计

项目采用分层 Skill，而不是一次性创建“大而全”的软件百科库。

<p align="center">
  <kbd>🧱 桌面基础</kbd>
  <span> → </span>
  <kbd>🌐 高频应用</kbd>
  <span> → </span>
  <kbd>🔁 跨应用流程</kbd>
  <span> → </span>
  <kbd>📦 任务交付</kbd>
  <span> → </span>
  <kbd>🛟 失败恢复</kbd>
</p>

| 层级 | 能力示例 |
|---|---|
| 桌面基础 Skill | 返回桌面、任务栏优先、窗口切换、文件选择器、复制粘贴 |
| 高频应用 Skill | 浏览器、微信、QQ、邮箱、WPS、资源管理器 |
| 跨应用流程 Skill | 查资料、整理内容、生成报告、发送附件 |
| 任务交付 Skill | 输出目录、文件命名、报告保存、目标应用发送 |
| 失败恢复 Skill | 重试、停止、解释失败、避免重复打开应用 |

### 4.1 为什么不一开始做“大量软件 Skill”

大量软件 Skill 容易带来三个问题：

- 🧱 维护成本高：应用 UI 一变，旧 Skill 立即失效；
- 🧭 决策噪声大：提示词过长会影响模型注意力；
- 🐢 执行变慢：每轮上下文携带过多无关知识。

因此系统优先做“少量高频、可组合、可验证”的能力层。

---

## 5. 🖥️ Electron 桌面端设计

桌面端承担用户交互、状态展示、进程管理和本地数据管理。

| 模块 | 设计说明 |
|---|---|
| 新建任务 | 支持文本输入、语音输入、常用指令和执行入口 |
| 执行时间线 | 展示每一步观察、理解、执行、结果、耗时和失败详情 |
| 悬浮状态球 | 任务运行时保持轻量状态感知，支持拖动，透明区域不拦截鼠标 |
| 定时任务 | 支持周期任务、立即执行、启停控制和执行中紧急停止 |
| 账号系统 | 本地注册登录、免登录、退出登录、用户数据隔离 |
| 支付页面 | Basic / Pro 展示和二维码支付入口 |
| 配置页面 | API Key、Base URL、模型名、超时、重试等配置 |

---

## 6. 🎙️ 语音输入设计

语音输入保留原有前端按钮体验，后端接入科大讯飞实时语音听写。

| 项目 | 设计 |
|---|---|
| 前端采集 | Web Audio API 采集麦克风 |
| 音频格式 | 16k / 16bit / mono PCM |
| 传输方式 | Renderer → Preload → Main IPC |
| 识别接口 | 科大讯飞 `iat-api.xfyun.cn/v2/iat` |
| 结果合并 | 按 `sn / pgs / rg` 合并动态修正结果 |
| 用户体验 | 识别完成后自动填入任务输入框 |

### 6.1 动态修正处理

科大讯飞会返回中间结果和替换结果。系统不会简单追加文本，而是按序号更新片段，避免出现：

```text
上网 上网查 上网查找 上网查找今天...
```

---

## 7. ⏰ 定时任务设计

定时任务模块允许用户将常用任务变成自动执行流程。

| 能力 | 说明 |
|---|---|
| 创建任务 | 设置任务名称、指令、执行周期 |
| 启用/停用 | 单个任务可随时启停 |
| 立即运行 | 不等待下一个周期，立即执行一次 |
| 执行中停止 | 和普通任务一致，可立即终止 |
| 状态同步 | 执行时同步主界面状态和悬浮状态球 |

---

## 8. 👤 用户隔离与账号设计

系统采用本地账号体系，目标是让多人使用同一台电脑时互不干扰。

| 数据类型 | 隔离方式 |
|---|---|
| 用户账号 | 本地注册、登录、免登录 |
| API 配置 | 按用户保存 |
| 历史任务 | 按用户保存 |
| 定时任务 | 按用户保存 |
| 常用指令 | 前端本地存储，独立维护 |

---

## 9. 🛟 失败恢复设计

真实桌面环境不可控，失败恢复是系统稳定性的关键。

| 问题 | 处理策略 |
|---|---|
| 工具调用格式错误 | 尝试修复动作字段，无法修复则返回清晰失败原因 |
| 重复打开软件 | 优先检查任务栏活跃窗口，再考虑桌面图标 |
| 软件全屏遮挡 | 必要时返回桌面或切换窗口 |
| 文件找不到 | 使用任务产物目录和最近生成文件索引 |
| 任务死循环 | 使用最大步数、检查点和失败计数终止 |
| 用户停止 | 杀死 Python 子进程树，忽略停止后的旧事件 |
| 截图堆积 | 任务结束后自动清理执行期间截图 |

---

## 10. 📦 打包发布设计

发布版使用 Electron Builder 生成 Windows NSIS 安装包。

| 内容 | 说明 |
|---|---|
| 安装包 | `desktop/release/Desktop Agent-1.0.0-Setup.exe` |
| 桌面程序 | Electron 主程序 |
| Agent Runtime | `resources/agent/agent_bridge.exe` |
| 配置与数据 | 保存在用户本地数据目录 |
| 语音识别 | 通过 API 调用，不依赖本地语音模型 |

打包命令：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\package-windows.ps1
```

---

## 11. 🔐 安全与隐私设计

| 风险 | 设计措施 |
|---|---|
| API Key 泄露 | 桌面端配置保存，避免命令行暴露 |
| 误操作 | 支持停止任务和高风险操作人工确认建议 |
| 子进程残留 | 停止和关闭窗口时杀死进程树 |
| 截图隐私 | 任务结束后清理截图 |
| 用户数据混淆 | 账号隔离配置、历史和定时任务 |

---

## 12. 🗺️ 演进路线

| 阶段 | 方向 |
|---|---|
| V1 | Electron 桌面端、基础 Agent、账号、定时任务、语音输入 |
| V2 | 引入 Windows UI Automation，降低坐标点击依赖 |
| V3 | 增强 Office/WPS、邮箱、微信、QQ 深度能力 |
| V4 | 构建可回放任务集和自动化评测体系 |
| V5 | 插件化 Skill 市场和企业级权限控制 |

---

<p align="center">
  <strong>✨ 设计核心：让 Agent 不只是“点屏幕”，而是能理解任务、掌控流程、解释状态、可靠交付。</strong>
</p>

