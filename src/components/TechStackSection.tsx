import { techStack } from "../data";

export function TechStackSection() {
  return (
    <section id="tech" className="section-shell tech-section reveal">
      <div className="section-heading">
        <p className="section-kicker">Architecture</p>
        <h2>技术栈与系统架构</h2>
      </div>
      <div className="tech-layout">
        <div className="architecture-card">
          <div className="arch-line">Electron UI</div>
          <div className="arch-arrow">JSON Lines</div>
          <div className="arch-line strong">Python Agent Backend</div>
          <div className="arch-chain">
            <span>Observe</span>
            <span>VLM Reasoning</span>
            <span>LangGraph State</span>
            <span>Tool Call</span>
            <span>PyAutoGUI Action</span>
          </div>
          <div className="arch-line muted">Timeline / Screenshot / History / Status Orb</div>
        </div>
        <div className="tech-grid">
          {techStack.map((tech) => {
            const Icon = tech.icon;
            return (
              <article key={tech.name}>
                <Icon aria-hidden="true" />
                <strong>{tech.name}</strong>
                <span>{tech.role}</span>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
