import { ArrowUpRight, Download, Github } from "lucide-react";
import { githubUrl, highlights } from "../data";

export function ReleaseSection() {
  return (
    <section id="release" className="section-shell release-section reveal">
      <div className="release-card">
        <div>
          <p className="section-kicker">Release</p>
          <h2>立即体验 v1.0.0</h2>
          <p>
            当前版本支持 Windows 安装包。用户安装后配置 API Key，即可开始输入自然语言任务，观察 Agent 如何执行真实桌面操作。
          </p>
          <div className="release-actions">
            <a className="btn btn-primary" href={githubUrl} target="_blank" rel="noreferrer">
              <Download aria-hidden="true" />
              前往 Release
            </a>
            <a className="btn btn-secondary" href={githubUrl} target="_blank" rel="noreferrer">
              <Github aria-hidden="true" />
              查看安装说明
            </a>
          </div>
        </div>
        <div className="highlight-list">
          <h3>为什么值得关注？</h3>
          {highlights.map((item) => (
            <span key={item}>
              {item}
              <ArrowUpRight aria-hidden="true" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
