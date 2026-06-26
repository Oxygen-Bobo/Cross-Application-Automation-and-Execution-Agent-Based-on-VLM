import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { ScheduledTaskDTO, ScheduleRepeat } from "../types/agent";

const APP_OPTIONS = [
  { id: "wechat", label: "微信" },
  { id: "email", label: "网易邮箱" },
  { id: "qq", label: "QQ" },
  { id: "wps", label: "WPS" },
  { id: "browser", label: "Edge 浏览器" },
  { id: "custom", label: "自定义" },
];

const REPEAT_OPTIONS: { id: ScheduleRepeat; label: string }[] = [
  { id: "once", label: "仅一次" },
  { id: "daily", label: "每天" },
  { id: "weekday", label: "工作日" },
  { id: "weekly", label: "每周" },
];

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "待执行",
    running: "执行中",
    completed: "已完成",
    failed: "失败",
    cancelled: "已停用",
  };
  return map[status] || status;
}

function repeatLabel(task: ScheduledTaskDTO) {
  if (task.repeat === "once") return "仅一次";
  if (task.repeat === "daily") return "每天";
  if (task.repeat === "weekday") return "工作日";
  if (task.repeat === "weekly") return `每周${WEEKDAYS[task.repeatDay ?? 1]}`;
  return task.repeat;
}

