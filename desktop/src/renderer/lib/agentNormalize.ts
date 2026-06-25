import type { AgentRun, AgentStep, AgentUiEvent, PhaseStatus, StepPhase } from "../types/agent";

const now = () => Date.now();

type ToolArguments = {
  action?: string;
  app_name?: string;
  text?: string;
  keys?: string[] | string;
  coordinate?: number[];
  coordinate1?: number[];
  coordinate2?: number[];
  pixels?: number;
  time?: number;
  status?: string;
};

function shortText(value?: string, max = 28) {
  if (!value) return "";
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

function coordLabel(coord?: number[]) {
  if (!coord || coord.length < 2) return "";
  return `坐标 ${Math.round(coord[0])}, ${Math.round(coord[1])}`;
}

function appDisplayName(app?: string) {
  const value = shortText(app, 18);
  const lower = value.toLowerCase();
  if (/wechat|weixin|微信/.test(lower)) return "微信";
  if (/qq|腾讯qq/.test(lower)) return "QQ";
  if (/chrome|edge|firefox|browser|浏览器/.test(lower)) return "浏览器";
  if (/explorer|file explorer|资源管理器/.test(lower)) return "文件资源管理器";
  if (/wps/.test(lower)) return "WPS";
  if (/word/.test(lower)) return "Word";
  if (/excel/.test(lower)) return "Excel";
  if (/powerpoint|ppt/.test(lower)) return "PowerPoint";
  if (/outlook|mail|邮箱|邮件/.test(lower)) return "邮件";
  return value;
}

function titleScore(title?: string) {
  if (!title) return 0;
  let score = Math.min(4, Math.floor(title.length / 8));
  if (/坐标|目标控件|屏幕目标|执行动作/.test(title)) score -= 2;
  if (/微信|QQ|浏览器|搜索|输入|文件传输助手|任务栏|窗口|会话|联系人|报告|文档|文件夹|资源管理器|WPS|Word|Excel|PPT|邮件|邮箱|收件人|附件/.test(title)) score += 4;
  if (/“[^”]+”/.test(title)) score += 2;
  return score;
}

function setBetterStepTitle(step: AgentStep, title?: string) {
  if (!title || title === "获取屏幕截图" || title === "分析当前界面") return;
  if (titleScore(title) >= titleScore(step.title)) step.title = title;
}

function normalizeActionName(action?: string) {
  return (action || "").trim().toLowerCase().replace(/[-\s]+/g, "_");
}

function parseLooseObject(text: string): any | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {}
  try {
    const normalized = slice
      .replace(/'/g, '"')
      .replace(/\bNone\b/g, "null")
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false");
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

function extractArgumentsFromLog(text: string): ToolArguments | null {
  const parsed = parseLooseObject(text);
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.arguments && typeof parsed.arguments === "object") return parsed.arguments;
  if (parsed.action) return parsed;
  return null;
}

function titleFromArguments(args: ToolArguments): string {
  const action = normalizeActionName(args.action);
  const target = coordLabel(args.coordinate);
  const text = shortText(args.text);
  const app = appDisplayName(args.app_name);
  const keys = Array.isArray(args.keys) ? args.keys.join(" + ") : args.keys;

  if (action === "open_app" || action === "open") {
    if (app === "微信") return "打开微信窗口";
    if (app === "QQ") return "打开 QQ 聊天窗口";
    if (app === "浏览器") return "打开浏览器窗口";
    if (app === "文件资源管理器") return "打开文件资源管理器";
    if (app === "邮件") return "打开邮件客户端";
    if (["WPS", "Word", "Excel", "PowerPoint"].includes(app)) return `打开${app}文档应用`;
    return app ? `打开应用：${app}` : "打开目标应用";
  }
  if (action === "left_click" || action === "click") return target ? `点击屏幕目标（${target}）` : "点击目标控件";
  if (action === "double_click") return target ? `双击屏幕目标（${target}）` : "双击目标控件";
  if (action === "right_click") return target ? `右键点击目标（${target}）` : "打开目标的右键菜单";
  if (action === "middle_click") return target ? `中键点击目标（${target}）` : "执行中键点击";
  if (action === "mouse_move") return target ? `移动鼠标到目标位置（${target}）` : "移动鼠标到目标位置";
  if (action === "type") return text ? `输入文本：“${text}”` : "输入文本";
  if (action === "key" || action === "hotkey") return keys ? `按下快捷键：${keys}` : "按下键盘快捷键";
  if (action === "scroll") return `滚动页面${typeof args.pixels === "number" ? `（${args.pixels > 0 ? "向上" : "向下"}）` : ""}`;
  if (action === "hscroll") return `水平滚动${typeof args.pixels === "number" ? `（${args.pixels > 0 ? "向右" : "向左"}）` : ""}`;
  if (action === "left_click_drag" || action === "drag") {
    const from = coordLabel(args.coordinate1);
    const to = coordLabel(args.coordinate2);
    return from && to ? `从 ${from} 拖拽到 ${to}` : "拖拽目标元素";
  }
  if (action === "wait") return `等待界面响应${args.time ? `（${args.time} 秒）` : ""}`;
  if (action === "answer") return text ? `回复结果：“${text}”` : "回复任务结果";
  if (action === "terminate" || action === "stop" || action === "done") return "确认任务完成并结束";
  if (action === "interact" || action === "call_user") return "等待用户协助处理弹窗或验证";
  return args.action ? `执行动作：${args.action}` : "执行下一步操作";
}

function extractQuotedText(text: string) {
  return text.match(/[“"']([^”"']+)[”"']/)?.[1] || text.match(/(?:search for|输入|搜索)\s*[:：]?\s*([^，。,.;；]+)/i)?.[1]?.trim();
}

function scenarioTitleFromText(text: string): string | undefined {
  const lower = text.toLowerCase();
  const quoted = shortText(extractQuotedText(text), 24);
  const hasClick = /click|press|select|choose|点击|单击|选择|点开/.test(lower);
  const hasType = /type|input|enter|paste|输入|粘贴|填写/.test(lower);
  const hasOpen = /open|launch|打开|启动|进入/.test(lower);
  const hasSearch = /search|find|搜索|查找|检索/.test(lower);
  const hasSend = /send|发送|send out/.test(lower);
  const hasAttach = /attach|attachment|upload|选择文件|添加附件|附件|上传/.test(lower);

  if (/wechat|微信/.test(lower)) {
    if (/taskbar|任务栏/.test(lower) && /icon|图标/.test(lower) && hasClick) return "单击任务栏固定的微信图标打开微信窗口";
    if (/search box|搜索框|搜索栏/.test(lower) && hasClick) return "单击微信搜索框准备查找联系人";
    if (hasSearch && /file transfer assistant|文件传输助手/.test(lower)) return "在微信中搜索“文件传输助手”";
    if (/file transfer assistant|文件传输助手/.test(lower) && hasOpen) return "打开“文件传输助手”会话";
    if (/contact|联系人|chat|会话/.test(lower) && hasSearch) return quoted ? `在微信中搜索联系人“${quoted}”` : "在微信中搜索目标联系人";
    if (/message input|输入框|编辑框/.test(lower) && hasClick) return "单击微信消息输入框";
    if (hasType) return quoted ? `在微信消息框输入“${quoted}”` : "在微信消息框输入消息内容";
    if (hasAttach) return "在微信中选择要发送的文件";
    if (hasSend) return "点击微信发送按钮发送消息或文件";
    if (hasOpen) return "打开微信窗口";
  }

  if (/\bqq\b|腾讯qq/.test(lower)) {
    if (/taskbar|任务栏/.test(lower) && /icon|图标/.test(lower) && hasClick) return "单击任务栏固定的 QQ 图标打开聊天窗口";
    if (/search box|搜索框|搜索栏/.test(lower) && hasClick) return "单击 QQ 搜索框准备查找联系人";
    if (/contact|联系人|group|群/.test(lower) && hasSearch) return quoted ? `在 QQ 中搜索“${quoted}”` : "在 QQ 中搜索联系人或群聊";
    if (/message input|输入框|编辑框/.test(lower) && hasClick) return "单击 QQ 消息输入框";
    if (hasType) return quoted ? `在 QQ 消息框输入“${quoted}”` : "在 QQ 消息框输入内容";
    if (hasAttach) return "在 QQ 中选择要发送的文件";
    if (hasSend) return "点击 QQ 发送按钮发送内容";
    if (hasOpen) return "打开 QQ 聊天窗口";
  }

  if (/browser|chrome|edge|firefox|浏览器/.test(lower)) {
    if (/address bar|omnibox|search bar|搜索框|搜索窗口|地址栏/.test(lower) && hasClick) return "单击浏览器地址栏或搜索框";
    if ((/address bar|omnibox|search bar|搜索框|搜索窗口|地址栏/.test(lower) && hasType) || (hasSearch && quoted)) {
      return quoted ? `在浏览器搜索窗口输入“${quoted}”` : "在浏览器搜索窗口输入搜索内容";
    }
    if (/result|link|搜索结果|链接/.test(lower) && hasClick) return quoted ? `打开搜索结果“${quoted}”` : "打开目标搜索结果";
    if (/download|下载/.test(lower) && hasClick) return "点击浏览器下载按钮";
    if (/tab|标签页/.test(lower) && hasClick) return "切换浏览器标签页";
    if (hasOpen) return "打开浏览器窗口";
  }

  if (/file explorer|explorer|资源管理器|文件夹|downloads|desktop|下载|桌面/.test(lower)) {
    if (/downloads|下载/.test(lower) && hasOpen) return "打开下载文件夹";
    if (/desktop|桌面/.test(lower) && hasOpen) return "打开桌面文件夹";
    if (/address bar|路径栏|地址栏/.test(lower) && hasClick) return "单击资源管理器地址栏";
    if (/address bar|路径栏|地址栏/.test(lower) && hasType) return quoted ? `在路径栏输入“${quoted}”` : "在路径栏输入目标路径";
    if (/search box|搜索框/.test(lower) && hasClick) return "单击文件夹搜索框";
    if (/search box|搜索框/.test(lower) && hasType) return quoted ? `在文件夹搜索框输入“${quoted}”` : "在文件夹中搜索目标文件";
    if (/new folder|创建文件夹|新建文件夹/.test(lower)) return quoted ? `创建文件夹“${quoted}”` : "创建新的分类文件夹";
    if (/move|copy|rename|移动|复制|重命名/.test(lower)) return quoted ? `整理文件“${quoted}”` : "移动或整理目标文件";
    if (/sort|时间|date|排序/.test(lower)) return "按时间排序文件列表";
    if (hasOpen) return "打开文件资源管理器";
  }

  if (/wps|word|excel|powerpoint|ppt|office|文档|表格|幻灯片|演示文稿/.test(lower)) {
    if (/save as|另存为/.test(lower)) return "打开另存为窗口保存文档";
    if (/save|保存/.test(lower)) return "保存当前文档";
    if (/export|pdf|导出/.test(lower)) return "将文档导出为 PDF";
    if (/cell|单元格|sheet|工作表/.test(lower) && hasClick) return quoted ? `选中表格位置“${quoted}”` : "选中表格单元格";
    if (/cell|单元格|sheet|工作表/.test(lower) && hasType) return quoted ? `在表格中输入“${quoted}”` : "在表格中输入内容";
    if (/slide|幻灯片|ppt/.test(lower) && hasType) return quoted ? `在幻灯片中输入“${quoted}”` : "编辑幻灯片内容";
    if (/document|正文|文档/.test(lower) && hasType) return quoted ? `在文档中输入“${quoted}”` : "编辑文档正文";
    if (/open|打开/.test(lower)) return "打开办公文档";
  }

  if (/email|mail|outlook|邮箱|邮件/.test(lower)) {
    if (/compose|new mail|写邮件|新建邮件|撰写/.test(lower)) return "新建邮件";
    if (/to field|recipient|收件人/.test(lower) && (hasClick || hasType)) return quoted ? `填写收件人“${quoted}”` : "填写邮件收件人";
    if (/subject|主题/.test(lower) && (hasClick || hasType)) return quoted ? `填写邮件主题“${quoted}”` : "填写邮件主题";
    if (/body|正文|内容/.test(lower) && hasType) return quoted ? `填写邮件正文“${quoted}”` : "填写邮件正文";
    if (hasAttach) return "添加邮件附件";
    if (hasSend) return "点击发送按钮发送邮件";
    if (hasOpen) return "打开邮件客户端";
  }

  return undefined;
}

export function translateActionToChinese(action: string): string {
  const text = action.trim().replace(/^Action:\s*/i, "").replace(/[。.]$/, "");
  const args = extractArgumentsFromLog(text);
  if (args) return titleFromArguments(args);

  const lower = text.toLowerCase();
  const scenarioTitle = scenarioTitleFromText(text);
  if (scenarioTitle) return scenarioTitle;
  const quoted = text.match(/[“"']([^”"']+)[”"']/)?.[1];
  if (/wechat|微信/i.test(text) && /taskbar|任务栏/i.test(text) && /icon|图标/i.test(text) && /click|点击|单击/i.test(lower)) {
    return "单击任务栏固定的微信图标打开微信窗口";
  }
  if (/browser|chrome|edge|firefox|浏览器/i.test(text) && /search|address|搜索|地址栏|搜索框/i.test(text) && /type|input|enter|输入/i.test(lower)) {
    return quoted ? `在浏览器搜索窗口输入“${quoted}”` : "在浏览器搜索窗口输入搜索内容";
  }
  if (/search box|search field|搜索框|搜索窗口/i.test(text) && /type|input|输入/i.test(lower)) {
    return quoted ? `在搜索框输入“${quoted}”` : "在搜索框输入内容";
  }
  if (/file transfer assistant|文件传输助手/i.test(text)) {
    if (/click|open|进入|打开/.test(lower)) return "打开“文件传输助手”会话";
    if (/send|发送/.test(lower)) return "发送给“文件传输助手”";
  }
  if (/wechat|微信/i.test(text)) {
    if (/open|launch|打开|启动/.test(lower)) return "打开微信";
    if (/search|查找|搜索/.test(lower)) return "在微信中搜索联系人";
  }
  if (/qq/i.test(text)) return /search|搜索/.test(lower) ? "在 QQ 中搜索联系人" : "操作 QQ";
  if (/browser|chrome|edge|firefox|浏览器/i.test(text)) return "操作浏览器";
  if (/file explorer|资源管理器|folder|文件夹/i.test(text)) return "操作文件或文件夹";
  if (/wps|word|excel|powerpoint|ppt|office/i.test(text)) return "操作文档应用";
  if (/click|left_click|点击/.test(lower)) return quoted ? `点击“${quoted}”` : "点击目标控件";
  if (/double_click|double click|双击/.test(lower)) return quoted ? `双击“${quoted}”` : "双击目标控件";
  if (/right_click|right click|右键/.test(lower)) return quoted ? `右键点击“${quoted}”` : "打开右键菜单";
  if (/type|input|输入/.test(lower)) return quoted ? `输入“${quoted}”` : "输入文本";
  if (/scroll|滚动/.test(lower)) return "滚动页面";
  if (/wait|等待/.test(lower)) return "等待界面响应";
  if (/screenshot|capture|截图/.test(lower)) return "获取屏幕截图";
  if (/analy[sz]e|识别|分析/.test(lower)) return "分析当前界面";
  if (/send|发送/.test(lower)) return "发送内容";
  if (/open|launch|打开/.test(lower)) return quoted ? `打开“${quoted}”` : "打开目标应用或窗口";
  return text || "执行下一步操作";
}

export function extractStepTitleFromLog(line: string): string | undefined {
  const text = line.trim();
  if (/^\[INFO\]\s+Executing action:/i.test(text)) return titleFromArguments(extractArgumentsFromLog(text) || {});
  const toolArgs = text.includes("<tool_call>") ? extractArgumentsFromLog(text) : null;
  if (toolArgs) return titleFromArguments(toolArgs);
  const action = text.match(/^Action:\s*(.+)$/i)?.[1];
  if (action) return translateActionToChinese(action);
  if (/Capturing screen|screenshot/i.test(text)) return "获取屏幕截图";
  if (/Analysing|Analyzing|desktop elements|VLM|model/i.test(text)) return "分析当前界面";
  return undefined;
}

export function parseAgentStdoutLine(line: string, currentStep?: number): AgentUiEvent {
  const raw = line ?? "";
  const text = raw.trim();
  const stepMatch = text.match(/^Step:\s*(\d+)/i) || text.match(/^Step\s+(\d+)/i) || text.match(/STEP\s+(\d+)/i);
  if (stepMatch) {
    const step = Number(stepMatch[1]);
    return { type: "step_started", step, message: `进入第 ${step + 1} 步`, raw };
  }

  const title = extractStepTitleFromLog(text);
  if (/^Action:/i.test(text)) {
    return {
      type: "action_detected",
      step: currentStep,
      title,
      actionText: text.replace(/^Action:\s*/i, ""),
      message: title || "识别到下一步操作",
      raw,
    };
  }
  if (/Capturing screen|screenshot/i.test(text)) return { type: "capture_started", step: currentStep, message: "正在获取屏幕截图", raw };
  if (/screenshot saved|capture finished/i.test(text)) return { type: "capture_finished", step: currentStep, message: "屏幕截图已完成", raw };
  if (/Analysing|Analyzing|desktop elements|model call|VLM|build_messages|plan_node/i.test(text)) {
    return { type: "ai_started", step: currentStep, title, message: "正在理解当前界面", raw };
  }
  if (/Found\s+\d+\s+clickable|analysis complete|model returned/i.test(text)) return { type: "ai_finished", step: currentStep, message: "界面分析已完成", raw };
  if (/Executing action|execute_action|pyautogui|act_node/i.test(text)) {
    return { type: "action_started", step: currentStep, title, message: title || "正在执行桌面操作", raw };
  }
  if (/Action completed successfully|completed successfully/i.test(text)) return { type: "action_finished", step: currentStep, message: "桌面操作已完成", raw };
  if (/invalid_api_key|AuthenticationError/i.test(text)) return { type: "error", step: currentStep, message: "API Key 无效，请检查配置", error: text, raw };
  if (/Connection error|Failed to connect|timeout/i.test(text)) {
    return { type: "error", step: currentStep, message: "连接模型服务失败，请检查网络或服务配置", error: text, raw };
  }
  if (/Traceback|\[ERROR\]|Error|Failed/i.test(text)) return { type: "error", step: currentStep, message: "当前步骤执行失败", error: text, raw };
  if (/finished|run_finished/i.test(text)) return { type: "finished", step: currentStep, message: "任务已完成", raw };
  return { type: "raw", step: currentStep, message: text, raw };
}

function makePhase(key: "capture" | "ai" | "action", title: string, icon: string): StepPhase {
  return { key, title, icon, status: "pending", message: "等待执行" };
}

function createStep(stepNumber: number): AgentStep {
  return {
    id: `s-${stepNumber}`,
    step: stepNumber,
    title: `第 ${stepNumber + 1} 步`,
    status: "running",
    startedAt: now(),
    phases: {
      capture: makePhase("capture", "屏幕观察", "◎"),
      ai: makePhase("ai", "界面理解", "✦"),
      action: makePhase("action", "桌面执行", "↗"),
    },
    rawLogs: [],
    attempts: [{ index: 1, startedAt: now(), rawLogs: [] }],
    collapsed: false,
  };
}

function upsertStep(run: AgentRun, stepNumber?: number): AgentStep {
  const num = stepNumber ?? run.currentStep ?? 0;
  let step = run.steps.find((s) => s.step === num);
  if (!step) {
    step = createStep(num);
    run.steps.push(step);
    run.steps.sort((a, b) => a.step - b.step);
  }
  run.currentStep = num;
  return step;
}

function pushLog(step: AgentStep, raw: string) {
  step.rawLogs.push(raw);
  const lastAttempt = step.attempts[step.attempts.length - 1];
  if (lastAttempt) lastAttempt.rawLogs.push(raw);
}

function setPhase(step: AgentStep, phase: "capture" | "ai" | "action", status: PhaseStatus, message: string) {
  const t = now();
  const p = step.phases[phase];
  p.status = status;
  p.message = message;
  if (phase === "capture") {
    if (status === "running" && !step.captureStartedAt) step.captureStartedAt = t;
    if (status === "success" || status === "error") step.captureEndedAt = t;
  }
  if (phase === "ai") {
    if (status === "running" && !step.aiStartedAt) step.aiStartedAt = t;
    if (status === "success" || status === "error") {
      step.aiEndedAt = t;
      if (step.aiStartedAt) step.thinkingDurationMs = step.aiEndedAt - step.aiStartedAt;
    }
  }
  if (phase === "action") {
    if (status === "running" && !step.actionStartedAt) step.actionStartedAt = t;
    if (status === "success" || status === "error") step.actionEndedAt = t;
  }
}

function finishStep(step: AgentStep) {
  const t = now();
  step.status = "completed";
  step.endedAt = t;
  step.durationMs = t - step.startedAt;
  step.collapsed = step.manualExpanded ? false : true;
  const lastAttempt = step.attempts[step.attempts.length - 1];
  if (lastAttempt && !lastAttempt.endedAt) lastAttempt.endedAt = t;
}

function failStep(step: AgentStep, error?: string) {
  const t = now();
  step.status = "failed";
  step.endedAt = t;
  step.durationMs = t - step.startedAt;
  step.error = error;
  step.collapsed = false;
  const lastAttempt = step.attempts[step.attempts.length - 1];
  if (lastAttempt) {
    lastAttempt.endedAt = t;
    lastAttempt.error = error;
  }
}

export function applyAgentEventToRun(prev: AgentRun, evt: AgentUiEvent): AgentRun {
  const run: AgentRun = {
    ...prev,
    rawLogs: [...prev.rawLogs, evt.raw],
    steps: prev.steps.map((s) => ({
      ...s,
      phases: {
        capture: { ...s.phases.capture },
        ai: { ...s.phases.ai },
        action: { ...s.phases.action },
      },
      rawLogs: [...s.rawLogs],
      attempts: s.attempts.map((a) => ({ ...a, rawLogs: [...a.rawLogs] })),
    })),
    compactPlan: prev.compactPlan.map((p) => ({ ...p })),
  };

  const step = upsertStep(run, evt.step);
  pushLog(step, evt.raw);
  setBetterStepTitle(step, evt.title);

  switch (evt.type) {
    case "step_started":
      step.status = "running";
      run.status = "running";
      run.currentActionText = evt.message;
      break;
    case "capture_started":
      run.status = "capturing";
      step.status = "capturing";
      run.currentActionText = evt.message;
      setPhase(step, "capture", "running", evt.message);
      break;
    case "capture_finished":
      run.currentActionText = evt.message;
      setPhase(step, "capture", "success", evt.message);
      if (evt.screenshotPath) {
        step.screenshotPath = evt.screenshotPath;
        step.phases.capture.screenshotPath = evt.screenshotPath;
      }
      break;
    case "ai_started":
      run.status = "thinking";
      step.status = "thinking";
      run.currentActionText = evt.message;
      if (step.phases.capture.status === "pending") setPhase(step, "capture", "success", "屏幕截图已完成");
      setPhase(step, "ai", "running", evt.message);
      break;
    case "ai_finished":
      run.currentActionText = evt.message;
      setPhase(step, "ai", "success", evt.message);
      break;
    case "action_detected":
      run.currentActionText = evt.message;
      step.actionSummary = evt.message;
      setBetterStepTitle(step, evt.title);
      if (step.phases.ai.status === "pending") setPhase(step, "ai", "success", "已生成下一步操作");
      step.phases.action.message = `准备执行：${evt.message}`;
      break;
    case "action_started":
      run.status = "acting";
      step.status = "acting";
      run.currentActionText = evt.message;
      setBetterStepTitle(step, evt.title);
      if (step.phases.ai.status === "pending") setPhase(step, "ai", "success", "界面分析已完成");
      setPhase(step, "action", "running", evt.message);
      step.actionSummary = evt.message;
      break;
    case "action_finished":
      run.currentActionText = evt.message;
      setPhase(step, "action", "success", evt.message);
      finishStep(step);
      break;
    case "finished":
      run.status = "completed";
      run.endedAt = now();
      run.currentActionText = evt.message;
      if (step.phases.action.status === "running") setPhase(step, "action", "success", "桌面操作已完成");
      if (step.status !== "completed") finishStep(step);
      break;
    case "error":
      run.status = "failed";
      run.currentActionText = evt.message;
      if (step.phases.capture.status === "running") setPhase(step, "capture", "error", evt.message);
      else if (step.phases.ai.status === "running") setPhase(step, "ai", "error", evt.message);
      else setPhase(step, "action", "error", evt.message);
      failStep(step, evt.error || evt.message);
      break;
    case "raw":
      if (evt.message) run.currentActionText = evt.message;
      break;
  }

  run.elapsedMs = run.startedAt ? now() - run.startedAt : 0;
  return run;
}
