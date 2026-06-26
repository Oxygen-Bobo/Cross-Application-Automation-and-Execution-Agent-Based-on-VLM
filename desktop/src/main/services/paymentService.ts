import { ipcMain } from "electron";
import { randomUUID } from "crypto";
import { join } from "path";
import { atomicWriteJson, readJsonSafe } from "./userDataService";
import { getCurrentUser, getCurrentUserDataPathSync, updateCurrentUserPlan } from "./authService";

export type PaymentPlan = "pro_monthly" | "pro_yearly";
export type PaymentChannel = "wechat" | "alipay";
export type PaymentStatus = "pending" | "paid_pending_review" | "activated" | "cancelled";

export interface PaymentOrder {
  id: string;
  userId: string;
  plan: PaymentPlan;
  amount: number;
  channel: PaymentChannel;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

type OrdersStore = { orders: PaymentOrder[] };

function nowIso() {
  return new Date().toISOString();
}

function getOrdersPath() {
  const userDir = getCurrentUserDataPathSync();
  if (!userDir) return null;
  return join(userDir, "payment", "orders.json");
}

function loadOrders(): OrdersStore {
  const file = getOrdersPath();
  if (!file) return { orders: [] };
  const store = readJsonSafe<OrdersStore>(file, { orders: [] });
  return { orders: Array.isArray(store.orders) ? store.orders : [] };
}

function saveOrders(store: OrdersStore) {
  const file = getOrdersPath();
  if (!file) throw new Error("请先登录");
  atomicWriteJson(file, store);
}

function planAmount(plan: PaymentPlan) {
  return plan === "pro_yearly" ? 199 : 29;
}

function planDays(plan: PaymentPlan) {
  return plan === "pro_yearly" ? 365 : 30;
}

function sanitizePlan(value: string): PaymentPlan {
  return value === "pro_yearly" ? "pro_yearly" : "pro_monthly";
}

function sanitizeChannel(value: string): PaymentChannel {
  return value === "alipay" ? "alipay" : "wechat";
}

export function registerPaymentHandlers(ipc: typeof ipcMain) {
  ipc.handle("payment:getOrders", () => loadOrders().orders);

  ipc.handle("payment:createOrder", (_event, payload: { plan?: PaymentPlan; channel?: PaymentChannel }) => {
    const user = getCurrentUser();
    if (!user) return { ok: false, error: "请先登录" };
    const plan = sanitizePlan(String(payload?.plan || "pro_monthly"));
    const channel = sanitizeChannel(String(payload?.channel || "wechat"));
    const now = nowIso();
    const order: PaymentOrder = {
      id: randomUUID(),
      userId: user.id,
      plan,
      amount: planAmount(plan),
      channel,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    const store = loadOrders();
    store.orders.unshift(order);
    saveOrders(store);
    return { ok: true, order };
  });

  ipc.handle("payment:markPaid", (_event, orderId: string) => {
    const store = loadOrders();
    const order = store.orders.find((item) => item.id === orderId);
    if (!order) return { ok: false, error: "订单不存在" };
    if (order.status === "cancelled") return { ok: false, error: "订单已取消" };
    order.status = "paid_pending_review";
    order.updatedAt = nowIso();
    saveOrders(store);
    return { ok: true, order };
  });

  ipc.handle("payment:cancelOrder", (_event, orderId: string) => {
    const store = loadOrders();
    const order = store.orders.find((item) => item.id === orderId);
    if (!order) return { ok: false, error: "订单不存在" };
    order.status = "cancelled";
    order.updatedAt = nowIso();
    saveOrders(store);
    return { ok: true, order };
  });

  ipc.handle("payment:activateProDev", (_event, orderId: string) => {
    const user = getCurrentUser();
    if (!user) return { ok: false, error: "请先登录" };
    const store = loadOrders();
    const order = store.orders.find((item) => item.id === orderId);
    if (!order) return { ok: false, error: "订单不存在" };
    const expires = new Date();
    expires.setDate(expires.getDate() + planDays(order.plan));
    order.status = "activated";
    order.updatedAt = nowIso();
    saveOrders(store);
    const updatedUser = updateCurrentUserPlan("pro", expires.toISOString());
    return { ok: true, order, user: updatedUser };
  });
}
