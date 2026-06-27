import { SpotlightCard } from "./MotionPrimitives";

export function ProjectIntro() {
  const steps = ["自然语言任务", "截图观察", "VLM 理解", "LangGraph 规划", "PyAutoGUI 执行", "状态验证"];

  return (
    <section id="intro" className="section-shell intro-section reveal">
      <div className="section-heading">
        <p className="section-kicker">Project Overview</p>
        <h2>什么是跨应用自动化执行 Agent？</h2>
      </div>
      <div className="intro-layout">
        <p>
          这是一个基于 VLM 的桌面 GUI 自动化项目。它通过截图观察当前桌面状态，调用视觉语言模型理解界面，
          再结合 LangGraph 进行多步骤流程编排，最终通过 PyAutoGUI 执行鼠标、键盘、滚动、输入等操作。
        </p>
        <SpotlightCard className="pipeline" aria-label="从自然语言到桌面操作的流程">
          {steps.map((step, index) => (
            <span style={{ animationDelay: `${index * 90}ms` }} key={step}>
              {step}
            </span>
          ))}
        </SpotlightCard>
      </div>
    </section>
  );
}
