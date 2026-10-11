import type { GeminiReceiptResult } from "../types";

const PROMPT = `あなたはレシート（領収書）画像を読み取り、内容を構造化データとして抽出するアシスタントです。
画像に写っているレシートから次の情報を抽出してください。

- store_name: 店舗名・会社名（読み取れない場合は空文字）
- date: レシートに印字された日付。可能なら YYYY-MM-DD HH:DD 形式に正規化する。判読できない場合は印字されている文字列をそのまま使う
- items: 購入した商品の配列。各要素は次を含む
  - name: 商品名
  - quantity: 数量（印字が無い場合は 1）
  - unit_price: 単価（円などの通貨記号は含めない数値）
  - amount: 金額（数量×単価。レシートに印字された金額があればそれを優先する）
- subtotal: 小計（無ければ null）
- tax: 消費税額（無ければ null）
- total: 合計金額（無ければ null）
- note: 読み取りにくかった箇所や自信が低い項目があれば短く日本語で説明。問題なければ空文字

数値はすべてカンマや通貨記号を含まない number 型にしてください。
JSON 以外の文字列（説明文やコードブロックの記号など）は一切出力しないでください。`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    store_name: { type: "string" },
    date: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unit_price: { type: "number" },
          amount: { type: "number" }
        },
        required: ["name", "quantity", "unit_price", "amount"]
      }
    },
    subtotal: { type: "number", nullable: true },
    tax: { type: "number", nullable: true },
    total: { type: "number", nullable: true },
    note: { type: "string" }
  },
  required: ["store_name", "date", "items", "subtotal", "tax", "total"]
};

export class GeminiError extends Error {}

export interface GeminiModelOption {
  /** Bare model id, e.g. "gemini-2.5-flash" (no "models/" prefix). */
  id: string;
  displayName: string;
  description?: string;
}

// Model families that appear in ListModels but cannot take an image + generateContent
// request the way this app needs (embeddings, TTS, image/video generation-only models, etc.).
const EXCLUDED_ID_PATTERN = /embedding|aqa|tts|image-generation|imagen|veo|native-audio|learnlm/i;

/**
 * Fetches the list of Gemini models available to this API key from Google AI
 * Studio's ListModels endpoint, filtered to ones that support generateContent
 * (i.e. can be used for the image → structured JSON extraction this app does).
 */
export async function listAvailableModels(apiKey: string): Promise<GeminiModelOption[]> {
  if (!apiKey.trim()) {
    throw new GeminiError("APIキーを入力してから一覧を取得してください。");
  }

  const results: GeminiModelOption[] = [];
  let pageToken: string | undefined;
  let safetyCounter = 0;

  do {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
    url.searchParams.set("key", apiKey.trim());
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    let res: Response;
    try {
      res = await fetch(url.toString());
    } catch {
      throw new GeminiError("通信に失敗しました。ネットワーク接続を確認してください。");
    }

    if (!res.ok) {
      const errText = await safeReadError(res);
      throw new GeminiError(
        `モデル一覧の取得に失敗しました（${res.status}）: ${
          errText || "APIキーが正しいか確認してください。"
        }`
      );
    }

    const data = await res.json();
    const models: unknown[] = Array.isArray(data?.models) ? data.models : [];

    for (const m of models) {
      const raw = m as {
        name?: string;
        displayName?: string;
        description?: string;
        supportedGenerationMethods?: string[];
      };
      const fullName = raw.name ?? "";
      const id = fullName.replace(/^models\//, "");
      if (!id) continue;
      if (!raw.supportedGenerationMethods?.includes("generateContent")) continue;
      if (EXCLUDED_ID_PATTERN.test(id)) continue;

      results.push({
        id,
        displayName: raw.displayName || id,
        description: raw.description
      });
    }

    pageToken = data?.nextPageToken;
    safetyCounter += 1;
  } while (pageToken && safetyCounter < 5);

  results.sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"));
  return results;
}

/**
 * Sends a receipt photo to the Gemini API (Google AI Studio) and returns the
 * structured extraction result. `apiKey` and `model` come from user settings.
 */
export async function analyzeReceiptImage(
  file: File,
  apiKey: string,
  model: string
): Promise<GeminiReceiptResult> {
  if (!apiKey.trim()) {
    throw new GeminiError("APIキーが設定されていません。設定画面から入力してください。");
  }
  if (!model.trim()) {
    throw new GeminiError("モデル名が設定されていません。設定画面から入力してください。");
  }

  const { base64, mimeType } = await fileToBase64(file);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model.trim()
  )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: base64 } }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.1
    }
  };

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    throw new GeminiError("通信に失敗しました。ネットワーク接続を確認してください。");
  }

  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new GeminiError(
      `APIエラー（${res.status}）: ${errText || "リクエストに失敗しました。APIキーとモデル名を確認してください。"}`
    );
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new GeminiError(`画像の解析がブロックされました（${blockReason}）。`);
    }
    throw new GeminiError("応答からデータを取得できませんでした。");
  }

  try {
    return JSON.parse(text) as GeminiReceiptResult;
  } catch {
    throw new GeminiError("応答をJSONとして解釈できませんでした。");
  }
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const json = await res.json();
    return json?.error?.message ?? "";
  } catch {
    return "";
  }
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [, base64] = result.split(",");
      if (!base64) {
        reject(new GeminiError("画像の読み込みに失敗しました。"));
        return;
      }
      resolve({ base64, mimeType: file.type || "image/jpeg" });
    };
    reader.onerror = () => reject(new GeminiError("画像の読み込みに失敗しました。"));
    reader.readAsDataURL(file);
  });
}
