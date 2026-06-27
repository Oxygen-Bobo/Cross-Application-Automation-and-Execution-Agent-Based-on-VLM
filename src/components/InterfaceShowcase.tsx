import { CheckCircle2, History, MessageSquareText, Radar, Route } from "lucide-react";
import { SpotlightCard } from "./MotionPrimitives";
import { SmartImage } from "./SmartImage";

const interfacePoints = [
  "主界面与历史任务",
  "任务输入区",
  "执行时间线",
  "Step 卡片",
  "截图预览",
  "Tool Call",
  "状态悬浮球",
  "账号与设置入口",
];

const workspaceHighlights = [
  {
    icon: MessageSquareText,
    title: "自然语言输入",
    text: "把复杂桌面任务压缩成一句话，直接进入观察、规划和执行循环。",
  },
  {
    icon: History,
    title: "历史任务沉淀",
    text: "保留已执行任务、状态与时间信息，方便继续追问或复盘过程。",
  },
  {
    icon: Route,
    title: "执行入口集中",
    text: "新建任务、常用指令、语音输入与执行按钮集中在主工作区。",
  },
  {
    icon: Radar,
    title: "状态实时同步",
    text: "执行状态会同步到时间线与悬浮状态球，降低等待过程的不确定感。",
  },
];

export function InterfaceShowcase() {
  return (
    <section id="showcase" className="section-shell showcase-section reveal">
      <div className="section-heading center">
        <p className="section-kicker">Interface</p>
        <h2>清晰可见的 Agent 执行过程</h2>
        <p>把屏幕观察、界面理解、桌面执行和最终结果放在同一个可追踪界面里。</p>
      </div>
      <div className="showcase-grid">
        <SpotlightCard className="showcase-main">
          <div className="showcase-caption">
            <span>主工作台</span>
            <strong>自然语言任务、历史记录与执行入口集中展示</strong>
          </div>
          <SmartImage src="/assets/app-main.png" alt="Agent 主界面展示" fallbackTitle="主界面 Mockup" />
          <div className="workspace-detail-grid">
            {workspaceHighlights.map((item, index) => {
              const Icon = item.icon;
              return (
                <article style={{ animationDelay: `${index * 80}ms` }} key={item.title}>
                  <span className="workspace-detail-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </SpotlightCard>
        <SpotlightCard className="showcase-panel">
          <div className="panel-heading">
            <span>执行过程</span>
            <strong>Step Timeline</strong>
            <p>每一步都保留观察、理解和执行状态，方便用户复盘 Agent 的桌面操作。</p>
          </div>
          <div className="timeline-preview">
            <SmartImage src="/assets/timeline.png" alt="Agent 执行时间线展示" fallbackTitle="执行时间线" />
          </div>
          <div className="interface-list">
            {interfacePoints.map((point, index) => (
              <span style={{ animationDelay: `${index * 70}ms` }} key={point}>
                <CheckCircle2 aria-hidden="true" />
                {point}
              </span>
            ))}
          </div>
        </SpotlightCard>
      </div>
    </section>
  );
}
