import { createSignal } from "solid-js";
import type { ParentProps } from "solid-js";
import { useNavigate } from "@solidjs/router";
import Sidebar from "./components/Sidebar";
import type { HistoryRun } from "./types";

export default function App(props: ParentProps) {
  const navigate = useNavigate();
  const [history, setHistory] = createSignal<HistoryRun[]>([]);
  const [status, setStatus] = createSignal("idle");

  (window as any).__setHistory = (h: HistoryRun[]) => setHistory(h);
  (window as any).__setStatus = (s: string) => setStatus(s);

  async function refreshList() {
    try {
      const h = await (window as any).electronAPI?.agent?.getHistory?.() || [];
      setHistory(h);
    } catch {}
  }

  return (
    <div class="flex h-full" style="background:var(--bg-main)">
      <Sidebar
        history={history()}
        onNewTask={() => {
          (window as any).__newTask?.();
          navigate("/");
        }}
        onSelectHistory={(id) => {
          navigate("/");
          setTimeout(() => (window as any).__loadPastRun?.(id), 50);
        }}
        onDeleteHistory={async (id) => {
          await window.electronAPI.agent.deleteHistory(id);
          const h = await window.electronAPI.agent.getHistory();
          setHistory(h || []);
        }}
        onOpenSettings={() => navigate("/settings")}
        currentStatus={status()}
      />
      <div class="flex-1 flex min-w-0">{props.children}</div>
    </div>
  );
}
