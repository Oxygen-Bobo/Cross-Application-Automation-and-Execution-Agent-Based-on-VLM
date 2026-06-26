import { createSignal, onCleanup, onMount } from "solid-js";
import type { ParentProps } from "solid-js";
import { useNavigate } from "@solidjs/router";
import Sidebar from "./components/Sidebar";
import type { HistoryRun } from "./types";

export default function App(props: ParentProps) {
  const navigate = useNavigate();
  const [history, setHistory] = createSignal<HistoryRun[]>([]);
  const [status, setStatus] = createSignal("idle");
  let scheduledRun: { taskId: string; instruction: string; maxSteps: number; currentStep: number } | null = null;

  (window as any).__setHistory = (h: HistoryRun[]) => setHistory(h);
  (window as any).__setStatus = (s: string) => setStatus(s);

  async function refreshList() {
    try {
      const h = await (window as any).electronAPI?.agent?.getHistory?.() || [];
      setHistory(h);
    } catch {}
  }

  onMount(() => {
    const cleanups: (() => void)[] = [];
    const api = window.electronAPI;

    cleanups.push(api.scheduler.onTaskStarted((data: any) => {
      const task = data?.task;
      scheduledRun = {
        taskId: data?.taskId,
        instruction: task?.instruction || "定时任务正在执行",
        maxSteps: 50,
        currentStep: 0,
      };
      setStatus("running");
      api.floating.show();
      api.floating.update({
        status: "running",
        instruction: scheduledRun.instruction,
        actionText: "定时任务已启动",
        currentStep: 0,
        maxSteps: scheduledRun.maxSteps,
        progressPercent: 0,
        currentPhase: "running",
      });
    }));

    cleanups.push(api.agent.onEvent((event: any) => {
      if (!scheduledRun || event?.taskId !== scheduledRun.taskId) return;
      if (event.type === "run_started") {
        scheduledRun.instruction = event.instruction || scheduledRun.instruction;
        scheduledRun.maxSteps = event.maxSteps || scheduledRun.maxSteps;
      }
      if (event.type === "step_started" && typeof event.step === "number") {
        scheduledRun.currentStep = event.step;
      }
      if (event.type === "output" && event.text) {
        api.floating.update({
          status: "running",
          instruction: scheduledRun.instruction,
          actionText: event.text,
          currentStep: scheduledRun.currentStep,
          maxSteps: scheduledRun.maxSteps,
          progressPercent: Math.min(95, Math.round((scheduledRun.currentStep / scheduledRun.maxSteps) * 100)),
          currentPhase: "thinking",
        });
      }
      if (event.type === "run_finished") {
        const ok = event.status === "success" || event.status === "completed";
        api.floating.update({
          status: ok ? "completed" : "failed",
          instruction: scheduledRun.instruction,
          actionText: ok ? "定时任务执行完成" : (event.error || "定时任务执行失败"),
          currentStep: scheduledRun.currentStep,
          maxSteps: scheduledRun.maxSteps,
          progressPercent: ok ? 100 : Math.min(95, Math.round((scheduledRun.currentStep / scheduledRun.maxSteps) * 100)),
          currentPhase: ok ? "completed" : "failed",
        });
        scheduledRun = null;
        setStatus(ok ? "completed" : "failed");
      }
    }));

    cleanups.push(api.scheduler.onTaskFinished((data: any) => {
      if (!scheduledRun || data?.taskId !== scheduledRun.taskId) return;
      const ok = data?.status === "completed" || data?.status === "success";
      api.floating.update({
        status: ok ? "completed" : "failed",
        instruction: scheduledRun.instruction,
        actionText: ok ? "定时任务执行完成" : (data?.error || "定时任务执行失败"),
        currentStep: scheduledRun.currentStep,
        maxSteps: scheduledRun.maxSteps,
        progressPercent: ok ? 100 : Math.min(95, Math.round((scheduledRun.currentStep / scheduledRun.maxSteps) * 100)),
        currentPhase: ok ? "completed" : "failed",
      });
      scheduledRun = null;
      setStatus(ok ? "completed" : "failed");
    }));

    onCleanup(() => cleanups.forEach((dispose) => dispose()));
  });

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
        onOpenSchedule={() => navigate("/schedule")}
        onOpenSettings={() => navigate("/settings")}
        currentStatus={status()}
      />
      <div class="flex-1 flex min-w-0">{props.children}</div>
    </div>
  );
}
