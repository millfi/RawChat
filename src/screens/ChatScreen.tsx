import React, {useCallback, useRef, useState} from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Message,
  ModelId,
  sendChatStream,
  StreamEvent,
  ToolCall,
  ToolEventEntry,
  WEB_SEARCH_TOOL,
} from '../api/deepseek';
import {formatResultsForLLM, searchWeb} from '../api/webSearch';
import {ChatInputBar, ChatInputBarHandle} from '../components/ChatInputBar';
import {ConversationIOModal} from '../components/ConversationIOModal';
import {DisplayMessage, MessageBubble} from '../components/MessageBubble';
import {ModelPicker} from '../components/ModelPicker';
import {Tooltip} from '../components/Tooltip';
import {useColors} from '../hooks/useColors';
import {saveSelectedModel, saveWebSearchEnabled} from '../storage/preferences';

let nextId = 1;
function makeId() {
  return String(nextId++);
}

interface Props {
  apiKey: string;
  tavilyKey: string;
  model: ModelId;
  webSearchEnabled: boolean;
  onModelChange: (m: ModelId) => void;
  onWebSearchChange: (enabled: boolean) => void;
  onOpenSettings: () => void;
}

export function ChatScreen({
  apiKey,
  tavilyKey,
  model,
  webSearchEnabled,
  onModelChange,
  onWebSearchChange,
  onOpenSettings,
}: Props) {
  const C = useColors();

  // Committed conversation history (what eventually gets exported).
  const [messages, setMessages] = useState<Message[]>([]);

  // Ephemeral display rows for the in-flight request: tool-status pills
  // and the streaming assistant bubble. Wiped after the response settles
  // and the final assistant message is appended to `messages`.
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [toolStatuses, setToolStatuses] = useState<DisplayMessage[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ioMode, setIoMode] = useState<'export' | 'import' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const flatListRef = useRef<FlatList<DisplayMessage>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputBarRef = useRef<ChatInputBarHandle>(null);

  // Refs so the async stream callback never reads stale state.
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;
  const loadingRef = useRef(false);
  loadingRef.current = loading;
  const modelRef = useRef(model);
  modelRef.current = model;
  const webSearchRef = useRef(webSearchEnabled);
  webSearchRef.current = webSearchEnabled;
  const apiKeyRef = useRef(apiKey);
  apiKeyRef.current = apiKey;
  const tavilyKeyRef = useRef(tavilyKey);
  tavilyKeyRef.current = tavilyKey;

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({animated: true});
  }, []);

  // Visible row list. For each persisted message, prepend any tool
  // events that were captured during that turn (web-search pills etc.)
  // so they live as part of the conversation transcript instead of
  // disappearing the moment the assistant finishes speaking.
  const displayMessages: DisplayMessage[] = [];
  for (const m of messages) {
    if (m.toolEvents) {
      for (const ev of m.toolEvents) {
        displayMessages.push({
          id: ev.id,
          role: 'tool_status',
          content: ev.label,
          toolStatus: 'done',
          searchQuery: ev.searchQuery,
          searchSources: ev.searchSources,
        });
      }
    }
    displayMessages.push({id: m.id, role: m.role, content: m.content});
  }
  // In-flight rows for the current request (cleared on completion).
  displayMessages.push(...toolStatuses);
  if (streamingId) {
    displayMessages.push({
      id: streamingId,
      role: 'assistant',
      content: streamingText,
      streaming: true,
    });
  }

  // ── Send ────────────────────────────────────────────────────────────

  // ChatInputBar passes the trimmed text directly; we no longer hold an
  // `input` state in this screen (uncontrolled — see ChatInputBar.tsx).
  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loadingRef.current) {return;}
    if (!apiKeyRef.current) {
      setError('APIキーが設定されていません。右上の設定から入力してください。');
      return;
    }

    const userMessage: Message = {id: makeId(), role: 'user', content: trimmed};
    const baseMessages = [...messagesRef.current, userMessage];
    setMessages(baseMessages);
    setError(null);
    setLoading(true);

    const assistantId = makeId();
    setStreamingId(assistantId);
    setStreamingText('');
    setToolStatuses([]);
    setTimeout(scrollToBottom, 50);

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    let accumulated = '';

    // Local mirror of the tool-status pills so we can attach them to
    // the final assistant Message at the end of the request. The React
    // state (`toolStatuses`) drives the live UI; this array survives
    // across the await chain and is what we persist.
    //
    // NOTE: tool calls execute SEQUENTIALLY in deepseek.ts's tool-round
    // loop, so at most one is "running" at a time — `currentToolId`
    // tracks that single in-flight one.
    const localToolEvents: ToolEventEntry[] = [];
    let currentToolId: string | null = null;

    const onEvent = (e: StreamEvent) => {
      if (e.type === 'content') {
        accumulated += e.text;
        setStreamingText(accumulated);
      } else if (e.type === 'tool_call_start') {
        const id = makeId();
        const label =
          e.name === 'web_search'
            ? `🌐 ウェブ検索中: "${e.argsPreview}"`
            : `🔧 ${e.name}(${e.argsPreview}) 実行中`;
        currentToolId = id;
        localToolEvents.push({id, label});
        setToolStatuses(prev => [
          ...prev,
          {id, role: 'tool_status', content: label, toolStatus: 'running'},
        ]);
      } else if (e.type === 'tool_call_done') {
        const id = currentToolId;
        currentToolId = null;
        const doneLabel =
          e.name === 'web_search'
            ? '🌐 ウェブ検索完了'
            : `🔧 ${e.name} 完了`;
        if (id) {
          const idx = localToolEvents.findIndex(ev => ev.id === id);
          if (idx >= 0) {
            localToolEvents[idx] = {...localToolEvents[idx], label: doneLabel};
          }
        }
        setToolStatuses(prev =>
          prev.map(t =>
            t.id === id ? {...t, content: doneLabel, toolStatus: 'done'} : t,
          ),
        );
        // Tool round done: discard any leading partial text from the
        // first round so the next round streams cleanly into the bubble.
        accumulated = '';
        setStreamingText('');
        setTimeout(scrollToBottom, 30);
      }
    };

    const onToolCall = async (call: ToolCall): Promise<string> => {
      if (call.function.name === 'web_search') {
        try {
          const args = JSON.parse(call.function.arguments || '{}');
          const query = String(args.query ?? '');
          const results = await searchWeb(query, tavilyKeyRef.current, 5);

          // Keep ONLY URLs whose full page Tavily actually fetched
          // (raw_content present). Results without raw_content are still
          // passed to the LLM as snippet-only context, but we don't
          // surface them in the UI because the user wants the sites the
          // AI "read in full".
          const fullyFetched = results.filter(
            r => typeof r.rawContent === 'string' && r.rawContent.length > 0,
          );
          const sources = fullyFetched.map(r => ({
            title: r.title,
            url: r.url,
          }));

          // Attach query + sources to the in-flight tool event (both
          // the local mirror that gets persisted AND the live React
          // state that drives the UI).
          const id = currentToolId;
          if (id) {
            const idx = localToolEvents.findIndex(ev => ev.id === id);
            if (idx >= 0) {
              localToolEvents[idx] = {
                ...localToolEvents[idx],
                searchQuery: query,
                searchSources: sources,
              };
            }
            setToolStatuses(prev =>
              prev.map(t =>
                t.id === id
                  ? {...t, searchQuery: query, searchSources: sources}
                  : t,
              ),
            );
          }

          return formatResultsForLLM(query, results);
        } catch (err: any) {
          // Surface key/network errors to the model so it can tell the
          // user what to do (e.g. add a Tavily key) rather than retrying.
          return `Search failed: ${err?.message ?? String(err)}`;
        }
      }
      return `Tool "${call.function.name}" not implemented.`;
    };

    try {
      const finalText = await sendChatStream({
        apiKey: apiKeyRef.current,
        model: modelRef.current,
        messages: baseMessages,
        tools: webSearchRef.current ? [WEB_SEARCH_TOOL] : undefined,
        onToolCall: webSearchRef.current ? onToolCall : undefined,
        onEvent,
        signal: controller.signal,
      });

      const finalMessage: Message = {
        id: assistantId,
        role: 'assistant',
        content: finalText,
        // Persist the tool pills onto this turn so they remain visible
        // as part of the conversation transcript after the response
        // settles (and across subsequent sends).
        toolEvents: localToolEvents.length > 0 ? localToolEvents : undefined,
      };
      setMessages(prev => [...prev, finalMessage]);
      setStreamingId(null);
      setStreamingText('');
      setToolStatuses([]);
      setTimeout(scrollToBottom, 50);
    } catch (e: any) {
      setError(e?.message ?? '不明なエラーが発生しました。');
      // Preserve any partial text as a fallback assistant message,
      // along with whatever tool events were already captured.
      if (accumulated) {
        setMessages(prev => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: accumulated,
            toolEvents:
              localToolEvents.length > 0 ? localToolEvents : undefined,
          },
        ]);
      }
      setStreamingId(null);
      setStreamingText('');
      setToolStatuses([]);
    } finally {
      setLoading(false);
      if (abortRef.current === controller) {abortRef.current = null;}
    }
  }, [scrollToBottom]);

  const handleStop = () => abortRef.current?.abort();

  // ── Model & search controls ────────────────────────────────────────

  const handleModelChange = (m: ModelId) => {
    onModelChange(m);
    saveSelectedModel(m);
  };

  const toggleWebSearch = () => {
    const next = !webSearchEnabled;
    onWebSearchChange(next);
    saveWebSearchEnabled(next);
  };

  const handleImport = (imported: Message[], importedModel?: ModelId) => {
    setMessages(imported);
    setStreamingId(null);
    setStreamingText('');
    setToolStatuses([]);
    setError(null);
    inputBarRef.current?.clear();
    if (importedModel) {
      onModelChange(importedModel);
      saveSelectedModel(importedModel);
    }
  };

  // ── UI ─────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, {backgroundColor: C.rootBg}]}>
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          {backgroundColor: C.headerBg, borderBottomColor: C.divider},
        ]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, {color: C.textPrimary}]}>
            RawChat
          </Text>
          <ModelPicker
            value={model}
            onChange={handleModelChange}
            disabled={loading}
          />
        </View>

        <View style={styles.headerRight}>
          <Tooltip
            text={
              webSearchEnabled
                ? tavilyKey
                  ? 'ウェブ検索ON (Tavily): モデルが必要に応じて検索します'
                  : 'ウェブ検索ON ですが Tavily APIキーが未設定です。設定画面から登録してください。'
                : 'ウェブ検索OFF'
            }>
            <Pressable
              style={({pressed, hovered}: any) => [
                styles.iconBtn,
                {
                  backgroundColor: webSearchEnabled
                    ? tavilyKey
                      ? C.accent
                      : C.warningBg
                    : pressed
                      ? C.assistantBubbleBg
                      : hovered
                        ? C.cardBg
                        : 'transparent',
                  borderColor: C.divider,
                },
              ]}
              onPress={toggleWebSearch}>
              <Text
                style={[
                  styles.iconBtnText,
                  {color: webSearchEnabled ? '#FFFFFF' : C.textPrimary},
                ]}>
                🌐
              </Text>
            </Pressable>
          </Tooltip>

          <Tooltip text="メニュー">
            <Pressable
              style={({pressed, hovered}: any) => [
                styles.iconBtn,
                {
                  backgroundColor: pressed
                    ? C.assistantBubbleBg
                    : hovered
                      ? C.cardBg
                      : 'transparent',
                  borderColor: C.divider,
                },
              ]}
              onPress={() => setMenuOpen(o => !o)}>
              <Text style={[styles.iconBtnText, {color: C.textPrimary}]}>
                ⋯
              </Text>
            </Pressable>
          </Tooltip>

          <Pressable
            style={({pressed}) => [
              styles.settingsBtn,
              {
                backgroundColor: pressed ? C.assistantBubbleBg : 'transparent',
              },
            ]}
            onPress={onOpenSettings}>
            <Text style={[styles.settingsBtnText, {color: C.textPrimary}]}>
              ⚙ 設定
            </Text>
          </Pressable>
        </View>

        {/* Overflow menu */}
        {menuOpen && (
          <>
            <Pressable
              style={styles.menuBackdrop}
              onPress={() => setMenuOpen(false)}
            />
            <View
              style={[
                styles.menu,
                {backgroundColor: C.cardBg, borderColor: C.divider},
              ]}>
              <MenuItem
                label="📤 会話をエクスポート"
                disabled={messages.length === 0}
                onPress={() => {
                  setMenuOpen(false);
                  setIoMode('export');
                }}
              />
              <MenuItem
                label="📥 会話をインポート"
                onPress={() => {
                  setMenuOpen(false);
                  setIoMode('import');
                }}
              />
              <MenuItem
                label="🗑 会話をクリア"
                disabled={messages.length === 0 || loading}
                destructive
                onPress={() => {
                  setMenuOpen(false);
                  setMessages([]);
                  setError(null);
                }}
              />
            </View>
          </>
        )}
      </View>

      {/* ── APIキー未設定バナー ── */}
      {!apiKey && (
        <Pressable
          style={[styles.apiBanner, {backgroundColor: C.warningBg}]}
          onPress={onOpenSettings}>
          <Text style={[styles.apiBannerText, {color: C.warningText}]}>
            ⚠ DeepSeek APIキーが設定されていません。タップして設定へ →
          </Text>
        </Pressable>
      )}
      {apiKey && webSearchEnabled && !tavilyKey && (
        <Pressable
          style={[styles.apiBanner, {backgroundColor: C.warningBg}]}
          onPress={onOpenSettings}>
          <Text style={[styles.apiBannerText, {color: C.warningText}]}>
            ⚠ ウェブ検索ON ですが Tavily APIキーが未設定です。タップして設定へ →
          </Text>
        </Pressable>
      )}

      {/* ── メッセージ一覧 ── */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          keyExtractor={item => item.id}
          renderItem={({item}) => <MessageBubble message={item} />}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          onContentSizeChange={scrollToBottom}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyTitle, {color: C.textPrimary}]}>
                DeepSeek Chat
              </Text>
              <Text style={[styles.emptySubtitle, {color: C.textSecondary}]}>
                メッセージを入力して会話を始めましょう
              </Text>
              <Text style={[styles.emptyHint, {color: C.textSecondary}]}>
                Enter: 改行 / Ctrl+Enter: 送信
              </Text>
            </View>
          }
        />

        {/* ── エラー表示 ── */}
        {error && (
          <View style={[styles.errorBar, {backgroundColor: C.errorBg}]}>
            <Text style={[styles.errorText, {color: C.errorText}]}>
              {error}
            </Text>
            <Pressable onPress={() => setError(null)}>
              <Text style={[styles.errorDismiss, {color: C.errorText}]}>
                ✕
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── 入力欄 ── */}
        <ChatInputBar
          ref={inputBarRef}
          loading={loading}
          disabled={!apiKey}
          onSend={handleSend}
          onStop={handleStop}
        />
      </KeyboardAvoidingView>

      <ConversationIOModal
        visible={ioMode !== null}
        mode={ioMode ?? 'export'}
        messages={messages}
        model={model}
        onClose={() => setIoMode(null)}
        onImport={handleImport}
        makeId={makeId}
      />
    </View>
  );
}

