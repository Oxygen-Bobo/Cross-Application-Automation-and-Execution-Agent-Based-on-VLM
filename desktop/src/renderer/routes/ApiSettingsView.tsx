import { createSignal, Show } from "solid-js";

export default function ApiSettingsView() {
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

  (async () => {
    try {
      const cfg = await window.electronAPI.config.get();
      setBaseUrl(cfg.baseUrl); setModelName(cfg.modelName);
      setMaxRetry(cfg.maxRetry); setTimeout_(cfg.timeout);
      setHasStoredKey(cfg.hasApiKey); setMaskedKey(cfg.maskedKey);
    } catch {}
  })();

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  const test = async () => {
    setTesting(true); setResult(null);
    try {
      const key = apiKey() || (await window.electronAPI.config.getApiKey()) || "";
      if (!key) { setResult({ ok: false, text: "请先填写 API Key" }); return; }
      const r = await window.electronAPI.config.testConnection({ apiKey: key, baseUrl: baseUrl(), modelName: modelName() });
      setResult({ ok: r.ok, text: r.ok ? "连接成功，模型可用。" : `连接失败：${r.error || "未知错误"}` });
    } catch (e: any) { setResult({ ok: false, text: e.message }); }
    finally { setTesting(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await window.electronAPI.config.save({ baseUrl: baseUrl(), modelName: modelName(), maxRetry: maxRetry(), timeout: timeout(), apiKey: apiKey() || undefined });
      if (r.ok) {
        showToast("配置已保存");
        setHasStoredKey(true);
        if (apiKey()) { setMaskedKey(apiKey().slice(0, 3) + "****" + (apiKey().length > 8 ? apiKey().slice(-4) : "")); setApiKey(""); }
      } else { setResult({ ok: false, text: r.error || "保存失败" }); }
    } catch (e: any) { setResult({ ok: false, text: e.message }); }
    finally { setSaving(false); }
  };

  const clear = async () => {
    await window.electronAPI.config.clearKey();
    setHasStoredKey(false); setMaskedKey(""); setApiKey("");
    showToast("API Key 已清除");
  };

  return (
    <div class="flex-1 overflow-y-auto" style="background:var(--bg-main);padding:32px">
      <div style="max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:24px">

        {/* Profile card */}
        <div class="card-white" style="padding:24px 28px">
          <div class="flex items-center gap-4 mb-4">
            <div class="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white" style="background:var(--brand)">D</div>
            <div>
              <h2 class="text-lg font-semibold text-[var(--text-primary)]">Desktop Agent User</h2>
              <p class="text-sm" style="color:var(--text-tertiary)">本地桌面 Agent 助手</p>
            </div>
          </div>
        </div>

        {/* API config card */}
        <div class="card-white" style="padding:24px 28px">
          <h2 class="text-lg font-semibold text-[var(--text-primary)] mb-1">个人 API 配置</h2>
          <p class="text-sm mb-5" style="color:var(--text-tertiary)">你的 API Key 会加密保存在本地，不会以明文展示。</p>

          <div style="display:flex;flex-direction:column;gap:18px">
            {/* API Key */}
            <div data-component="input">
              <label data-slot="input-label">API Key</label>
              <div data-slot="input-wrapper" style="height:48px">
                <input data-slot="input-input" type={showKey() ? "text" : "password"}
                  placeholder={hasStoredKey() ? maskedKey() : "sk-..."}
                  value={apiKey()} onInput={e => setApiKey(e.currentTarget.value)}
                  autocomplete="off" style="font-family:var(--font-family-mono);font-size:14px" />
                <div data-slot="input-suffix" style="gap:6px">
                  <button data-component="button" data-variant="ghost" data-size="sm" onClick={() => setShowKey(!showKey())}>{showKey() ? "隐藏" : "显示"}</button>
                  <button data-component="button" data-variant="soft-danger" data-size="sm" onClick={clear}>清除</button>
                </div>
              </div>
            </div>

            {/* Base URL */}
            <div data-component="input">
              <label data-slot="input-label">Base URL</label>
              <div data-slot="input-wrapper" style="height:48px">
                <input data-slot="input-input" type="text" value={baseUrl()} onInput={e => setBaseUrl(e.currentTarget.value)} style="font-family:var(--font-family-mono);font-size:14px" />
              </div>
            </div>

            {/* Model Name */}
            <div data-component="input">
              <label data-slot="input-label">Model Name</label>
              <div data-slot="input-wrapper" style="height:48px">
                <input data-slot="input-input" type="text" value={modelName()} onInput={e => setModelName(e.currentTarget.value)} style="font-family:var(--font-family-mono);font-size:14px" />
              </div>
            </div>

            {/* Max Retry + Timeout */}
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

          {/* Result */}
          <Show when={result()}>{(r) => (
            <div class="rounded-xl px-4 py-3 text-sm font-medium mt-4" style={{
              background: r().ok ? "var(--success-soft)" : "var(--danger-soft)",
              color: r().ok ? "var(--success)" : "var(--danger)",
            }}>{r().text}</div>
          )}</Show>

          {/* Actions */}
          <div class="flex gap-3 mt-5">
            <button data-component="button" data-variant="secondary" style="flex:1" onClick={test} disabled={testing()}>{testing() ? "测试中..." : "测试连接"}</button>
            <button data-component="button" data-variant="primary" style="flex:1" onClick={save} disabled={saving()}>{saving() ? "保存中..." : "保存配置"}</button>
          </div>
        </div>

      </div>

      {/* Toast */}
      <Show when={toast()}>{(t) => <div class="fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-lg animate-slide-up-sm" style="background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border-light)">{t()}</div>}</Show>
    </div>
  );
}
