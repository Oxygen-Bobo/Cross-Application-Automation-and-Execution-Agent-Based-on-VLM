import { createSignal, For, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import type { PaymentOrder, PublicUserProfile } from "../../preload/index";
import { clearCurrentUser, currentUser, loadStoredUser, persistCurrentUser } from "../state/authStore";
import "../styles/pro.css";

function formatDate(value?: string | null) {
  if (!value) return "未开通";
  return new Date(value).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function orderStatus(status: string) {
  const map: Record<string, string> = {
    pending: "待支付",
    paid_pending_review: "等待确认",
    activated: "已开通",
    cancelled: "已取消",
  };
  return map[status] || status;
}

function planName(plan: string) {
  return plan === "pro_yearly" ? "Pro 年付" : "Pro 月付";
}

export default function ApiSettingsView(props: { user?: PublicUserProfile; onLogout?: () => void }) {
  const navigate = useNavigate();
  const [user, setUser] = createSignal<PublicUserProfile | null>(props.user || currentUser() || loadStoredUser());
  const [orders, setOrders] = createSignal<PaymentOrder[]>([]);
  const [apiKey, setApiKey] = createSignal("");
  const [baseUrl, setBaseUrl] = createSignal("https://dashscope.aliyuncs.com/compatible-mode/v1");
  const [modelName, setModelName] = createSignal("qwen3-vl-plus");
  const [maxRetry, setMaxRetry] = createSignal(10);
  const [timeout, setTimeout_] = createSignal(30);
  const [showKey, setShowKey] = createSignal(false);
  const [testing, setTesting] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [result, setResult] = createSignal<{ ok: boolean; text: string } | null>(null);
  const [maskedKey, setMaskedKey] = createSignal("");
  const [hasStoredKey, setHasStoredKey] = createSignal(false);
  const [toast, setToast] = createSignal<string | null>(null);

  async function refresh() {
    try {
      const current = await window.electronAPI.auth.getCurrentUser().catch(() => null);
      const nextUser = current || currentUser() || loadStoredUser();
      setUser(nextUser);
      if (current) {
        persistCurrentUser(current);
      }
      setOrders(nextUser ? await window.electronAPI.payment.getOrders().catch(() => []) : []);
      const cfg = await window.electronAPI.config.get();
      setBaseUrl(cfg.baseUrl);
      setModelName(cfg.modelName);
      setMaxRetry(cfg.maxRetry);
      setTimeout_(cfg.timeout);
      setHasStoredKey(cfg.hasApiKey);
      setMaskedKey(cfg.maskedKey);
    } catch {}
  }

  onMount(refresh);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const key = apiKey() || (await window.electronAPI.config.getApiKey()) || "";
      if (!key) {
        setResult({ ok: false, text: "请先填写 API Key" });
        return;
      }
      const r = await window.electronAPI.config.testConnection({ apiKey: key, baseUrl: baseUrl(), modelName: modelName() });
      setResult({ ok: r.ok, text: r.ok ? "连接成功，模型可用。" : `连接失败：${r.error || "未知错误"}` });
    } catch (e: any) {
      setResult({ ok: false, text: e.message || "连接测试失败" });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await window.electronAPI.config.save({
        baseUrl: baseUrl(),
        modelName: modelName(),
        maxRetry: maxRetry(),
        timeout: timeout(),
        apiKey: apiKey() || undefined,
      });
      if (r.ok) {
        showToast("配置已保存");
        setHasStoredKey(true);
        if (apiKey()) {
          setMaskedKey(apiKey().slice(0, 3) + "****" + (apiKey().length > 8 ? apiKey().slice(-4) : ""));
          setApiKey("");
        }
      } else {
        setResult({ ok: false, text: r.error || "保存失败" });
      }
    } catch (e: any) {
      setResult({ ok: false, text: e.message || "保存失败" });
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    await window.electronAPI.config.clearKey();
    setHasStoredKey(false);
    setMaskedKey("");
    setApiKey("");
    showToast("API Key 已清除");
  };

  const logout = async () => {
    await window.electronAPI.agent.stop().catch(() => {});
    await window.electronAPI.floating.hide().catch(() => {});
    await window.electronAPI.auth.logout().catch(() => {});
    clearCurrentUser();
    setUser(null);
    setOrders([]);
    props.onLogout?.();
  };

  return (
    <div class="flex-1 overflow-y-auto" style="background:var(--bg-main);padding:32px">
      <div style="max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:24px">
        <div class="card-white" style="padding:24px 28px">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white" style="background:var(--brand)">
                {(user()?.nickname || user()?.email || "A").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h2 class="text-lg font-semibold text-[var(--text-primary)]">{user()?.nickname || "未登录用户"}</h2>
                <p class="text-sm" style="color:var(--text-tertiary)">{user()?.email || "请先登录"}</p>
              </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
              <Show
                when={user()}
                fallback={
                  <button data-component="button" data-variant="primary" data-size="sm" style="font-weight:800" onClick={() => navigate("/login")}>
                    登录 / 注册
                  </button>
                }
              >
                {(activeUser) => (
                  <>
                    <span class="plan-pill" classList={{ pro: activeUser().plan === "pro" }}>
                      {activeUser().plan === "pro" ? "Pro 已开通" : "Basic"}
                    </span>
                    <button class="plan-pill account-upgrade-button" onClick={() => navigate("/purchase")}>
                      {activeUser().plan === "pro" ? "续费 Pro" : "升级 Pro"}
                    </button>
                    <button data-component="button" data-variant="soft-danger" data-size="sm" onClick={logout}>退出登录</button>
                  </>
                )}
              </Show>
            </div>
          </div>
          <div style="margin-top:18px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">
            <div class="pro-info-card" style="box-shadow:none"><h3>当前套餐</h3><p>{user() ? (user()?.plan === "pro" ? "Pro" : "Basic") : "未登录"}</p></div>
            <div class="pro-info-card" style="box-shadow:none"><h3>Pro 到期时间</h3><p>{formatDate(user()?.proExpireAt)}</p></div>
            <div class="pro-info-card" style="box-shadow:none"><h3>账号数据</h3><p>{user() ? "已按当前账号保存" : "登录后启用个人数据"}</p></div>
          </div>
        </div>

        <div class="card-white" style="padding:24px 28px">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-lg font-semibold text-[var(--text-primary)]">订单记录</h2>
              <p class="text-sm" style="color:var(--text-tertiary)">登录后可查看当前账号的购买记录。</p>
            </div>
            <button data-component="button" data-variant="secondary" data-size="sm" style="font-weight:800" onClick={() => navigate(user() ? "/purchase" : "/login")}>
              {user() ? "打开购买页" : "请先登录"}
            </button>
          </div>
          <Show when={orders().length > 0} fallback={<p class="text-sm" style="color:var(--text-tertiary)">暂无订单记录。</p>}>
            <div style="display:flex;flex-direction:column;gap:8px">
              <For each={orders().slice(0, 5)}>
                {(order) => (
                  <div style="display:grid;grid-template-columns:1fr 90px 90px 120px;gap:12px;align-items:center;padding:10px 12px;border:1px solid var(--border-light);border-radius:12px;background:var(--bg-soft)">
                    <span class="text-sm text-[var(--text-primary)]">{planName(order.plan)}</span>
                    <span class="text-sm text-[var(--text-primary)]">¥{order.amount}</span>
                    <span class="text-sm" style="color:var(--text-tertiary)">{orderStatus(order.status)}</span>
                    <button data-component="button" data-variant="ghost" data-size="sm" onClick={() => navigate(`/payment/${order.id}`)}>查看</button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        <div class="card-white" style="padding:24px 28px">
          <h2 class="text-lg font-semibold text-[var(--text-primary)] mb-1">个人 API 配置</h2>
          <p class="text-sm mb-5" style="color:var(--text-tertiary)">API Key 会加密保存在当前用户的本地目录中，不会明文展示。</p>

          <div style="display:flex;flex-direction:column;gap:18px">
            <div data-component="input">
              <label data-slot="input-label">API Key</label>
              <div data-slot="input-wrapper" style="height:48px">
                <input data-slot="input-input" type={showKey() ? "text" : "password"} placeholder={hasStoredKey() ? maskedKey() : "sk-..."} value={apiKey()} onInput={e => setApiKey(e.currentTarget.value)} autocomplete="off" style="font-family:var(--font-family-mono);font-size:14px" />
                <div data-slot="input-suffix" style="gap:6px">
                  <button data-component="button" data-variant="ghost" data-size="sm" onClick={() => setShowKey(!showKey())}>{showKey() ? "隐藏" : "显示"}</button>
                  <button data-component="button" data-variant="soft-danger" data-size="sm" onClick={clear}>清除</button>
                </div>
              </div>
            </div>

            <div data-component="input">
              <label data-slot="input-label">Base URL</label>
              <div data-slot="input-wrapper" style="height:48px">
                <input data-slot="input-input" type="text" value={baseUrl()} onInput={e => setBaseUrl(e.currentTarget.value)} style="font-family:var(--font-family-mono);font-size:14px" />
              </div>
            </div>

            <div data-component="input">
              <label data-slot="input-label">Model Name</label>
              <div data-slot="input-wrapper" style="height:48px">
                <input data-slot="input-input" type="text" value={modelName()} onInput={e => setModelName(e.currentTarget.value)} style="font-family:var(--font-family-mono);font-size:14px" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div data-component="input">
                <label data-slot="input-label">Max Retry</label>
                <div data-slot="input-wrapper" style="height:48px"><input data-slot="input-input" type="number" min={1} max={20} value={maxRetry()} onInput={e => setMaxRetry(Number(e.currentTarget.value))} /></div>
              </div>
              <div data-component="input">
                <label data-slot="input-label">Timeout (s)</label>
                <div data-slot="input-wrapper" style="height:48px"><input data-slot="input-input" type="number" min={5} max={120} value={timeout()} onInput={e => setTimeout_(Number(e.currentTarget.value))} /></div>
              </div>
            </div>
          </div>

          <Show when={result()}>{(r) => (
            <div class="rounded-xl px-4 py-3 text-sm font-medium mt-4" style={{
              background: r().ok ? "var(--success-soft)" : "var(--danger-soft)",
              color: r().ok ? "var(--success)" : "var(--danger)",
            }}>{r().text}</div>
          )}</Show>

          <div class="flex gap-3 mt-5">
            <button data-component="button" data-variant="secondary" style="flex:1" onClick={test} disabled={testing()}>{testing() ? "测试中..." : "测试连接"}</button>
            <button data-component="button" data-variant="primary" style="flex:1" onClick={save} disabled={saving()}>{saving() ? "保存中..." : "保存配置"}</button>
          </div>
        </div>
      </div>

      <Show when={toast()}>{(t) => <div class="fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-lg animate-slide-up-sm" style="background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border-light)">{t()}</div>}</Show>
    </div>
  );
}
