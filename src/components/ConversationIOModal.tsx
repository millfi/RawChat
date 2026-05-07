/**
 * Modal for exporting and importing the conversation as JSON.
 *
 * Why no clipboard module?
 *   `@react-native-clipboard/clipboard` would work but adds a dependency
 *   and a native autolink. A multi-line `TextInput` lets the user
 *   Ctrl+A → Ctrl+C (export) or paste (import) without any extra code.
 */

import React, {useEffect, useState} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {Message, ModelId} from '../api/deepseek';
import {useColors} from '../hooks/useColors';
import {
  exportConversation,
  importConversation,
  ImportError,
} from '../utils/conversationIO';

type Mode = 'export' | 'import';

interface Props {
  visible: boolean;
  mode: Mode;
  messages: Message[];
  model: ModelId;
  onClose: () => void;
  onImport: (messages: Message[], model?: ModelId) => void;
  makeId: () => string;
}

export function ConversationIOModal({
  visible,
  mode,
  messages,
  model,
  onClose,
  onImport,
  makeId,
}: Props) {
  const C = useColors();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Re-seed the textarea each time the modal opens.
  useEffect(() => {
    if (!visible) {return;}
    setError(null);
    if (mode === 'export') {
      setText(exportConversation(messages, model));
    } else {
      setText('');
    }
  }, [visible, mode, messages, model]);

  const handleImport = () => {
    setError(null);
    try {
      const result = importConversation(text, makeId);
      onImport(result.messages, result.model);
      onClose();
    } catch (e: any) {
      if (e instanceof ImportError) {
        setError(e.message);
      } else {
        setError(e?.message ?? String(e));
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={[styles.backdrop, {backgroundColor: 'rgba(0,0,0,0.55)'}]}>
        <View
          style={[
            styles.card,
            {backgroundColor: C.cardBg, borderColor: C.divider},
          ]}>
          <View style={styles.header}>
            <Text style={[styles.title, {color: C.textPrimary}]}>
              {mode === 'export' ? '会話のエクスポート' : '会話のインポート'}
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeText, {color: C.textSecondary}]}>
                ✕
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.help, {color: C.textSecondary}]}>
            {mode === 'export'
              ? '下のテキストを Ctrl+A → Ctrl+C でコピーして保存してください。'
              : 'エクスポートしたJSONを貼り付けて「インポート」を押してください。現在の会話は置き換えられます。'}
          </Text>

          <ScrollView style={styles.scrollArea}>
            <TextInput
              style={[
                styles.textarea,
                {
                  backgroundColor: C.inputBg,
                  borderColor: C.inputBorder,
                  color: C.textPrimary,
                },
              ]}
              value={text}
              onChangeText={t => {
                setText(t);
                setError(null);
              }}
              multiline
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              editable={mode === 'import'}
              selectTextOnFocus={mode === 'export'}
              placeholder={
                mode === 'import' ? '{"format":"rawchat-conversation",...}' : ''
              }
              placeholderTextColor={C.textSecondary}
            />
          </ScrollView>

          {error && (
            <Text style={[styles.error, {color: C.errorText}]}>{error}</Text>
          )}

          <View style={styles.actions}>
            <Pressable
              style={({pressed}) => [
                styles.btn,
                {
                  backgroundColor: pressed ? C.assistantBubbleBg : 'transparent',
                  borderColor: C.divider,
                },
              ]}
              onPress={onClose}>
              <Text style={[styles.btnText, {color: C.textPrimary}]}>
                閉じる
              </Text>
            </Pressable>
            {mode === 'import' && (
              <Pressable
                style={({pressed}) => [
                  styles.btn,
                  styles.btnPrimary,
                  {
                    backgroundColor: pressed ? C.accentPressed : C.accent,
                    borderColor: C.accent,
                  },
                ]}
                onPress={handleImport}
                disabled={!text.trim()}>
                <Text style={[styles.btnText, {color: '#FFFFFF'}]}>
                  インポート
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '85%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeText: {
    fontSize: 16,
  },
  help: {
    fontSize: 12,
    lineHeight: 17,
  },
  scrollArea: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 400,
  },
  textarea: {
    minHeight: 220,
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    fontSize: 12,
    fontFamily: 'Consolas',
    lineHeight: 16,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  btnPrimary: {},
  btnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
