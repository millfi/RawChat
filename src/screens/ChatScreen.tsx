import React, {useCallback, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {Message, sendChatMessage} from '../api/deepseek';
import {MessageBubble} from '../components/MessageBubble';
import {useColors} from '../hooks/useColors';

let nextId = 1;
function makeId() {
  return String(nextId++);
}

interface Props {
  /** API key managed by App.tsx (updated immediately when settings saves). */
  apiKey: string;
  onOpenSettings: () => void;
}

export function ChatScreen({apiKey, onOpenSettings}: Props) {
  const C = useColors();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<Message>>(null);

  /**
   * Always-current references so async callbacks never hold stale closures.
   * Updated every render (before any effects or callbacks run).
   */
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  const inputRef = useRef('');
  inputRef.current = input;

  const loadingRef = useRef(false);
  loadingRef.current = loading;

  // Stable forever — uses the ref so it never captures a stale list length.
  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({animated: true});
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = inputRef.current.trim();
    if (!trimmed || loadingRef.current) {return;}

    if (!apiKey) {
      setError('APIキーが設定されていません。右上の設定から入力してください。');
      return;
    }

    const userMessage: Message = {id: makeId(), role: 'user', content: trimmed};
    // Always read the latest messages from the ref, never from a stale closure.
    const nextMessages = [...messagesRef.current, userMessage];

    setMessages(nextMessages);
    setInput('');
    setError(null);
    setLoading(true);
    setTimeout(scrollToBottom, 100);

    try {
      const reply = await sendChatMessage(nextMessages, apiKey);
      const assistantMessage: Message = {
        id: makeId(),
        role: 'assistant',
        content: reply,
      };
      setMessages(prev => [...prev, assistantMessage]);
      setTimeout(scrollToBottom, 100);
    } catch (e: any) {
      setError(e?.message ?? '不明なエラーが発生しました。');
    } finally {
      setLoading(false);
    }
    // Depends only on the stable apiKey prop and the stable scrollToBottom.
    // input/loading/messages are accessed through refs so they don't need to
    // be dependencies — the refs are always current.
  }, [apiKey, scrollToBottom]);

  const canSend = input.trim().length > 0 && !loading;

  return (
    <View style={[styles.root, {backgroundColor: C.rootBg}]}>
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          {backgroundColor: C.headerBg, borderBottomColor: C.divider},
        ]}>
        <Text style={[styles.headerTitle, {color: C.textPrimary}]}>
          RawChat
        </Text>
        <Pressable style={styles.settingsButton} onPress={onOpenSettings}>
          <Text style={[styles.settingsButtonText, {color: C.textPrimary}]}>
            ⚙ 設定
          </Text>
        </Pressable>
      </View>

      {/* ── APIキー未設定バナー ── */}
      {!apiKey && (
        <Pressable
          style={[styles.apiBanner, {backgroundColor: C.warningBg}]}
          onPress={onOpenSettings}>
          <Text style={[styles.apiBannerText, {color: C.warningText}]}>
            ⚠ APIキーが設定されていません。タップして設定へ →
          </Text>
        </Pressable>
      )}

      {/* ── メッセージ一覧 ── */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={flatListRef}
          data={messages}
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
              <Text style={[styles.errorDismiss, {color: C.errorText}]}>✕</Text>
            </Pressable>
          </View>
        )}

        {/* ── ローディング ── */}
        {loading && (
          <View style={styles.typingIndicator}>
            <ActivityIndicator size="small" color={C.accent} />
            <Text style={[styles.typingText, {color: C.textSecondary}]}>
              考え中...
            </Text>
          </View>
        )}

        {/* ── 入力欄 ── */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: C.inputBarBg,
              borderTopColor: C.divider,
            },
          ]}>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: C.inputBg,
                borderColor: C.inputBorder,
                color: C.textPrimary,
              },
            ]}
            value={input}
            onChangeText={setInput}
            placeholder="メッセージを入力..."
            placeholderTextColor={C.textSecondary}
            multiline
            maxLength={4000}
            onSubmitEditing={
              Platform.OS === 'windows' ? handleSend : undefined
            }
            blurOnSubmit={false}
          />
          <Pressable
            style={({pressed}) => [
              styles.sendButton,
              {
                backgroundColor: canSend
                  ? pressed
                    ? C.accentPressed
                    : C.accent
                  : C.inputBorder,
              },
            ]}
            onPress={handleSend}
            disabled={!canSend}>
            <Text
              style={[
                styles.sendButtonText,
                {color: canSend ? '#FFFFFF' : C.textSecondary},
              ]}>
              ↑
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  settingsButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  settingsButtonText: {
    fontSize: 14,
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
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  typingText: {fontSize: 13},
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  errorText: {flex: 1, fontSize: 13},
  errorDismiss: {fontSize: 16, paddingHorizontal: 4},
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
});
