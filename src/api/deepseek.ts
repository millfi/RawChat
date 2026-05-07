/**
 * DeepSeek API client (OpenAI-compatible).
 *
 * Models (as of 2026-04, see https://api-docs.deepseek.com/quick_start/pricing):
 *   - deepseek-v4-flash : faster, cheaper.
 *   - deepseek-v4-pro   : higher quality.
 * Both support thinking / non-thinking modes via `reasoning_effort` and
 * tool calling. The legacy `deepseek-chat` / `deepseek-reasoner` aliases
 * are deprecated and intentionally NOT exposed here.
 *
 * Streaming
 * ─────────
 * We stream via XMLHttpRequest's `onprogress` event because RN's `fetch`
 * does not expose a usable ReadableStream on Windows. Each progress tick
 * gives us new bytes appended to `responseText`; we chunk them on `\n\n`,
 * parse each `data: {...}` SSE event, and forward content/reasoning/
 * tool-call deltas to the caller.
 *
 * Tool calling
 * ────────────
 * `sendChatStream` runs a multi-round loop: if the model emits
 * `tool_calls`, the caller's `onToolCall` is invoked, the tool result is
 * appended as a `role: "tool"` message, and another streaming round
 * starts. We bail out after MAX_TOOL_ROUNDS to avoid infinite loops.
 */

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const MAX_TOOL_ROUNDS = 4;

// ── Public types ──────────────────────────────────────────────────────

export type ModelId = 'deepseek-v4-flash' | 'deepseek-v4-pro';

export interface ModelInfo {
  id: ModelId;
  label: string;
  description: string;
}

export const MODELS: readonly ModelInfo[] = [
  {id: 'deepseek-v4-flash', label: 'V4 Flash', description: '高速・低コスト'},
  {id: 'deepseek-v4-pro', label: 'V4 Pro', description: '高品質'},
] as const;

export const DEFAULT_MODEL: ModelId = 'deepseek-v4-flash';

/**
 * NOTE: API valid values are 'low' | 'medium' | 'high' | 'max' | 'xhigh'.
 * There is NO `disabled` value — the API rejects it with
 *   "unknown variant `disabled`, expected one of `high`, `low`, `medium`,
 *    `max`, `xhigh`"
 * Omitting the parameter entirely lets the API choose its own default.
 */
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'max' | 'xhigh';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /**
   * UI-only metadata describing the tool calls executed while preparing
   * this assistant turn. Stripped before the request body is sent to the
   * API (see `sendChatStream` — it maps to `{role, content}` only).
   *
   * Persisted on the assistant Message so the search/source pill stays
   * visible after the answer is delivered AND survives subsequent sends.
   */
  toolEvents?: ToolEventEntry[];
}

export interface ToolEventEntry {
  id: string;
  /** Pill caption, e.g. "🌐 ウェブ検索完了". */
  label: string;
  /** Web-search-specific: the query the model used. */
  searchQuery?: string;
  /** Web-search-specific: URLs whose full page content was actually read. */
  searchSources?: Array<{title: string; url: string}>;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {name: string; arguments: string};
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}

export type StreamEvent =
  | {type: 'content'; text: string}
  | {type: 'reasoning'; text: string}
  | {type: 'tool_call_start'; name: string; argsPreview: string}
  | {type: 'tool_call_done'; name: string; result: string};

export class DeepSeekError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'DeepSeekError';
  }
}

// ── API-shaped types (internal) ───────────────────────────────────────

interface ApiMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  // DeepSeek requires the assistant's reasoning_content from a thinking-
  // mode round to be echoed back on the next request that includes that
  // round's tool_calls — otherwise the API returns:
  //   "The reasoning_content in the thinking mode must be passed back
  //    to the API"
  reasoning_content?: string;
}

// ── Public entry: streaming chat with optional tool calling ──────────

export interface SendOptions {
  apiKey: string;
  model: ModelId;
  messages: Message[];
  reasoningEffort?: ReasoningEffort;
  /** Tools to expose; if non-empty, the model may emit tool_calls. */
  tools?: ToolDefinition[];
  /** Resolve a tool call to a string result. Required when `tools` is set. */
  onToolCall?: (call: ToolCall) => Promise<string>;
  /** Per-event callback for incremental UI updates. */
  onEvent?: (event: StreamEvent) => void;
  /** Cancellation. */
  signal?: AbortSignal;
}

/**
 * Run one or more streaming rounds until the model returns a final
 * response (no further tool_calls). Returns the assistant's final text.
 */
export async function sendChatStream(opts: SendOptions): Promise<string> {
  const {
    apiKey,
    model,
    messages,
    reasoningEffort,
    tools,
    onToolCall,
    onEvent,
    signal,
  } = opts;

  // Rolling API-shaped history (we mutate through tool rounds).
  const history: ApiMessage[] = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  let finalText = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const body: Record<string, unknown> = {
      model,
      messages: history,
      stream: true,
    };
    // Only forward reasoning_effort when explicitly requested. The API
    // applies its own default (thinking mode for v4-pro, see docs) when
    // omitted, and rejects any unknown value.
    if (reasoningEffort) {body.reasoning_effort = reasoningEffort;}
    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const result = await streamOnce(apiKey, body, onEvent, signal);

    finalText = result.content;

    if (result.toolCalls.length > 0 && onToolCall) {
      // Append the assistant's tool_call message. When the request used
      // thinking mode (reasoning_effort != 'disabled'), DeepSeek emits
      // reasoning_content alongside tool_calls and REQUIRES it to be
      // present on the assistant message of the follow-up request.
      const assistantTurn: ApiMessage = {
        role: 'assistant',
        content: result.content || null,
        tool_calls: result.toolCalls,
      };
      if (result.reasoning) {
        assistantTurn.reasoning_content = result.reasoning;
      }
      history.push(assistantTurn);

      // Resolve every tool call (sequentially to keep UI events ordered).
      for (const call of result.toolCalls) {
        onEvent?.({
          type: 'tool_call_start',
          name: call.function.name,
          argsPreview: previewArgs(call.function.arguments),
        });
        let toolResult: string;
        try {
          toolResult = await onToolCall(call);
        } catch (e: any) {
          toolResult = `Error: ${e?.message ?? String(e)}`;
        }
        onEvent?.({
          type: 'tool_call_done',
          name: call.function.name,
          result: toolResult,
        });
        history.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.function.name,
          content: toolResult,
        });
      }
      continue; // another streaming round with tool results in context
    }

    return finalText;
  }

  return finalText || '(too many tool-call rounds)';
}

