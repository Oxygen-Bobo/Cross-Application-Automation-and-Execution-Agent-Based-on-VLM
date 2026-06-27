import { safetyNotes, useCases } from "../data";

export function UseCases() {
  return (
    <section className="section-shell usecase-section reveal">
      <div className="section-heading center">
        <p className="section-kicker">Use Cases</p>
        <h2>它可以做什么？</h2>
      </div>
      <div className="usecase-grid">
        {useCases.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title}>
              <Icon aria-hidden="true" />
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          );
        })}
      </div>
      <div className="safety-strip" aria-label="高风险操作确认机制">
        {safetyNotes.map((note) => (
          <span key={note}>{note}</span>
        ))}
      </div>
    </section>
  );
}
