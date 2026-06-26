import { createSignal, For, Show } from "solid-js";
import type { HistoryRun } from "../types";

interface Props {
  history: HistoryRun[];
  onNewTask: () => void;
  onSelectHistory: (id: string) => void;
  onDeleteHistory: (id: string) => void;
  onOpenSchedule: () => void;
  onOpenSettings: () => void;
  selectedId?: string;
  currentStatus: string;
}

export default function Sidebar(props: Props) {
  const [search, setSearch] = createSignal("");
  const [collapsed, setCollapsed] = createSignal(false);

  const filtered = () => {
    const q = search().toLowerCase();
    if (!q) return props.history;
    return props.history.filter(h =>
      h.instruction.toLowerCase().includes(q) ||
      h.status.toLowerCase().includes(q)
    );
  };

  return (
    <aside
      class="flex-shrink-0 flex flex-col select-none border-r relative"
      style={{
        width: collapsed() ? "48px" : "var(--sidebar-width)",
        background: "var(--bg-sidebar)",
        borderColor: "var(--border-light)",
        transition: "width 0.2s ease",
        overflow: "hidden",
      }}
    >
      {/* Collapsed state: just the expand button */}
      <Show when={collapsed()}>
        <div class="flex flex-col items-center pt-4 gap-3">
          <button data-component="icon-button" data-size="sm" onClick={() => setCollapsed(false)} title="展开">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </Show>

      {/* Expanded content */}
      <Show when={!collapsed()}>
      <div class="px-5 pt-5 pb-3">
        <div class="flex items-center gap-2 mb-4">
          <span class="traffic-dot" style="background:var(--traffic-red)" />
          <span class="traffic-dot" style="background:var(--traffic-yellow)" />
          <span class="traffic-dot" style="background:var(--traffic-green)" />
        </div>
        <div class="flex items-center justify-between">
          <h1 class="text-xl font-bold text-[var(--text-primary)] tracking-tight">
            Desktop Agent
          </h1>
          <button data-component="icon-button" data-size="sm"
            onClick={() => setCollapsed(!collapsed())} title="折叠">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div class="px-4 pb-3">
        <div style="display:flex;align-items:center;height:40px;border:1px solid var(--border-light);border-radius:var(--radius-md);background:var(--bg-soft);padding:0 12px;gap:8px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            style="flex:1;height:100%;background:transparent;border:none;outline:none;font-family:inherit;font-size:14px;color:var(--text-primary)"
            placeholder="搜索历史任务"
            value={search()}
            onInput={e => setSearch(e.currentTarget.value)}
          />
        </div>
      </div>

      {/* New task */}
      <div class="px-4 pb-3">
        <button data-component="button" data-variant="primary" style="width:100%" onClick={props.onNewTask}>
          + 新建任务
        </button>
      </div>

      <div class="px-4 pb-3">
        <button
          data-component="button"
          data-variant="ghost"
          style="width:100%;background:var(--bg-soft);border:1px solid var(--border-light);color:var(--text-primary);transition:background .16s ease,border-color .16s ease,transform .16s ease,box-shadow .16s ease"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--brand-soft)";
            e.currentTarget.style.borderColor = "color-mix(in srgb,var(--brand) 28%,var(--border-light))";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 8px 18px rgba(67,51,34,.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--bg-soft)";
            e.currentTarget.style.borderColor = "var(--border-light)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
          onClick={props.onOpenSchedule}
        >
          <span style="display:inline-flex;align-items:center;gap:8px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            定时任务
          </span>
        </button>
      </div>

      {/* History list */}
      <div class="flex-1 overflow-y-auto px-3 pb-2">
        <p class="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider px-2 py-1.5">
          历史任务
        </p>
        <Show when={filtered().length > 0} fallback={
          <p class="text-xs text-[var(--text-tertiary)] px-2 py-4 text-center">
            {search() ? "没有匹配的任务" : "暂无历史任务"}
          </p>
        }>
          <div class="space-y-1">
            <For each={filtered()}>
              {(item) => (
                <div
                  class="history-item group rounded-lg px-3 py-2.5 cursor-default transition-all duration-150"
                  style={{
                    background: props.selectedId === item.id ? "var(--brand-soft)" : "transparent",
                  }}
                  classList={{ "hover:bg-[var(--bg-hover)] hover:translate-x-[-2px] hover:shadow-sm": props.selectedId !== item.id }}
                  onClick={() => props.onSelectHistory(item.id)}
                >
                  <div class="flex items-center gap-2">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-[var(--text-primary)] truncate leading-snug" style="font-size:14px">
                        {item.instruction.slice(0, 35)}
                      </p>
                      <div class="flex items-center gap-2 mt-1.5">
                        <span
                          class="text-[11px] font-medium rounded-full px-2 py-0.5"
                          style={{
                            background: item.status === "completed" ? "var(--success-soft)" :
                              item.status === "failed" ? "var(--danger-soft)" :
                              item.status === "running" ? "var(--brand-soft)" :
                              "var(--bg-soft)",
                            color: item.status === "completed" ? "var(--success)" :
                              item.status === "failed" ? "var(--danger)" :
                              item.status === "running" ? "var(--brand)" :
                              "var(--text-tertiary)",
                          }}
                        >
                          {statusLabel(item.status)}
                        </span>
                        <span class="text-[11px] text-[var(--text-tertiary)]">
                          {(item as any).currentStep || item.stepCount || 0}步 · {new Date(item.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                    <button
                      class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                      style="background:transparent;color:var(--text-tertiary);font-size:14px;line-height:1;border:none;cursor:pointer"
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--danger-soft)"; e.currentTarget.style.color = "var(--danger)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-tertiary)"; }}
                      onClick={(e) => { e.stopPropagation(); props.onDeleteHistory(item.id); }}
                      title="删除"
                    >×</button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Account entry */}
      <div class="border-t px-4 py-3" style="border-color:var(--border-light)">
        <div
          class="flex items-center gap-3 rounded-lg p-2.5 cursor-default transition-colors hover:bg-[var(--bg-hover)]"
          onClick={props.onOpenSettings}
        >
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style="background:var(--brand)">
            D
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-[var(--text-primary)]">账号与设置</p>
            <p class="text-xs text-[var(--text-tertiary)]">API 配置 · 个人信息</p>
          </div>
        </div>
      </div>
      </Show>
    </aside>
  );
}

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    idle: "空闲", running: "运行中", planning: "规划中", observing: "观察中",
    capturing: "截图中", thinking: "思考中", acting: "执行中", waiting: "等待中",
    completed: "已完成", failed: "失败", stopped: "已停止",
  };
  return m[s] || s;
}