// ── Small overflow-menu item ──────────────────────────────────────────

function MenuItem({
  label,
  onPress,
  disabled,
  destructive,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const C = useColors();
  return (
    <Pressable
      style={({pressed, hovered}: any) => [
        styles.menuItem,
        {
          backgroundColor:
            pressed || hovered ? C.assistantBubbleBg : 'transparent',
          opacity: disabled ? 0.4 : 1,
        },
      ]}
      disabled={disabled}
      onPress={onPress}>
      <Text
        style={[
          styles.menuItemText,
          {color: destructive ? C.errorText : C.textPrimary},
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  flex: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  iconBtn: {
    width: 34,
    height: 30,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 14,
  },
  settingsBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  settingsBtnText: {
    fontSize: 13,
  },
  menuBackdrop: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: 5,
  },
  menu: {
    position: 'absolute',
    top: '100%',
    right: 8,
    marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 4,
    minWidth: 200,
    zIndex: 30,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  menuItemText: {
    fontSize: 13,
  },
  apiBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  apiBannerText: {
    fontSize: 13,
  },
  messageList: {flex: 1},
  messageListContent: {
    paddingVertical: 12,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  errorText: {flex: 1, fontSize: 13},
  errorDismiss: {fontSize: 16, paddingHorizontal: 4},
  // The input bar / send-button styles now live inside ChatInputBar.tsx.
});
