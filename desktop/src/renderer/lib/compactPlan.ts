import type { CompactPlanItem } from "../types/agent";
function p(i:number,icon:string,text:string):CompactPlanItem{return{id:`cp-${i}`,index:i,icon,text,status:"pending"}}
export function inferCompactPlanFromInstruction(instruction:string):CompactPlanItem[]{
  const t=instruction.trim();if(!t)return[];
  const isWx=t.includes("微信")||t.includes("wechat")||t.includes("发消息")||t.includes("发送消息");
  if(isWx)return[p(1,"💬","打开微信应用窗口"),p(2,"🔍","在微信中搜索目标联系人"),p(3,"📝","打开聊天窗口输入消息"),p(4,"📤","点击发送按钮发送消息"),p(5,"✅","截图确认消息发送成功")];
  const isBr=t.includes("浏览器")||t.includes("搜索");
  if(isBr)return[p(1,"🌐","打开浏览器应用程序"),p(2,"🔍","在搜索框输入关键词"),p(3,"👀","等待并查看搜索结果"),p(4,"📌","提取并整理关键信息")];
  const isFi=t.includes("文件")||t.includes("整理")||t.includes("下载")||t.includes("桌面");
  if(isFi)return[p(1,"📁","扫描目标目录中的文件"),p(2,"🏷️","识别文件类型并分类"),p(3,"🗂️","创建分类文件夹"),p(4,"📦","移动文件到对应文件夹"),p(5,"✅","检查整理结果")];
  const isRp=t.includes("报表")||t.includes("PDF")||t.includes("pdf")||t.includes("销售");
  if(isRp)return[p(1,"📊","确认数据来源并获取数据"),p(2,"🧮","整理数据生成报表内容"),p(3,"📄","导出或保存为文档"),p(4,"💾","验证文件保存成功")];
  return[p(1,"👀","观察当前桌面界面状态"),p(2,"🧠","分析任务需求并规划步骤"),p(3,"🖱️","逐步执行桌面操作"),p(4,"✅","检查并确认执行结果")];
}
