/**
 * Conversation export / import.
 *
 * The export format is a self-describing JSON document:
 *
 *   {
 *     "format": "rawchat-conversation",
 *     "version": 1,
 *     "exportedAt": "2026-05-05T12:00:00.000Z",
 *     "model": "deepseek-v4-flash",
 *     "messages": [
 *       { "role": "user",      "content": "..." },
 *       { "role": "assistant", "content": "...",
 *         "toolEvents": [
 *           { "id": "...", "label": "🌐 ウェブ検索完了",
 *             "searchQuery": "...",
 *             "searchSources": [{"title": "...", "url": "..."}] }
 *         ] }
 *     ]
 *   }
 *
 * The id field on Messages and ToolEventEntries is regenerated on import
 * so the same payload can be imported repeatedly without colliding with
 * other ids in the session.
 */

import {Message, MODELS, ModelId, ToolEventEntry} from '../api/deepseek';

export const EXPORT_FORMAT = 'rawchat-conversation';
export const EXPORT_VERSION = 1;

interface ExportedToolEvent {
  label: string;
  searchQuery?: string;
  searchSources?: Array<{title: string; url: string}>;
}

interface ExportedMessage {
  role: 'user' | 'assistant';
  content: string;
  toolEvents?: ExportedToolEvent[];
}

export interface ExportedConversation {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  model?: ModelId;
  messages: ExportedMessage[];
}

export function exportConversation(
  messages: Message[],
  model: ModelId,
): string {
  const payload: ExportedConversation = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    model,
    messages: messages.map(m => {
      const out: ExportedMessage = {role: m.role, content: m.content};
      if (m.toolEvents && m.toolEvents.length > 0) {
        out.toolEvents = m.toolEvents.map(ev => {
          const t: ExportedToolEvent = {label: ev.label};
          if (ev.searchQuery) {t.searchQuery = ev.searchQuery;}
          if (ev.searchSources) {t.searchSources = ev.searchSources;}
          return t;
        });
      }
      return out;
    }),
  };
  return JSON.stringify(payload, null, 2);
}

export interface ImportResult {
  messages: Message[];
  model?: ModelId;
}

export class ImportError extends Error {}

const VALID_MODEL_IDS = new Set<string>(MODELS.map(m => m.id));

export function importConversation(
  text: string,
  makeId: () => string,
): ImportResult {
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError('JSONとして解析できませんでした。');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new ImportError('JSONオブジェクトが必要です。');
  }
  if (parsed.format !== EXPORT_FORMAT) {
    throw new ImportError(
      `format が "${EXPORT_FORMAT}" ではありません: ${parsed.format}`,
    );
  }
  if (!Array.isArray(parsed.messages)) {
    throw new ImportError('messages 配列がありません。');
  }

  const messages: Message[] = [];
  for (const m of parsed.messages) {
    if (!m || typeof m !== 'object') {continue;}
    if (m.role !== 'user' && m.role !== 'assistant') {continue;}
    if (typeof m.content !== 'string') {continue;}

    const message: Message = {id: makeId(), role: m.role, content: m.content};

    if (Array.isArray(m.toolEvents) && m.toolEvents.length > 0) {
      const toolEvents: ToolEventEntry[] = [];
      for (const ev of m.toolEvents) {
        if (!ev || typeof ev !== 'object') {continue;}
        if (typeof ev.label !== 'string') {continue;}
        const t: ToolEventEntry = {id: makeId(), label: ev.label};
        if (typeof ev.searchQuery === 'string') {t.searchQuery = ev.searchQuery;}
        if (Array.isArray(ev.searchSources)) {
          t.searchSources = ev.searchSources
            .filter(
              (s: any) =>
                s && typeof s.title === 'string' && typeof s.url === 'string',
            )
            .map((s: any) => ({title: s.title, url: s.url}));
        }
        toolEvents.push(t);
      }
      if (toolEvents.length > 0) {
        message.toolEvents = toolEvents;
      }
    }

    messages.push(message);
  }
  if (messages.length === 0) {
    throw new ImportError('有効なメッセージが見つかりませんでした。');
  }

  const model: ModelId | undefined =
    typeof parsed.model === 'string' && VALID_MODEL_IDS.has(parsed.model)
      ? (parsed.model as ModelId)
      : undefined;

  return {messages, model};
}
