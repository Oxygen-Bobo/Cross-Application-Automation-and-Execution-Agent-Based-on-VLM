import { ArrowRight, Download, Github, PlayCircle } from "lucide-react";
import { githubUrl } from "../data";
import { SplitRevealText, SpotlightCard } from "./MotionPrimitives";
import { SmartImage } from "./SmartImage";

export function HeroSection() {
  return (
    <section id="top" className="hero section-shell">
      <div className="hero-copy reveal">
        <div className="signal-pill">
          <span className="live-dot" />
          Windows Desktop GUI Automation Agent
        </div>
        <h1 className="hero-title" aria-label="让 Agent 像人一样操作电脑">
          <span className="hero-title-line hero-title-line-agent">
            <SplitRevealText text="让" />
            <em className="agent-word">Agent</em>
          </span>
          <span className="hero-title-line">
            <SplitRevealText text="像人一样" delayStep={28} />
          </span>
          <span className="hero-title-line">
            <SplitRevealText text="操作电脑" delayStep={28} />
          </span>
        </h1>
        <p className="hero-subtitle">
          <span>基于视觉语言模型的</span>
          <strong>Windows 桌面自动化智能体</strong>
        </p>
        <p className="hero-description">
          用户只需输入自然语言任务，Agent 即可观察桌面、理解界面、规划动作，并通过鼠标与键盘完成跨应用自动化操作。
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary btn-glow" href={githubUrl} target="_blank" rel="noreferrer">
            <Github aria-hidden="true" />
            查看 GitHub
          </a>
          <a className="btn btn-secondary" href={githubUrl} target="_blank" rel="noreferrer">
            <Download aria-hidden="true" />
            下载 v1.0.0
          </a>
          <a className="btn btn-ghost" href="#workflow">
            <PlayCircle aria-hidden="true" />
            查看项目介绍
          </a>
        </div>
        <div className="hero-flow" aria-label="核心执行流程">
          {["观察", "规划", "执行", "验证"].map((item, index) => (
            <span key={item}>
              {item}
              {index < 3 && <ArrowRight aria-hidden="true" />}
            </span>
          ))}
        </div>
      </div>
      <div className="hero-visual reveal delay-1">
        <SpotlightCard className="mockup-frame hero-float">
          <div className="mockup-topbar">
            <span />
            <span />
            <span />
            <strong>Cross-Application Automation Agent</strong>
          </div>
          <SmartImage src="/assets/app-main.png" alt="跨应用自动化执行 Agent 主界面截图" />
        </SpotlightCard>
        <div className="status-orb" aria-label="状态悬浮球预览">
          <span className="orb-ring" />
          <span className="orb-core">Act</span>
        </div>
        <div className="tool-card">
          <small>Tool Call</small>
          <strong>click · type · hotkey</strong>
          <span>观察后生成动作，执行后再次验证</span>
        </div>
      </div>
    </section>
  );
}
