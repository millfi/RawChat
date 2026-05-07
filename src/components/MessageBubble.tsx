import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useColors} from '../hooks/useColors';

/**
 * Visual model for a chat row.
 *
 * The chat is structurally a list of `Message` records, but the screen
 * also injects ephemeral rows (`tool_status`, in-flight assistant
 * `streaming` bubble) so the user sees what's happening in real time.
 * MessageBubble accepts a slightly richer shape so all rows can flow
 * through one renderer.
 */
export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool_status';
  /** Visible text. For `streaming` rows this grows on each delta. */
  content: string;
  /** True if this assistant bubble is still being streamed. */
  streaming?: boolean;
  /** True for tool-call status rows (web search etc). */
  toolStatus?: 'running' | 'done' | 'error';
  /** Search query the model issued (web_search rows only). */
  searchQuery?: string;
  /** URLs Tavily fetched with raw_content; rendered as clickable links. */
  searchSources?: Array<{title: string; url: string}>;
}

interface Props {
  message: DisplayMessage;
}

export function MessageBubble({message}: Props) {
  const C = useColors();

  if (message.role === 'tool_status') {
    return (
      <View style={styles.toolRow}>
        <View
          style={[
            styles.toolCard,
            {backgroundColor: C.cardBg, borderColor: C.divider},
          ]}>
          <View style={styles.toolHeader}>
            {message.toolStatus === 'running' && (
              <ActivityIndicator size="small" color={C.accent} />
            )}
            <Text style={[styles.toolText, {color: C.textSecondary}]}>
              {message.content}
            </Text>
          </View>

          {message.searchQuery && (
            <Text style={[styles.searchQuery, {color: C.textPrimary}]}>
              検索ワード: <Text style={styles.searchQueryValue}>"{message.searchQuery}"</Text>
            </Text>
          )}

          {message.searchSources && (
            <View style={styles.sourceList}>
              <Text style={[styles.sourceLabel, {color: C.textSecondary}]}>
                {message.searchSources.length > 0
                  ? `AIが全文を読んだサイト (${message.searchSources.length}):`
                  : 'AIが全文を読めたサイトはありません (snippetのみで回答)'}
              </Text>
              {message.searchSources.map((s, i) => (
                <Pressable
                  key={`${i}-${s.url}`}
                  onPress={() => Linking.openURL(s.url).catch(() => {})}
                  style={({pressed, hovered}: any) => [
                    styles.sourceItem,
                    {
                      backgroundColor: pressed
                        ? C.assistantBubbleBg
                        : hovered
                          ? C.assistantBubbleBg
                          : 'transparent',
                    },
                  ]}>
                  <Text
                    style={[styles.sourceTitle, {color: C.accent}]}
                    numberOfLines={1}>
                    {i + 1}. {s.title || s.url}
                  </Text>
                  <Text
                    style={[styles.sourceUrl, {color: C.textSecondary}]}
                    numberOfLines={1}>
                    {s.url}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  }

  const isUser = message.role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && (
        <View style={[styles.avatar, {backgroundColor: C.avatarBg}]}>
          <Text style={styles.avatarText}>AI</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          {
            backgroundColor: isUser ? C.userBubbleBg : C.assistantBubbleBg,
          },
        ]}>
        <Text
          style={[
            styles.text,
            {color: isUser ? C.userBubbleText : C.assistantBubbleText},
          ]}>
          {message.content}
          {message.streaming && (
            <Text style={{color: C.textSecondary}}>{' ▍'}</Text>
          )}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    paddingHorizontal: 12,
  },
  rowUser: {justifyContent: 'flex-end'},
  rowAssistant: {justifyContent: 'flex-start'},
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  avatarText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  bubble: {
    maxWidth: '75%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  bubbleUser: {borderBottomRightRadius: 4},
  bubbleAssistant: {borderBottomLeftRadius: 4},
  text: {
    fontSize: 14,
    lineHeight: 20,
  },

  // ── tool status card ────────────────────────────────────────────────
  toolRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 6,
    paddingHorizontal: 12,
  },
  toolCard: {
    minWidth: 280,
    maxWidth: '92%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  searchQuery: {
    fontSize: 12,
    marginTop: 2,
  },
  searchQueryValue: {
    fontWeight: '600',
  },
  sourceList: {
    gap: 2,
    marginTop: 4,
  },
  sourceLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  sourceItem: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
  },
  sourceTitle: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  sourceUrl: {
    fontSize: 10,
    marginTop: 1,
  },
});