function previewArgs(args: string): string {
  if (!args) {return '';}
  try {
    const parsed = JSON.parse(args);
    if (parsed && typeof parsed === 'object') {
      const firstStr = Object.values(parsed).find(
        v => typeof v === 'string',
      ) as string | undefined;
      if (firstStr) {return firstStr.slice(0, 80);}
    }
  } catch {
    /* not yet valid JSON */
  }
  return args.slice(0, 80);
}

// ── One streaming round ───────────────────────────────────────────────

interface StreamRoundResult {
  content: string;
  reasoning: string;
  toolCalls: ToolCall[];
}

function streamOnce(
  apiKey: string,
  body: Record<string, unknown>,
  onEvent?: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<StreamRoundResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', DEEPSEEK_URL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
    xhr.setRequestHeader('Accept', 'text/event-stream');

    let lastReadIndex = 0;
    let buffer = '';
    let content = '';
    let reasoning = '';
    const toolCalls: ToolCall[] = [];

    let abortHandler: (() => void) | null = null;
    const cleanup = () => {
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
    };

    if (signal) {
      if (signal.aborted) {
        reject(new DeepSeekError('リクエストをキャンセルしました。'));
        return;
      }
      abortHandler = () => {
        try {
          xhr.abort();
        } catch {
          /* ignore */
        }
        cleanup();
        reject(new DeepSeekError('リクエストをキャンセルしました。'));
      };
      signal.addEventListener('abort', abortHandler);
    }

    const drainBuffer = () => {
      const newText = xhr.responseText.slice(lastReadIndex);
      lastReadIndex = xhr.responseText.length;
      if (!newText) {return;}
      buffer += newText;

      // SSE events delimited by a blank line (\n\n or \r\n\r\n).
      while (true) {
        const idxN = buffer.indexOf('\n\n');
        const idxRN = buffer.indexOf('\r\n\r\n');
        let idx: number;
        let sepLen: number;
        if (idxN === -1 && idxRN === -1) {break;}
        if (idxRN !== -1 && (idxN === -1 || idxRN < idxN)) {
          idx = idxRN;
          sepLen = 4;
        } else {
          idx = idxN;
          sepLen = 2;
        }
        const event = buffer.slice(0, idx);
        buffer = buffer.slice(idx + sepLen);

        for (const line of event.split(/\r?\n/)) {
          if (!line.startsWith('data:')) {continue;}
          const data = line.slice(5).trim();
          if (!data) {continue;}
          if (data === '[DONE]') {continue;}
          try {
            const json = JSON.parse(data);
            const delta = json?.choices?.[0]?.delta;
            if (!delta) {continue;}

            if (typeof delta.content === 'string' && delta.content.length > 0) {
              content += delta.content;
              onEvent?.({type: 'content', text: delta.content});
            }
            if (
              typeof delta.reasoning_content === 'string' &&
              delta.reasoning_content.length > 0
            ) {
              reasoning += delta.reasoning_content;
              onEvent?.({type: 'reasoning', text: delta.reasoning_content});
            }
            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const i: number = tc.index ?? 0;
                if (!toolCalls[i]) {
                  toolCalls[i] = {
                    id: '',
                    type: 'function',
                    function: {name: '', arguments: ''},
                  };
                }
                if (tc.id) {toolCalls[i].id = tc.id;}
                if (tc.function?.name) {
                  toolCalls[i].function.name += tc.function.name;
                }
                if (tc.function?.arguments) {
                  toolCalls[i].function.arguments += tc.function.arguments;
                }
              }
            }
          } catch {
            // ignore malformed JSON chunk
          }
        }
      }
    };

    xhr.onprogress = drainBuffer;

    xhr.onload = () => {
      drainBuffer();
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          content,
          reasoning,
          toolCalls: toolCalls.filter(Boolean),
        });
      } else {
        let msg = `APIエラー (${xhr.status})`;
        if (xhr.status === 401) {
          msg = 'APIキーが無効です。設定を確認してください。';
        } else if (xhr.status === 429) {
          msg =
            'レート制限に達しました。しばらく待ってから再試行してください。';
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            if (err?.error?.message) {msg = err.error.message;}
          } catch {
            /* ignore */
          }
        }
        reject(new DeepSeekError(msg, xhr.status));
      }
    };

    xhr.onerror = () => {
      cleanup();
      reject(
        new DeepSeekError('ネットワークエラー: APIに接続できませんでした。'),
      );
    };

    xhr.send(JSON.stringify(body));
  });
}

// ── Built-in tool: web_search ─────────────────────────────────────────

export const WEB_SEARCH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Search the public web for recent or external information. ' +
      'Returns title, URL, summary AND the cleaned full-page text for each ' +
      'top result, so you can quote and cite specific passages. Use when ' +
      'the answer is likely outside your training data, requires fresh ' +
      'facts, or when the user asks for sources.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query, in the language of the user request.',
        },
      },
      required: ['query'],
    },
  },
};
