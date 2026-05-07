/**
 * Web search backend powered by Tavily Search API.
 *
 * Why Tavily?
 *   - Designed for LLM / RAG use cases (returns clean snippets and an
 *     optional pre-synthesized answer).
 *   - Free tier: 1,000 searches / month, no credit card.
 *   - Stable JSON contract — no HTML scraping needed.
 *   - Used in the wild by LangChain, LlamaIndex, and similar tooling, so
 *     the API surface is unlikely to change without notice.
 *
 * Sign-up: https://app.tavily.com (free), then paste the key into the
 * RawChat settings screen. The key is stored locally (LocalSettings) and
 * never leaves the device except in calls to api.tavily.com.
 */

const TAVILY_URL = 'https://api.tavily.com/search';

export interface SearchResult {
  title: string;
  url: string;
  /** Tavily's LLM-tuned summary (always present, ~1-3 sentences). */
  snippet: string;
  /** Full cleaned page text when `include_raw_content: true` was used. */
  rawContent?: string;
}

/** Per-result cap on raw page text fed back to the model.
 *  5 results × 5000 chars ≈ 6-10k tokens of context — generous but bounded. */
const RAW_CONTENT_LIMIT = 5000;

export class WebSearchError extends Error {}

/**
 * Run a web search via Tavily.
 *
 * Throws WebSearchError on missing key or HTTP failure so the caller can
 * surface a precise message to the model (and the user) instead of
 * silently returning an empty result set.
 */
export async function searchWeb(
  query: string,
  apiKey: string,
  maxResults = 5,
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {return [];}
  if (!apiKey) {
    throw new WebSearchError(
      'Tavily APIキーが設定されていません。設定画面から登録してください。',
    );
  }

  let response: Response;
  try {
    response = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: trimmed,
        // "basic" is faster and cheaper; "advanced" pulls more pages.
        search_depth: 'basic',
        max_results: maxResults,
        // We do not need their pre-synthesized answer — the LLM will
        // produce its own. Disabling shortens the response.
        include_answer: false,
        // Have Tavily fetch and clean each linked page so the model can
        // reason over actual article bodies, not just snippets. Adds
        // latency and tokens but materially improves answer quality.
        include_raw_content: true,
        include_images: false,
      }),
    });
  } catch (e: any) {
    throw new WebSearchError(
      `ネットワークエラー: Tavily に接続できませんでした (${e?.message ?? e})`,
    );
  }

  if (!response.ok) {
    let detail = '';
    try {
      const json = await response.json();
      detail = json?.error || json?.detail || JSON.stringify(json);
    } catch {
      try {
        detail = await response.text();
      } catch {
        /* ignore */
      }
    }
    if (response.status === 401 || response.status === 403) {
      throw new WebSearchError(
        'Tavily APIキーが無効です。設定画面を確認してください。',
      );
    }
    if (response.status === 429) {
      throw new WebSearchError(
        'Tavily のレート制限に達しました。しばらく待ってから再試行してください。',
      );
    }
    throw new WebSearchError(
      `Tavily APIエラー (${response.status}): ${detail}`,
    );
  }

  let data: any;
  try {
    data = await response.json();
  } catch (e: any) {
    throw new WebSearchError(`Tavilyの応答をJSONとして解析できませんでした: ${e?.message ?? e}`);
  }

  const rawResults = Array.isArray(data?.results) ? data.results : [];
  const out: SearchResult[] = [];
  for (const r of rawResults) {
    if (out.length >= maxResults) {break;}
    const title = typeof r?.title === 'string' ? r.title : '';
    const url = typeof r?.url === 'string' ? r.url : '';
    const snippet = typeof r?.content === 'string' ? r.content : '';
    const rawContent =
      typeof r?.raw_content === 'string' ? r.raw_content : undefined;
    if (!title && !snippet && !rawContent) {continue;}
    out.push({title, url, snippet, rawContent});
  }
  return out;
}

// ── helpers for LLM consumption ───────────────────────────────────────

export function formatResultsForLLM(
  query: string,
  results: SearchResult[],
): string {
  if (results.length === 0) {
    return `No web results found for "${query}".`;
  }
  return (
    `Web search results for "${query}":\n\n` +
    results
      .map((r, i) => {
        const lines = [
          `[${i + 1}] ${r.title || '(no title)'}`,
          `URL: ${r.url || '(no url)'}`,
          r.snippet ? `Summary: ${r.snippet}` : '',
        ];
        if (r.rawContent) {
          const trimmed = r.rawContent.slice(0, RAW_CONTENT_LIMIT);
          const truncated = r.rawContent.length > RAW_CONTENT_LIMIT;
          lines.push(
            `Page content:\n${trimmed}${truncated ? '\n…(truncated)' : ''}`,
          );
        }
        return lines.filter(Boolean).join('\n');
      })
      .join('\n\n---\n\n')
  );
}
