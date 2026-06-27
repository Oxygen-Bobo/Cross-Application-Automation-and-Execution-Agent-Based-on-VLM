import { workflowSteps } from "../data";

export function WorkflowSection() {
  return (
    <section id="workflow" className="section-shell workflow-section reveal">
      <div className="section-heading">
        <p className="section-kicker">Observe · Plan · Act · Verify</p>
        <h2>观察 · 规划 · 执行 · 验证</h2>
      </div>
      <div className="workflow-track">
        {workflowSteps.map((step, index) => (
          <article className="workflow-step" key={step.label}>
            <span className="node-index">{index + 1}</span>
            <small>{step.label}</small>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
