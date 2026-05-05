/**
 * DeepSeek API client
 * Uses the OpenAI-compatible chat completions endpoint.
 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek-v4-pro';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ApiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class DeepSeekError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'DeepSeekError';
  }
}

export async function sendChatMessage(
  messages: Message[],
  apiKey: string,
): Promise<string> {
  const apiMessages: ApiMessage[] = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  let response: Response;
  try {
    response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: apiMessages,
        stream: false,
      }),
    });
  } catch (e) {
    throw new DeepSeekError(
      'ネットワークエラー: APIに接続できませんでした。',
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    if (response.status === 401) {
      throw new DeepSeekError('APIキーが無効です。設定を確認してください。', 401);
    }
    if (response.status === 429) {
      throw new DeepSeekError('レート制限に達しました。しばらく待ってから再試行してください。', 429);
    }
    throw new DeepSeekError(
      `APIエラー (${response.status}): ${errorText}`,
      response.status,
    );
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new DeepSeekError('APIからの応答が不正です。');
  }
  return content;
}
