import { render } from "solid-js/web";
import { Show } from "solid-js";
import { Router, Route, useNavigate } from "@solidjs/router";
import App from "./App";
import ChatView from "./routes/ChatView";
import ApiSettingsView from "./routes/ApiSettingsView";
import ScheduleView from "./routes/ScheduleView";
import AuthScreen from "./components/auth/AuthScreen";
import { PurchasePage, PaymentPage } from "./components/pro/PurchasePage";
import { currentUser, persistCurrentUser } from "./state/authStore";
import "./styles/global.css";

// Dynamic import for floating ball to avoid bundling it in main app
const isFloating = window.location.hash === "#/floating";

function PurchaseRoute() {
  return (
    <Show when={currentUser()} fallback={<LoginRequired title="请先登录后升级 Pro" />}>
      {(user) => <PurchasePage user={user()} onUserChanged={persistCurrentUser} />}
    </Show>
  );
}

function PaymentRoute() {
  return (
    <Show when={currentUser()} fallback={<LoginRequired title="请先登录后查看订单" />}>
      {(user) => <PaymentPage user={user()} onUserChanged={persistCurrentUser} />}
    </Show>
  );
}

function LoginRoute() {
  const navigate = useNavigate();
  return (
    <AuthScreen
      onAuthenticated={(user) => {
        persistCurrentUser(user);
        navigate("/");
      }}
    />
  );
}

function LoginRequired(props: { title: string }) {
  const navigate = useNavigate();
  return (
    <main class="pro-page">
      <section class="pro-login-required">
        <div class="auth-logo">A</div>
        <h1>{props.title}</h1>
        <p>登录后可以查看账号状态、购买 Pro、管理订单和继续使用个人配置。</p>
        <button data-component="button" data-variant="primary" data-size="lg" onClick={() => navigate("/login")}>
          去登录 / 注册
        </button>
      </section>
    </main>
  );
}

if (isFloating) {
  import("./floating").then(m => m.default());
} else {
  render(
    () => (
      <Router root={App}>
        <Route path="/" component={ChatView} />
        <Route path="/login" component={LoginRoute} />
        <Route path="/schedule" component={ScheduleView} />
        <Route path="/settings" component={ApiSettingsView} />
        <Route path="/purchase" component={PurchaseRoute} />
        <Route path="/payment/:orderId" component={PaymentRoute} />
      </Router>
    ),
    document.getElementById("root")!,
  );
}
