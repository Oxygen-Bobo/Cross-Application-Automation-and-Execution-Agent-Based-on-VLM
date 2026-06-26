import { createHash, createHmac } from "crypto";
import { app, ipcMain } from "electron";
import WebSocket from "ws";

type SpeechPayload = {
  audioBase64: string;
  mimeType?: string;
  sampleRate?: number;
  encoding?: "raw";
};

type SpeechResult = {
  ok: boolean;
  text?: string;
  error?: string;
};

// 科大讯飞语音听写 API 配置位置：
// 在这里填写控制台里的 AppID、APIKey、APISecret。填写后需要重启桌面应用。
const XFYUN_APP_ID = "3db19f12";
const XFYUN_API_KEY = "eb09c50bfdcdbb335cbbb3e8ceb53a05";
const XFYUN_API_SECRET = "NmYwNzc3MTBiZjc5NTY4YmRkNDM2ZTk0";

function getXfyunConfig() {
  const appId = XFYUN_APP_ID || process.env.XFYUN_APP_ID || process.env.IFLYTEK_APP_ID || "";
  const apiKey = XFYUN_API_KEY || process.env.XFYUN_API_KEY || process.env.IFLYTEK_API_KEY || "";
  const apiSecret = XFYUN_API_SECRET || process.env.XFYUN_API_SECRET || process.env.IFLYTEK_API_SECRET || "";
  return { appId, apiKey, apiSecret };
}

function createIatUrl(apiKey: string, apiSecret: string) {
  const host = "iat-api.xfyun.cn";
  const path = "/v2/iat";
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signature = createHmac("sha256", apiSecret).update(signatureOrigin).digest("base64");
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authorizationOrigin).toString("base64");
  const params = new URLSearchParams({ authorization, date, host });
  return `wss://${host}${path}?${params.toString()}`;
}

function parseIatText(message: any) {
  const words = message?.data?.result?.ws;
  if (!Array.isArray(words)) return "";
  return words.map((item: any) => item?.cw?.[0]?.w || "").join("");
}

function createIatAccumulator() {
  const segments = new Map<number, string>();

  return {
    update(message: any) {
      const result = message?.data?.result;
      const partial = parseIatText(message);
      if (!result || !partial) return;

      const sn = Number(result.sn);
      if (!Number.isFinite(sn)) return;

      if (result.pgs === "rpl" && Array.isArray(result.rg) && result.rg.length === 2) {
        const [start, end] = result.rg.map((value: any) => Number(value));
        if (Number.isFinite(start) && Number.isFinite(end)) {
          for (let index = start; index <= end; index += 1) {
            segments.delete(index);
          }
        }
      }

      segments.set(sn, partial);
    },
    text() {
      return Array.from(segments.entries())
        .sort(([left], [right]) => left - right)
        .map(([, value]) => value)
        .join("")
        .trim();
    },
  };
}

function transcribeWithXfyun(payload: SpeechPayload): Promise<SpeechResult> {
  const { appId, apiKey, apiSecret } = getXfyunConfig();
  if (!appId || !apiKey || !apiSecret) {
    return Promise.resolve({
      ok: false,
      error: "未配置科大讯飞语音识别参数。请在 desktop/src/main/speech.ts 顶部填写 XFYUN_APP_ID、XFYUN_API_KEY、XFYUN_API_SECRET 后重启应用。",
    });
  }

  const audio = Buffer.from(payload.audioBase64, "base64");
  if (!audio.length) {
    return Promise.resolve({ ok: false, error: "录音内容为空，请重新录音。" });
  }

  return new Promise((resolve) => {
    let settled = false;
    const accumulator = createIatAccumulator();

    const finish = (result: SpeechResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {}
      resolve(result);
    };

    const socket = new WebSocket(createIatUrl(apiKey, apiSecret));
    const timer = setTimeout(() => finish({ ok: false, error: "语音识别超时，请稍后重试。" }), 30000);

    socket.on("open", () => {
      const common = { app_id: appId };
      const business = {
        language: "zh_cn",
        domain: "iat",
        accent: "mandarin",
        vad_eos: 3000,
        dwa: "wpgs",
      };
      const frameSize = 1280;
      let offset = 0;

      const sendFrame = () => {
        if (offset >= audio.length) {
          socket.send(JSON.stringify({ data: { status: 2, format: "audio/L16;rate=16000", encoding: "raw", audio: "" } }));
          return;
        }

        const chunk = audio.subarray(offset, offset + frameSize);
        const status = offset === 0 ? 0 : 1;
        const frame: any = {
          data: {
            status,
            format: "audio/L16;rate=16000",
            encoding: payload.encoding || "raw",
            audio: chunk.toString("base64"),
          },
        };
        if (status === 0) {
          frame.common = common;
          frame.business = business;
        }
        socket.send(JSON.stringify(frame));
        offset += frameSize;
        setTimeout(sendFrame, 40);
      };

      sendFrame();
    });

    socket.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString("utf8"));
        if (message.code !== 0) {
          finish({ ok: false, error: message.message || `语音识别失败：${message.code}` });
          return;
        }

        accumulator.update(message);
        if (message.data?.status === 2) {
          finish({ ok: true, text: accumulator.text() });
        }
      } catch (error: any) {
        finish({ ok: false, error: error?.message || "语音识别结果解析失败" });
      }
    });

    socket.on("error", (error) => finish({ ok: false, error: `科大讯飞语音接口连接失败：${error.message}` }));
    socket.on("close", () => {
      const finalText = accumulator.text();
      if (!settled) finish({ ok: !!finalText, text: finalText, error: finalText ? undefined : "语音识别连接已关闭，未返回有效文本。" });
    });
  });
}

export function registerSpeechHandlers(ipc: typeof ipcMain) {
  ipc.handle("speech:transcribe", async (_event, payload: SpeechPayload) => {
    const contentHash = createHash("sha1").update(payload.audioBase64 || "").digest("hex").slice(0, 8);
    if (!payload.audioBase64) {
      return { ok: false, error: "录音内容为空，请重新录音。" };
    }
    if (!app.isReady()) {
      return { ok: false, error: "应用尚未就绪，请稍后重试。" };
    }
    console.info(`[speech] xfyun request ${contentHash}, mime=${payload.mimeType || "raw"}, sampleRate=${payload.sampleRate || 16000}`);
    return transcribeWithXfyun(payload);
  });
}
