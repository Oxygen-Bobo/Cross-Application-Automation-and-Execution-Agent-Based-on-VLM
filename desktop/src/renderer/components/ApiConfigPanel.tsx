import { createSignal, Show } from "solid-js";

export default function ApiConfigPanel() {
  const [apiKey, setApiKey] = createSignal("");
  const [baseUrl, setBaseUrl] = createSignal(
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
  );
  const [modelName, setModelName] = createSignal("qwen3-vl-plus");
  const [maxRetry, setMaxRetry] = createSignal(10);
  const [timeout, setTimeout_] = createSignal(30);
  const [showKey, setShowKey] = createSignal(false);
  const [testing, setTesting] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [result, setResult] = createSignal<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [maskedKey, setMaskedKey] = createSignal("");
  const [hasStoredKey, setHasStoredKey] = createSignal(false);

  (async () => {
    try {
      const cfg = await window.electronAPI.config.get();
      setBaseUrl(cfg.baseUrl);
      setModelName(cfg.modelName);
      setMaxRetry(cfg.maxRetry);
      setTimeout_(cfg.timeout);
      setHasStoredKey(cfg.hasApiKey);
      setMaskedKey(cfg.maskedKey);
    } catch {}
  })();

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const key =
        apiKey() || (await window.electronAPI.config.getApiKey()) || "";
      if (!key) {
        setResult({ ok: false, text: "API Key is required" });
        return;
      }
      const r = await window.electronAPI.config.testConnection({
        apiKey: key,
        baseUrl: baseUrl(),
        modelName: modelName(),
      });
      setResult({
        ok: r.ok,
        text: r.ok ? "Connected successfully" : r.error || "Connection failed",
      });
    } catch (e: any) {
      setResult({ ok: false, text: e.message || "Connection failed" });
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
        setResult({ ok: true, text: "Saved" });
        setHasStoredKey(true);
        if (apiKey()) {
          setMaskedKey(
            apiKey().slice(0, 3) +
              "****" +
              (apiKey().length > 8 ? apiKey().slice(-4) : ""),
          );
          setApiKey("");
        }
      } else {
        setResult({ ok: false, text: r.error || "Save failed" });
      }
    } catch (e: any) {
      setResult({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    await window.electronAPI.config.clearKey();
    setHasStoredKey(false);
    setMaskedKey("");
    setApiKey("");
    setResult({ ok: true, text: "API key cleared" });
  };

  return (
    <div class="max-w-[400px] mx-auto space-y-5">
      <div>
        <h2 class="text-[14px] font-semibold text-[var(--text-strong)]">
          Personal API Configuration
        </h2>
        <p class="text-[11px] text-[var(--text-weaker)] mt-1">
          Your API key is encrypted and never stored in plaintext.
        </p>
      </div>

      {/* API Key */}
      <div data-component="input">
        <label data-slot="input-label">API Key</label>
        <div data-slot="input-wrapper">
          <input
            data-slot="input-input"
            data-monospace="true"
            type={showKey() ? "text" : "password"}
            placeholder={hasStoredKey() ? maskedKey() : "sk-..."}
            value={apiKey()}
            onInput={(e) => setApiKey(e.currentTarget.value)}
            autocomplete="off"
          />
          <div data-slot="input-suffix">
            <button
              data-component="button"
              data-variant="ghost"
              data-size="small"
              onClick={() => setShowKey(!showKey())}
            >
              {showKey() ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      </div>

      {/* Base URL */}
      <div data-component="input">
        <label data-slot="input-label">Base URL</label>
        <div data-slot="input-wrapper">
          <input
            data-slot="input-input"
            data-monospace="true"
            type="text"
            value={baseUrl()}
            onInput={(e) => setBaseUrl(e.currentTarget.value)}
          />
        </div>
      </div>

      {/* Model Name */}
      <div data-component="input">
        <label data-slot="input-label">Model Name</label>
        <div data-slot="input-wrapper">
          <input
            data-slot="input-input"
            data-monospace="true"
            type="text"
            value={modelName()}
            onInput={(e) => setModelName(e.currentTarget.value)}
          />
        </div>
      </div>

      {/* Max Retry + Timeout */}
      <div class="grid grid-cols-2 gap-3">
        <div data-component="input">
          <label data-slot="input-label">Max Retry</label>
          <div data-slot="input-wrapper">
            <input
              data-slot="input-input"
              type="number"
              min={1}
              max={20}
              value={maxRetry()}
              onInput={(e) => setMaxRetry(Number(e.currentTarget.value))}
            />
          </div>
        </div>
        <div data-component="input">
          <label data-slot="input-label">Timeout (s)</label>
          <div data-slot="input-wrapper">
            <input
              data-slot="input-input"
              type="number"
              min={5}
              max={120}
              value={timeout()}
              onInput={(e) => setTimeout_(Number(e.currentTarget.value))}
            />
          </div>
        </div>
      </div>

      {/* Result */}
      <Show when={result()}>
        {(r) => (
          <div
            class={`rounded-md px-3 py-2 text-[12px] font-medium border ${
              r().ok
                ? "bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] border-[color-mix(in_srgb,var(--color-success)_30%,transparent)] text-[var(--color-success)]"
                : "bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] border-[color-mix(in_srgb,var(--color-error)_30%,transparent)] text-[var(--color-error)]"
            }`}
          >
            {r().text}
          </div>
        )}
      </Show>

      {/* Actions */}
      <div class="flex gap-2">
        <button
          data-component="button"
          data-variant="secondary"
          data-size="normal"
          style="flex:1"
          onClick={test}
          disabled={testing()}
        >
          {testing() ? "Testing..." : "Test Connection"}
        </button>
        <button
          data-component="button"
          data-variant="primary"
          data-size="normal"
          style="flex:1"
          onClick={save}
          disabled={saving()}
        >
          {saving() ? "Saving..." : "Save"}
        </button>
        <button
          data-component="button"
          data-variant="danger"
          data-size="normal"
          onClick={clear}
        >
          Clear Key
        </button>
      </div>
    </div>
  );
}
