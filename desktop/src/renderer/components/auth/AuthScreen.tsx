import { createSignal, Show } from "solid-js";
import type { PublicUserProfile } from "../../../preload/index";
import { createLocalUser, findRegisteredUser, persistCurrentUser, saveRegisteredUser } from "../../state/authStore";
import "../../styles/auth.css";

type AuthResult = { ok: boolean; user?: PublicUserProfile; error?: string };

function timeoutAfter<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("请求超时，请重启桌面应用后重试。")), ms);
    }),
  ]);
}

export default function AuthScreen(props: { onAuthenticated: (user: PublicUserProfile) => void }) {
  const [mode, setMode] = createSignal<"login" | "register">("login");
  const [nickname, setNickname] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [rememberMe, setRememberMe] = createSignal(true);
  const [loading, setLoading] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [messageKind, setMessageKind] = createSignal<"error" | "success">("error");

  function showError(text: string) {
    setMessageKind("error");
    setMessage(text);
  }

  function showSuccess(text: string) {
    setMessageKind("success");
    setMessage(text);
  }

  function clearMessage() {
    setMessage("");
  }

  function switchMode(next: "login" | "register") {
    setMode(next);
    setPassword("");
    setConfirmPassword("");
    clearMessage();
  }

  async function submit() {
    clearMessage();
    const mail = email().trim();
    const pwd = password();

    if (!mail) return showError("请输入邮箱。");
    if (mode() === "register" && !pwd) return showError("请输入密码。");
    if (mode() === "register") {
      if (!nickname().trim()) return showError("请输入昵称。");
      if (pwd.length < 6) return showError("密码至少需要 6 位。");
      if (pwd !== confirmPassword()) return showError("两次输入的密码不一致。");
    }

    if (mode() === "login") {
      setLoading(true);
      try {
        const localUser = findRegisteredUser(mail);
        if (localUser) {
          const user = { ...localUser, lastLoginAt: new Date().toISOString() };
          persistCurrentUser(user);
          props.onAuthenticated(user);
          window.electronAPI?.auth?.login({ email: mail, password: pwd, rememberMe: rememberMe() }).catch(() => {});
          return;
        }

        const result = await timeoutAfter<AuthResult>(
          window.electronAPI?.auth?.login({ email: mail, password: pwd, rememberMe: rememberMe() }) ||
            Promise.resolve({ ok: false, error: "账号服务未加载。" }),
          4000,
        );
        if (!result.ok || !result.user) {
          showError(result.error || "未找到该账号，请先注册。");
          return;
        }
        saveRegisteredUser(result.user);
        persistCurrentUser(result.user);
        props.onAuthenticated(result.user);
      } catch (error: any) {
        showError(error?.message || "登录失败，请先确认账号已注册。");
      } finally {
        setLoading(false);
      }
      return;
    }

    const authApi = window.electronAPI?.auth;

    try {
      if (mode() === "register") {
        setLoading(true);
        let registeredUser = createLocalUser(mail, nickname());
        if (authApi?.register) {
          const result = await timeoutAfter<AuthResult>(
            authApi.register({
              nickname: nickname().trim(),
              email: mail,
              password: pwd,
              rememberMe: rememberMe(),
            }),
            4000,
          ).catch((error) => ({ ok: false, error: error?.message || "账号服务暂不可用。" }));
          if (result.ok && result.user) {
            registeredUser = result.user;
          }
        }
        saveRegisteredUser(registeredUser);
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        showSuccess("账号已创建，请使用该邮箱登录。");
        return;
      }

    } catch (error: any) {
      showError(error?.message || "注册失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main class="auth-screen">
      <section class="auth-card animate-slide-up">
        <div class="auth-brand">
          <div class="auth-logo">A</div>
          <div>
            <p>跨应用自动化执行 Agent</p>
            <h1>登录后继续使用你的桌面智能助理</h1>
          </div>
        </div>

        <div class="auth-tabs">
          <button classList={{ active: mode() === "login" }} onClick={() => switchMode("login")}>登录</button>
          <button classList={{ active: mode() === "register" }} onClick={() => switchMode("register")}>注册</button>
        </div>

        <div class="auth-form">
          <Show when={mode() === "register"}>
            <label>
              <span>昵称</span>
              <input
                value={nickname()}
                onInput={(event) => { clearMessage(); setNickname(event.currentTarget.value); }}
                placeholder="请输入昵称"
              />
            </label>
          </Show>

          <label>
            <span>邮箱</span>
            <input
              value={email()}
              onInput={(event) => { clearMessage(); setEmail(event.currentTarget.value); }}
              placeholder="name@example.com"
              autocomplete="email"
            />
          </label>

          <label>
              <span>{mode() === "login" ? "密码" : "密码"}</span>
            <input
              type="password"
              value={password()}
              onInput={(event) => { clearMessage(); setPassword(event.currentTarget.value); }}
              placeholder={mode() === "login" ? "请输入密码" : "至少 6 位"}
              autocomplete={mode() === "login" ? "current-password" : "new-password"}
            />
          </label>

          <Show when={mode() === "register"}>
            <label>
              <span>确认密码</span>
              <input
                type="password"
                value={confirmPassword()}
                onInput={(event) => { clearMessage(); setConfirmPassword(event.currentTarget.value); }}
                placeholder="再次输入密码"
                autocomplete="new-password"
              />
            </label>
          </Show>

          <div class="auth-row">
            <label class="auth-check">
              <input type="checkbox" checked={rememberMe()} onChange={(event) => setRememberMe(event.currentTarget.checked)} />
              <span>记住登录状态</span>
            </label>
          </div>

          <Show when={message()}>
            <div class={messageKind() === "success" ? "auth-success" : "auth-error"}>{message()}</div>
          </Show>

          <button type="button" data-component="button" data-variant="primary" data-size="lg" onClick={submit} disabled={loading()}>
            {loading() ? "处理中..." : mode() === "login" ? "登录" : "创建账号"}
          </button>

          <button type="button" class="auth-link" onClick={() => switchMode(mode() === "login" ? "register" : "login")}>
            {mode() === "login" ? "还没有账号？立即注册" : "已有账号？返回登录"}
          </button>
        </div>
      </section>
    </main>
  );
}
