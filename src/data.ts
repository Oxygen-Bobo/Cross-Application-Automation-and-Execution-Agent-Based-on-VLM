import {
  Brain,
  CheckCircle2,
  Clock3,
  Code2,
  Files,
  Github,
  Keyboard,
  Layers3,
  MessagesSquare,
  Monitor,
  MousePointerClick,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";

export const githubUrl =
  "https://github.com/Oxygen-Bobo/Cross-Application-Automation-and-Execution-Agent-Based-on-VLM";

export const navItems = [
  { label: "项目介绍", href: "#intro" },
  { label: "核心能力", href: "#features" },
  { label: "工作流程", href: "#workflow" },
  { label: "技术架构", href: "#tech" },
  { label: "立即体验", href: "#release" },
];

export const featureCards = [
  {
    icon: Monitor,
    title: "桌面视觉理解",
    body: "截图观察桌面画面，结合 VLM 识别窗口、按钮、输入框和界面状态。",
  },
  {
    icon: Brain,
    title: "自主任务规划",
    body: "根据当前界面和用户目标，动态判断下一步动作，并在失败时重新评估。",
  },
  {
    icon: Layers3,
    title: "跨应用执行",
    body: "支持浏览器、文件资源管理器、文档、聊天窗口等多应用协同操作。",
  },
  {
    icon: Keyboard,
    title: "鼠标与键盘控制",
    body: "通过 PyAutoGUI 执行点击、输入、快捷键、滚动、拖拽等桌面动作。",
  },
  {
    icon: Clock3,
    title: "实时状态时间线",
    body: "将截图、AI 分析、动作执行、任务结果以可视化时间线展示。",
  },
  {
    icon: Waypoints,
    title: "Skill 分层扩展",
    body: "预留 OS、浏览器、Office、文件、消息等结构化能力，逐步升级为混合式 Agent。",
  },
];

export const workflowSteps = [
  {
    label: "Observe",
    title: "观察",
    body: "Agent 截取当前桌面画面，获得真实界面状态。",
  },
  {
    label: "Plan",
    title: "规划",
    body: "VLM 分析截图内容，判断任务下一步需要做什么。",
  },
  {
    label: "Act",
    title: "执行",
    body: "系统调用鼠标、键盘、快捷键或工具执行操作。",
  },
  {
    label: "Verify",
    title: "验证",
    body: "再次观察界面变化，确认任务是否真正完成。",
  },
];

export const techStack = [
  { name: "Qwen-VL", role: "理解桌面截图", icon: Sparkles },
  { name: "LangGraph", role: "多步骤状态编排", icon: Network },
  { name: "PyAutoGUI", role: "鼠标键盘动作", icon: MousePointerClick },
  { name: "Electron", role: "桌面端图形界面", icon: Monitor },
  { name: "Python", role: "Agent 执行逻辑", icon: Code2 },
  { name: "JSON Lines", role: "实时通信协议", icon: Waypoints },
  { name: "Skills", role: "可扩展任务能力", icon: Layers3 },
];

export const useCases = [
  {
    icon: Search,
    title: "浏览器资料搜索",
    body: "自动打开浏览器、搜索关键词、浏览页面并提取信息。",
  },
  {
    icon: Files,
    title: "文件整理",
    body: "打开文件夹、查找文件、移动或归类资料。",
  },
  {
    icon: Code2,
    title: "文档协作",
    body: "辅助编辑 Word、Excel、PPT 等办公内容。",
  },
  {
    icon: MessagesSquare,
    title: "信息传递",
    body: "在多个应用之间复制、整理、转移信息。",
  },
  {
    icon: Brain,
    title: "报告生成",
    body: "结合浏览器、文档和表格，辅助生成日报、周报或项目材料。",
  },
  {
    icon: ShieldCheck,
    title: "发送前确认",
    body: "聊天发送、文件删除、支付转账等高风险操作需要用户确认。",
  },
];

export const highlights = [
  "真实 Windows 桌面环境，而不是模拟网页环境",
  "可视化执行过程，方便观察、调试和复盘",
  "多步骤任务循环，支持持续观察与动态执行",
  "Electron 桌面应用，体验更接近真实产品",
  "从纯 VLM 点击逐步升级为混合式 Agent",
  "适合学习 VLM、GUI Automation、LangGraph 和 Desktop Agent 架构",
];

export const safetyNotes = [
  "发送消息前确认",
  "删除文件前确认",
  "支付、转账等操作不自动执行",
];

export const GithubIcon = Github;
