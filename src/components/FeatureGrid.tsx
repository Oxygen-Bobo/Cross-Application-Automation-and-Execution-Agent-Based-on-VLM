import { featureCards } from "../data";

export function FeatureGrid() {
  return (
    <section id="features" className="section-shell reveal">
      <div className="section-heading center">
        <p className="section-kicker">Capabilities</p>
        <h2>从视觉理解到真实桌面动作</h2>
        <p>不只是生成答案，而是把任务拆成可观察、可执行、可验证的桌面操作。</p>
      </div>
      <div className="feature-grid">
        {featureCards.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <article className={`feature-card feature-${index + 1}`} key={feature.title}>
              <div className="icon-tile">
                <Icon aria-hidden="true" />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