function formatTime(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function appLabel(id: string) {
  return APP_OPTIONS.find((item) => item.id === id)?.label || "自定义";
}

function statusStyle(status: string) {
  if (status === "running" || status === "pending") return { background: "var(--brand-soft)", color: "var(--brand)" };
  if (status === "completed") return { background: "var(--success-soft)", color: "var(--success)" };
  if (status === "failed") return { background: "var(--danger-soft)", color: "var(--danger)" };
  return { background: "var(--bg-soft)", color: "var(--text-tertiary)" };
}

export default function ScheduleView() {
  const [tasks, setTasks] = createSignal<ScheduledTaskDTO[]>([]);
  const [showForm, setShowForm] = createSignal(false);
  const [editing, setEditing] = createSignal<ScheduledTaskDTO | null>(null);
  const [targetApp, setTargetApp] = createSignal("email");
  const [instruction, setInstruction] = createSignal("");
  const [scheduledDate, setScheduledDate] = createSignal(new Date().toISOString().slice(0, 10));
  const [scheduledTime, setScheduledTime] = createSignal("09:00");
  const [repeat, setRepeat] = createSignal<ScheduleRepeat>("once");
  const [repeatDay, setRepeatDay] = createSignal(1);
  const [error, setError] = createSignal("");

  async function loadTasks() {
    const list = await window.electronAPI.scheduler.list();
    setTasks(list || []);
  }

  onMount(() => {
    loadTasks();
    const offStarted = window.electronAPI.scheduler.onTaskStarted(loadTasks);
    const offFinished = window.electronAPI.scheduler.onTaskFinished(loadTasks);
    onCleanup(() => {
      offStarted();
      offFinished();
    });
  });

  function openCreate() {
    setEditing(null);
    setTargetApp("email");
    setInstruction("");
    setScheduledDate(new Date().toISOString().slice(0, 10));
    setScheduledTime("09:00");
    setRepeat("once");
    setRepeatDay(1);
    setError("");
    setShowForm(true);
  }

  function openEdit(task: ScheduledTaskDTO) {
    setEditing(task);
    setTargetApp(task.targetApp);
    setInstruction(task.instruction);
    setScheduledDate(task.scheduledDate || new Date().toISOString().slice(0, 10));
    setScheduledTime(task.scheduledTime);
    setRepeat(task.repeat);
    setRepeatDay(task.repeatDay ?? 1);
    setError("");
    setShowForm(true);
  }

  async function saveTask() {
    const text = instruction().trim();
    if (!text) {
      setError("请输入任务指令");
      return;
    }
    if (repeat() === "once" && !scheduledDate()) {
      setError("请选择执行日期");
      return;
    }

    const payload = {
      instruction: text,
      targetApp: targetApp(),
      targetAppLabel: appLabel(targetApp()),
      scheduledDate: repeat() === "once" ? scheduledDate() : null,
      scheduledTime: scheduledTime(),
      repeat: repeat(),
      repeatDay: repeat() === "weekly" ? repeatDay() : undefined,
      status: "pending" as const,
      enabled: true,
    };

    const current = editing();
    const result = current
      ? await window.electronAPI.scheduler.update(current.id, payload)
      : await window.electronAPI.scheduler.create(payload);
    if (!result.ok) {
      setError(result.error || "保存失败");
      return;
    }
    setShowForm(false);
    await loadTasks();
  }

  async function toggleTask(task: ScheduledTaskDTO) {
    await window.electronAPI.scheduler.toggle(task.id, !task.enabled);
    await loadTasks();
  }

  async function deleteTask(task: ScheduledTaskDTO) {
    await window.electronAPI.scheduler.delete(task.id);
    await loadTasks();
  }

  async function runNow(task: ScheduledTaskDTO) {
    const result = await window.electronAPI.scheduler.runNow(task.id);
    if (!result.ok) setError(result.error || "启动失败");
    await loadTasks();
  }

  async function stopRunningTask() {
    const result = await window.electronAPI.agent.stop();
    if (!result.ok) setError(result.error || "停止任务失败");
    await loadTasks();
  }

  return (
    <div class="flex-1 min-h-0 overflow-y-auto" style="background:var(--bg-main);padding:28px 36px">
      <div style="max-width:1040px;margin:0 auto">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-2xl font-bold text-[var(--text-primary)]">定时任务</h1>
            <p class="text-sm mt-1 text-[var(--text-tertiary)]">按指定时间自动执行跨应用 Agent 任务。</p>
          </div>
          <button data-component="button" data-variant="primary" onClick={openCreate}>
            新建定时任务
          </button>
        </div>

        <Show when={error() && !showForm()}>
          <div class="border rounded-lg mb-4 text-sm" style="background:var(--danger-soft);border-color:color-mix(in srgb,var(--danger) 24%,transparent);color:var(--danger);padding:10px 12px">
            {error()}
          </div>
        </Show>

        <Show when={tasks().length > 0} fallback={
          <div class="border rounded-xl text-center" style="background:var(--bg-sidebar);border-color:var(--border-light);padding:72px 24px">
            <div class="mx-auto mb-4 flex items-center justify-center rounded-full" style="width:56px;height:56px;background:var(--brand-soft);color:var(--brand)">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <p class="text-base font-semibold text-[var(--text-primary)]">暂无定时任务</p>
            <p class="text-sm mt-2 text-[var(--text-tertiary)]">创建后，系统会在设定时间自动启动 Agent。</p>
          </div>
        }>
          <div class="grid gap-3">
            <For each={tasks()}>
              {(task) => (
                <div class="border rounded-xl" style="background:var(--bg-sidebar);border-color:var(--border-light);padding:18px 20px">
                  <div class="flex items-start gap-4">
                    <div class="rounded-lg flex items-center justify-center shrink-0" style="width:42px;height:42px;background:var(--bg-soft);color:var(--brand)">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-2">
                        <span class="text-xs font-medium rounded-full px-2 py-0.5" style={statusStyle(task.status)}>
                          {statusLabel(task.status)}
                        </span>
                        <span class="text-xs text-[var(--text-tertiary)]">{task.targetAppLabel}</span>
                        <span class="text-xs text-[var(--text-tertiary)]">{repeatLabel(task)} · {task.scheduledTime}</span>
                      </div>
                      <p class="text-sm font-medium text-[var(--text-primary)] leading-relaxed">{task.instruction}</p>
                      <div class="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-[var(--text-tertiary)]">
                        <span>下次执行：{formatTime(task.nextRunAt)}</span>
                        <Show when={task.lastRunAt}>
                          <span>上次执行：{formatTime(task.lastRunAt)}</span>
                        </Show>
                        <Show when={task.lastRunError}>
                          <span style="color:var(--danger)">错误：{task.lastRunError}</span>
                        </Show>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <Show when={task.status === "running"} fallback={
                        <button data-component="button" data-variant="ghost" data-size="sm" onClick={() => runNow(task)}>立即执行</button>
                      }>
                        <button data-component="button" data-variant="soft-danger" data-size="sm" onClick={stopRunningTask}>紧急停止</button>
                      </Show>
                      <button data-component="button" data-variant="ghost" data-size="sm" onClick={() => openEdit(task)}>编辑</button>
                      <button data-component="button" data-variant="ghost" data-size="sm" onClick={() => toggleTask(task)}>
                        {task.enabled ? "停用" : "启用"}
                      </button>
                      <button data-component="button" data-variant="ghost" data-size="sm" style="color:var(--danger)" onClick={() => deleteTask(task)}>删除</button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <Show when={showForm()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(36,31,26,.38);padding:24px">
          <div class="border rounded-xl" style="width:min(620px,100%);background:var(--bg-sidebar);border-color:var(--border-light);box-shadow:var(--shadow-floating);padding:22px">
            <div class="flex items-center justify-between mb-5">
              <h2 class="text-lg font-bold text-[var(--text-primary)]">{editing() ? "编辑定时任务" : "新建定时任务"}</h2>
              <button data-component="icon-button" data-size="sm" onClick={() => setShowForm(false)}>×</button>
            </div>

            <div class="grid gap-4">
              <div>
                <label class="text-sm font-medium text-[var(--text-secondary)] block mb-2">目标应用</label>
                <div class="flex flex-wrap gap-2">
                  <For each={APP_OPTIONS}>
                    {(item) => (
                      <button
                        data-component="button"
                        data-variant={targetApp() === item.id ? "primary" : "ghost"}
                        data-size="sm"
                        onClick={() => setTargetApp(item.id)}
                      >
                        {item.label}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              <div>
                <label class="text-sm font-medium text-[var(--text-secondary)] block mb-2">任务指令</label>
                <textarea
                  value={instruction()}
                  onInput={(e) => setInstruction(e.currentTarget.value)}
                  placeholder="例如：查询今日金价，整理成报告并发送到网易邮箱"
                  style="width:100%;min-height:96px;resize:vertical;border:1px solid var(--border-light);border-radius:var(--radius-md);background:var(--bg-soft);color:var(--text-primary);padding:12px;font-family:inherit;font-size:14px;outline:none"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <Show when={repeat() === "once"}>
                  <div>
                    <label class="text-sm font-medium text-[var(--text-secondary)] block mb-2">日期</label>
                    <input type="date" value={scheduledDate()} onInput={(e) => setScheduledDate(e.currentTarget.value)}
                      style="width:100%;height:40px;border:1px solid var(--border-light);border-radius:var(--radius-md);background:var(--bg-soft);color:var(--text-primary);padding:0 12px" />
                  </div>
                </Show>
                <div>
                  <label class="text-sm font-medium text-[var(--text-secondary)] block mb-2">时间</label>
                  <input type="time" value={scheduledTime()} onInput={(e) => setScheduledTime(e.currentTarget.value)}
                    style="width:100%;height:40px;border:1px solid var(--border-light);border-radius:var(--radius-md);background:var(--bg-soft);color:var(--text-primary);padding:0 12px" />
                </div>
              </div>

              <div>
                <label class="text-sm font-medium text-[var(--text-secondary)] block mb-2">重复</label>
                <div class="flex flex-wrap gap-2">
                  <For each={REPEAT_OPTIONS}>
                    {(item) => (
                      <button data-component="button" data-variant={repeat() === item.id ? "primary" : "ghost"} data-size="sm" onClick={() => setRepeat(item.id)}>
                        {item.label}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              <Show when={repeat() === "weekly"}>
                <div>
                  <label class="text-sm font-medium text-[var(--text-secondary)] block mb-2">星期</label>
                  <div class="flex flex-wrap gap-2">
                    <For each={WEEKDAYS}>
                      {(day, index) => (
                        <button data-component="button" data-variant={repeatDay() === index() ? "primary" : "ghost"} data-size="sm" onClick={() => setRepeatDay(index())}>
                          {day}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              <Show when={error()}>
                <p class="text-sm" style="color:var(--danger)">{error()}</p>
              </Show>

              <div class="flex justify-end gap-2 pt-2">
                <button data-component="button" data-variant="ghost" onClick={() => setShowForm(false)}>取消</button>
                <button data-component="button" data-variant="primary" onClick={saveTask}>保存</button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
