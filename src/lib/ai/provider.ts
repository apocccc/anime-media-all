/**
 * AI provider 抽象。役割別(記事生成/翻訳/モデレーション)にモデルを選べる。
 * AI_PROVIDER=openai | anthropic | mock
 * - openai: OPENAI_API_KEY / OPENAI_BASE_URL(互換エンドポイント可)
 * - anthropic: ANTHROPIC_API_KEY
 * - mock: ローカル開発・テスト用の決定的な応答(APIキー不要)
 */

export type AiRole = "write" | "translate" | "moderate";

export class AiError extends Error {}

function providerName(): string {
  return process.env.AI_PROVIDER || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");
}

export function modelForRole(role: AiRole): string {
  const byRole = {
    write: process.env.AI_MODEL_WRITE,
    translate: process.env.AI_MODEL_TRANSLATE,
    moderate: process.env.AI_MODEL_MODERATE,
  }[role];
  if (byRole) return byRole;
  if (providerName() === "anthropic") {
    return role === "moderate" ? "claude-haiku-4-5-20251001" : "claude-sonnet-5";
  }
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

export function aiConfigured(): boolean {
  const p = providerName();
  if (p === "mock") return true;
  if (p === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
  return Boolean(process.env.OPENAI_API_KEY);
}

export type AiCompleteInput = {
  role: AiRole;
  system: string;
  user: string;
  /** JSONオブジェクトを要求する場合 true */
  json?: boolean;
  maxTokens?: number;
};

/** 単発のテキスト補完。json: true の場合も戻り値は文字列(呼び出し側で parse) */
export async function aiComplete(input: AiCompleteInput): Promise<string> {
  const p = providerName();
  if (p === "mock") return mockComplete(input);
  if (p === "anthropic") return anthropicComplete(input);
  return openaiComplete(input);
}

/** JSON応答をパースまで行うヘルパー */
export async function aiCompleteJson<T>(input: AiCompleteInput): Promise<T> {
  const raw = await aiComplete({ ...input, json: true });
  // コードフェンス付きで返るモデルへの耐性
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AiError(`AI returned invalid JSON: ${text.slice(0, 200)}`);
  }
}

async function openaiComplete(input: AiCompleteInput): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiError("OPENAI_API_KEY is not set");
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelForRole(input.role),
      ...(input.json ? { response_format: { type: "json_object" } } : {}),
      ...(input.maxTokens ? { max_tokens: input.maxTokens } : {}),
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AiError(`OpenAI API error ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AiError("OpenAI API returned empty response");
  return content;
}

async function anthropicComplete(input: AiCompleteInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiError("ANTHROPIC_API_KEY is not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelForRole(input.role),
      max_tokens: input.maxTokens ?? 8192,
      system: input.json
        ? `${input.system}\n\n出力はJSONオブジェクトのみ。説明文・コードフェンスを付けない。`
        : input.system,
      messages: [{ role: "user", content: input.user }],
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AiError(`Anthropic API error ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const content = data.content
    ?.filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
  if (!content) throw new AiError("Anthropic API returned empty response");
  return content;
}

/**
 * mock provider: ローカル開発・E2E用。翻訳は「[locale] 原文」の形式で返し、
 * パイプライン(ブロック保持・用語検証)の動作確認ができる。
 */
function mockComplete(input: AiCompleteInput): string {
  if (input.role === "moderate") {
    return JSON.stringify({ verdict: "pass", scores: { nsfw: 0, violence: 0, hate: 0, pii: 0 } });
  }
  if (input.role === "translate") {
    // 入力 user に JSON { locale, blocks: [{id, text}], glossary: [{source, target}] } を想定
    try {
      const req = JSON.parse(input.user) as {
        locale?: string;
        blocks?: { id: string; text: string }[];
        glossary?: { source: string; target: string }[];
      };
      const glossary = req.glossary ?? [];
      const translate = (text: string) => {
        let out = text;
        for (const g of glossary) {
          out = out.split(g.source).join(g.target);
        }
        return `[${req.locale}] ${out}`;
      };
      return JSON.stringify({
        blocks: (req.blocks ?? []).map((b) => ({ id: b.id, text: translate(b.text) })),
      });
    } catch {
      return JSON.stringify({ blocks: [] });
    }
  }
  // write: 決定的なダミー記事
  return JSON.stringify({
    title: "モック記事タイトル",
    lead: "これはローカル開発用のモック生成リード文です。",
    paragraphs: [
      "## 見出し",
      "これはモックプロバイダーが生成した本文段落です。",
      "AI_PROVIDER=openai または anthropic を設定すると実際の生成が行われます。",
    ],
    category: "news",
  });
}
