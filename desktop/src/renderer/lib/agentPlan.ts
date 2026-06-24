import type { PlanItem } from "../types/agent";

function item(idx: number, title: string, desc?: string): PlanItem {
  return { id: `plan-${idx}-${Date.now()}`, index: idx, title, description: desc, status: "pending", details: { rawLogs: [] } };
}

export function inferDetailedPlanFromInstruction(instruction: string): PlanItem[] {
  const t = instruction.trim(); if (!t) return [];
  const lower = t.toLowerCase();

  // WeChat message
  if (t.includes("微信") || lower.includes("wechat") || t.includes("发消息") || t.includes("发送消息")) {
    const cm = t.match(/给(.+?)(发送|发|问|说)/) || t.match(/联系人(.+?)(发送|发|问|说)/);
    const contact = cm?.[1]?.trim();
    const msg = t.match(/消息(.+)/) || t.match(/说(.+)/) || t.match(/问(.+)/);
    const msgText = msg?.[1]?.trim();
    return [
      item(1, "观察当前桌面环境", "确认微信是否已打开，查看当前桌面和任务栏。"),
      item(2, "定位微信入口", "在桌面或任务栏中寻找微信图标。"),
      item(3, "打开微信窗口", "点击微信图标，等待主界面加载完成。"),
      item(4, "定位搜索框或联系人入口", "在微信界面中找到搜索或通讯录入口。"),
      item(5, contact ? `搜索联系人「${contact}」` : "搜索目标联系人", "输入名称并确认搜索结果。"),
      item(6, "打开聊天窗口", "进入对应联系人的聊天界面。"),
      item(7, "定位消息输入框", "确认输入框位置。"),
      item(8, msgText ? `输入消息「${msgText}」` : "输入消息内容", "在聊天框中输入用户指定的消息。"),
      item(9, "发送消息", "点击发送按钮或使用快捷键发送。"),
      item(10, "确认发送结果", "截图检查消息是否出现在聊天窗口中。"),
    ];
  }

  // Report generation
  if (t.includes("报表") || t.includes("报告") || (t.includes("PDF") || t.includes("pdf")) && t.includes("生成")) {
    return [
      item(1, "解析任务需求", "识别时间范围、输出格式和保存路径。"),
      item(2, "确认数据来源", "判断需要访问的系统、网页或本地文件。"),
      item(3, "获取目标数据", "定位并提取需要的数据内容。"),
      item(4, "整理并生成报表", "汇总关键信息并生成结构化内容。"),
      item(5, "导出/保存文件", "将整理结果保存为指定格式。"),
      item(6, "验证保存结果", "检查目标目录，确认文件已保存。"),
      item(7, "记录执行结果", "将任务结果写入历史。"),
    ];
  }

  // File organization
  if (t.includes("整理") && (t.includes("文件") || t.includes("桌面"))) {
    return [
      item(1, "观察当前文件环境", "扫描桌面或目标目录的文件分布。"),
      item(2, "识别文件类型", "按文档、图片、压缩包等分类。"),
      item(3, "创建分类文件夹", "按要求建好目标目录结构。"),
      item(4, "移动文件到对应文件夹", "逐个将文件移入正确目录。"),
      item(5, "检查整理结果", "确认所有文件已归类。"),
    ];
  }

  if (t.includes("下载") && (t.includes("查找") || t.includes("文件"))) {
    return [
      item(1, "打开下载目录", "定位到系统的下载文件夹。"),
      item(2, "按时间排序", "识别最近下载的文件。"),
      item(3, "展示文件列表", "向用户展示找到的文件。"),
    ];
  }

  // Search / browse
  if (t.includes("搜索") || t.includes("查找") || t.includes("浏览器")) {
    return [
      item(1, "观察当前桌面", "确认浏览器是否已打开。"),
      item(2, "打开浏览器", "定位浏览器入口并启动。"),
      item(3, "输入搜索关键词", "在地址栏或搜索框中输入内容。"),
      item(4, "等待页面加载", "确认搜索结果已显示。"),
      item(5, "提取关键信息", "读取搜索结果中的相关内容。"),
      item(6, "向用户汇总", "以简洁方式呈现结果。"),
    ];
  }

  // Generic: extract key actions
  const verbs = t.match(/(打开|搜索|查找|输入|发送|确认|关闭|查看|点击|选择|下载|上传|保存|删除|整理|提取|总结|生成|切换|等待|调整|检查|清理)/g);
  if (verbs && verbs.length >= 2) {
    const plan: PlanItem[] = [item(1, "观察当前桌面环境", "截图查看当前界面状态。")];
    for (let i = 0; i < verbs.length; i++) {
      plan.push(item(i + 2, `执行：${verbs[i]}`, `根据任务要求执行 ${verbs[i]} 操作。`));
    }
    plan.push(item(plan.length + 1, "检查执行结果", "确认所有操作已完成。"));
    return plan;
  }

  // Fallback
  return [
    item(1, "分析用户任务", "理解用户的目标和操作路径。"),
    item(2, "观察当前屏幕", "截图识别界面中的按钮和输入框。"),
    item(3, "规划操作步骤", "结合视觉识别结果规划下一步。"),
    item(4, "执行桌面动作", "通过鼠标、键盘执行操作。"),
    item(5, "检查执行结果", "截图验证动作是否成功。"),
    item(6, "汇总任务结果", "任务完成后向用户报告。"),
  ];
}

export function updatePlanByCurrentStep(plan: PlanItem[], currentStep: number): PlanItem[] {
  return plan.map((p) => {
    if (p.index < currentStep) return { ...p, status: "done" as const };
    if (p.index === currentStep) return { ...p, status: "running" as const };
    return { ...p, status: "pending" as const };
  });
}
