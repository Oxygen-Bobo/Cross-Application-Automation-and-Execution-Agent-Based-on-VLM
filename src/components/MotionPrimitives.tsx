import { MouseEvent, ReactNode, useEffect, useRef, useState } from "react";

type SplitRevealTextProps = {
  text: string;
  className?: string;
  delayStep?: number;
};

export function SplitRevealText({ text, className, delayStep = 34 }: SplitRevealTextProps) {
  return (
    <span className={className}>
      {Array.from(text).map((char, index) => (
        <span
          className="split-char"
          style={{ animationDelay: `${index * delayStep}ms` }}
          key={`${char}-${index}`}
        >
          {char === " " ? "\u00a0" : char}
        </span>
      ))}
    </span>
  );
}

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
};

export function SpotlightCard({ children, className = "" }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }

  return (
    <div ref={ref} className={`spotlight-card ${className}`} onMouseMove={handleMove}>
      {children}
    </div>
  );
}

export function CursorGlow() {
  useEffect(() => {
    const update = (event: PointerEvent) => {
      document.documentElement.style.setProperty("--cursor-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--cursor-y", `${event.clientY}px`);
    };

    window.addEventListener("pointermove", update, { passive: true });
    return () => window.removeEventListener("pointermove", update);
  }, []);

  return <div className="cursor-glow" aria-hidden="true" />;
}

type Spark = {
  id: number;
  x: number;
  y: number;
};

export function ClickSparkLayer() {
  const [sparks, setSparks] = useState<Spark[]>([]);

  useEffect(() => {
    let id = 0;
    const handleClick = (event: MouseEvent | globalThis.MouseEvent) => {
      const next = { id: id++, x: event.clientX, y: event.clientY };
      setSparks((items) => [...items.slice(-5), next]);
      window.setTimeout(() => {
        setSparks((items) => items.filter((item) => item.id !== next.id));
      }, 720);
    };

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className="spark-layer" aria-hidden="true">
      {sparks.map((spark) => (
        <span
          className="click-spark"
          style={{ left: spark.x, top: spark.y }}
          key={spark.id}
        />
      ))}
    </div>
  );
}
