import { createMemo, createSignal, For, Show } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import type { PaymentChannel, PaymentOrder, PaymentPlan, PublicUserProfile } from "../../../preload/index";
import "../../styles/pro.css";

const basicFeatures = ["基础桌面自动化", "基础任务历史", "手动配置 API Key", "本地运行"];
const proFeatures = [
  "更完整的跨应用工作流展示",
  "更多历史记录容量标识",
  "更丰富的 Skill 能力展示",
  "优先体验混合 Agent 能力",
  "高级任务模板",
  "预留未来云同步能力",
  "Pro 身份标识",
];

function formatDate(value?: string | null) {
  if (!value) return "未开通";
  return new Date(value).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function planLabel(plan: PaymentPlan) {
  return plan === "pro_yearly" ? "Pro 年付" : "Pro 月付";
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "待支付",
    paid_pending_review: "已支付，等待确认",
    activated: "已开通",
    cancelled: "已取消",
  };
  return map[status] || status;
}

export function PurchasePage(props: { user: PublicUserProfile; onUserChanged: (user: PublicUserProfile) => void }) {
  const navigate = useNavigate();
  const [plan, setPlan] = createSignal<PaymentPlan>("pro_yearly");
  const [channel, setChannel] = createSignal<PaymentChannel>("wechat");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const selectedPrice = createMemo(() => (plan() === "pro_yearly" ? 199 : 29));

  async function buy() {
    setLoading(true);
    setError("");
    try {
      const result = await window.electronAPI.payment.createOrder({ plan: plan(), channel: channel() });
      if (!result.ok || !result.order) {
        setError(result.error || "创建订单失败");
        return;
      }
      navigate(`/payment/${result.order.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main class="pro-page">
      <div class="pro-shell">
        <header class="pro-topbar">
          <button data-component="button" data-variant="secondary" onClick={() => navigate("/")}>返回</button>
          <div>
            <p>当前账号：{props.user.nickname} · {props.user.email}</p>
            <h1>升级到 Pro</h1>
          </div>
          <div class="plan-pill" classList={{ pro: props.user.plan === "pro" }}>
            {props.user.plan === "pro" ? `Pro 至 ${formatDate(props.user.proExpireAt)}` : "当前 Basic"}
          </div>
        </header>

        <section class="plan-grid">
          <article class="plan-card">
            <div class="plan-card-head">
              <span>Basic</span>
              <strong>当前可用</strong>
            </div>
            <p class="plan-price">¥0 <small>/ 本地使用</small></p>
            <For each={basicFeatures}>{(feature) => <div class="feature-line">✓ {feature}</div>}</For>
          </article>

          <article class="plan-card pro-card">
            <div class="plan-card-head">
              <span>Pro</span>
              <strong>推荐</strong>
            </div>
            <div class="billing-switch">
              <button classList={{ active: plan() === "pro_monthly" }} onClick={() => setPlan("pro_monthly")}>月付 ¥29</button>
              <button classList={{ active: plan() === "pro_yearly" }} onClick={() => setPlan("pro_yearly")}>年付 ¥199 <em>更划算</em></button>
            </div>
            <p class="plan-price">¥{selectedPrice()} <small>/{plan() === "pro_yearly" ? "年" : "月"}</small></p>
            <For each={proFeatures}>{(feature) => <div class="feature-line">✓ {feature}</div>}</For>
            <div class="pay-switch">
              <button classList={{ active: channel() === "wechat" }} onClick={() => setChannel("wechat")}>微信支付</button>
              <button classList={{ active: channel() === "alipay" }} onClick={() => setChannel("alipay")}>支付宝</button>
            </div>
            <Show when={error()}><div class="pro-error">{error()}</div></Show>
            <button data-component="button" data-variant="primary" data-size="lg" onClick={buy} disabled={loading()}>
              {loading() ? "正在创建订单..." : "购买并生成订单"}
            </button>
          </article>
        </section>

        <section class="pro-info-grid">
          <div class="pro-info-card">
            <h3>开通说明</h3>
            <p>扫码完成支付后点击“我已支付，提交审核”，订单会进入确认流程，确认后自动更新账号权益。</p>
          </div>
          <div class="pro-info-card">
            <h3>Pro 能力</h3>
            <p>Pro 面向更高频、更复杂的自动化使用场景，提供更完整的任务模板、历史容量和高级能力入口。</p>
          </div>
          <div class="pro-info-card">
            <h3>常见问题</h3>
            <p>如支付后长时间未开通，请保留订单编号并联系管理员确认。</p>
          </div>
        </section>
      </div>
    </main>
  );
}

export function PaymentPage(props: { user: PublicUserProfile; onUserChanged: (user: PublicUserProfile) => void }) {
  const navigate = useNavigate();
  const params = useParams();
  const [orders, setOrders] = createSignal<PaymentOrder[]>([]);
  const [channel, setChannel] = createSignal<PaymentChannel>("wechat");
  const [toast, setToast] = createSignal("");
  const [error, setError] = createSignal("");

  async function refresh() {
    const next = await window.electronAPI.payment.getOrders();
    setOrders(next || []);
    const order = next?.find((item) => item.id === params.orderId);
    if (order) setChannel(order.channel);
  }

  refresh();

  const order = createMemo(() => orders().find((item) => item.id === params.orderId) || null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 2600);
  }

  async function markPaid() {
    if (!order()) return setError("订单不存在");
    const result = await window.electronAPI.payment.markPaid(order()!.id);
    if (!result.ok) return setError(result.error || "更新订单失败");
    await refresh();
    showToast("已记录为等待管理员确认");
  }

  async function cancelOrder() {
    if (!order()) return setError("订单不存在");
    const result = await window.electronAPI.payment.cancelOrder(order()!.id);
    if (!result.ok) return setError(result.error || "取消订单失败");
    await refresh();
    showToast("订单已取消");
  }

  return (
    <main class="pro-page">
      <div class="pro-shell">
        <header class="pro-topbar">
          <button data-component="button" data-variant="secondary" onClick={() => navigate("/purchase")}>返回套餐页</button>
          <div>
            <p>支付确认</p>
            <h1>扫码完成 Pro 订单</h1>
          </div>
          <div class="plan-pill">{props.user.email}</div>
        </header>

        <Show when={order()} fallback={<div class="pro-info-card">订单不存在或已被删除。</div>}>
          {(current) => (
            <section class="payment-grid">
              <article class="qr-card">
                <div class="pay-switch wide">
                  <button classList={{ active: channel() === "wechat" }} onClick={() => setChannel("wechat")}>微信支付</button>
                  <button classList={{ active: channel() === "alipay" }} onClick={() => setChannel("alipay")}>支付宝</button>
                </div>
                <div class={`qr-placeholder ${channel()}`}>
                  <div class="qr-inner">QR</div>
                </div>
                <p class="qr-note">请使用微信或支付宝扫码完成支付。收款二维码可在应用资源配置中更新。</p>
              </article>

              <article class="order-card">
                <h2>订单摘要</h2>
                <dl>
                  <div><dt>套餐</dt><dd>{planLabel(current().plan)}</dd></div>
                  <div><dt>金额</dt><dd>¥{current().amount}</dd></div>
                  <div><dt>有效期</dt><dd>{current().plan === "pro_yearly" ? "365 天" : "30 天"}</dd></div>
                  <div><dt>订单号</dt><dd>{current().id}</dd></div>
                  <div><dt>创建时间</dt><dd>{new Date(current().createdAt).toLocaleString("zh-CN")}</dd></div>
                  <div><dt>状态</dt><dd>{statusLabel(current().status)}</dd></div>
                </dl>
                <div class="payment-help">
                  <p>请使用微信/支付宝扫码完成支付。</p>
                  <p>支付完成后点击“我已支付，提交审核”，系统会记录订单状态。</p>
                  <p>订单确认后，账号状态会自动更新为 Pro。</p>
                </div>
                <Show when={error()}><div class="pro-error">{error()}</div></Show>
                <div class="payment-actions">
                  <button data-component="button" data-variant="primary" onClick={markPaid}>我已支付，提交审核</button>
                  <button data-component="button" data-variant="soft-danger" onClick={cancelOrder}>取消订单</button>
                </div>
              </article>
            </section>
          )}
        </Show>
      </div>
      <Show when={toast()}><div class="pro-toast">{toast()}</div></Show>
    </main>
  );
}
