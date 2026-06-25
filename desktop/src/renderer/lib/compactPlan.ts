import type { CompactPlanItem } from "../types/agent";

function item(index: number, icon: string, text: string): CompactPlanItem {
  return { id: `cp-${index}`, index, icon, text, status: "pending" };
}

export function inferCompactPlanFromInstruction(instruction: string): CompactPlanItem[] {
  const text = instruction.trim().toLowerCase();
  if (!text) return [];

  const isChat = /微信|wechat|qq|消息|联系人|文件传输助手|发送/.test(text);
  if (isChat) {
    return [
      item(1, "◎", "确认目标应用和当前窗口"),
      item(2, "⌕", "搜索并打开目标联系人或会话"),
      item(3, "＋", "输入内容或选择要发送的文件"),
      item(4, "↗", "发送并观察结果"),
      item(5, "✓", "确认消息或附件已出现在会话中"),
    ];
  }

  const isBrowser = /浏览器|网页|搜索|查找|chrome|edge|firefox|browser/.test(text);
  if (isBrowser) {
    return [
      item(1, "◎", "打开或聚焦浏览器"),
      item(2, "⌕", "输入搜索词或目标网址"),
      item(3, "✦", "读取页面并筛选关键信息"),
      item(4, "✓", "整理并反馈结果"),
    ];
  }

  const isFile = /文件|文件夹|下载|桌面|整理|移动|复制|保存|上传|附件/.test(text);
  if (isFile) {
    return [
      item(1, "◎", "定位目标目录或文件选择器"),
      item(2, "⌕", "识别目标文件和分类规则"),
      item(3, "↗", "执行移动、复制、上传或保存"),
      item(4, "✓", "检查文件结果是否正确"),
    ];
  }

  const isOffice = /文档|表格|ppt|幻灯片|word|excel|wps|office|报告|报表/.test(text);
  if (isOffice) {
    return [
      item(1, "◎", "打开目标文档或办公应用"),
      item(2, "✦", "理解内容和编辑目标"),
      item(3, "↗", "执行编辑、生成或导出"),
      item(4, "✓", "确认文件已保存或输出完成"),
    ];
  }

  return [
    item(1, "◎", "观察当前屏幕状态"),
    item(2, "✦", "理解任务并规划下一步"),
    item(3, "↗", "执行桌面操作"),
    item(4, "✓", "验证任务结果"),
  ];
}
