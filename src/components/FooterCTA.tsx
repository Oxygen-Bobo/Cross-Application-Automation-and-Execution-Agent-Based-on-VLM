import { Github } from "lucide-react";
import { githubUrl } from "../data";

export function FooterCTA() {
  return (
    <footer className="footer-cta reveal">
      <div className="section-shell">
        <h2>打开 GitHub，立即体验桌面 Agent</h2>
        <p>Cross-Application Automation Agent Based on VLM · Oxygen-Bobo</p>
        <a className="btn btn-primary" href={githubUrl} target="_blank" rel="noreferrer">
          <Github aria-hidden="true" />
          访问开源仓库
        </a>
        <div className="footer-meta">
          <span>VLM</span>
          <span>Qwen-VL</span>
          <span>LangGraph</span>
          <span>PyAutoGUI</span>
          <span>Electron</span>
          <span>Python</span>
        </div>
        <small>© 2026 Oxygen-Bobo. Open-source desktop automation agent project.</small>
      </div>
    </footer>
  );
}
