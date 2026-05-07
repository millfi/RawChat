import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useColors} from '../hooks/useColors';
import {
  saveApiKey,
  saveTavilyKey,
} from '../storage/apiKeyStorage';

interface Props {
  /** Currently held by App.tsx — pre-fills the input. */
  initialApiKey: string;
  initialTavilyKey: string;
  onBack: () => void;
  /** Called immediately after a successful save so App can update its state. */
  onApiKeySaved: (key: string) => void;
  onTavilyKeySaved: (key: string) => void;
}

export function SettingsScreen({
  initialApiKey,
  initialTavilyKey,
  onBack,
  onApiKeySaved,
  onTavilyKeySaved,
}: Props) {
  const C = useColors();

  return (
    <View style={[styles.root, {backgroundColor: C.rootBg}]}>
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          {backgroundColor: C.headerBg, borderBottomColor: C.divider},
        ]}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={[styles.backButtonText, {color: C.textPrimary}]}>
            ← 戻る
          </Text>
        </Pressable>
        <Text style={[styles.title, {color: C.textPrimary}]}>設定</Text>
      </View>

      {/* ── Content ── */}
      <ScrollView contentContainerStyle={styles.content}>
        <ApiKeyCard
          title="DeepSeek API キー"
          description="DeepSeek Platform (platform.deepseek.com) で取得したAPIキーを入力してください。"
          placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
          initialValue={initialApiKey}
          onSave={async value => {
            await saveApiKey(value);
            onApiKeySaved(value.trim());
          }}
        />

        <ApiKeyCard
          title="Tavily API キー (ウェブ検索用)"
          description="ウェブ検索を有効にするには Tavily (app.tavily.com) で取得したAPIキーを入力してください。月1,000回まで無料です。未設定でもチャットは利用できます。"
          placeholder="tvly-xxxxxxxxxxxxxxxxxxxxxxxx"
          initialValue={initialTavilyKey}
          onSave={async value => {
            await saveTavilyKey(value);
            onTavilyKeySaved(value.trim());
          }}
        />

        {/* Note card */}
        <View
          style={[
            styles.noteCard,
            {backgroundColor: C.cardBg, borderLeftColor: C.accent},
          ]}>
          <Text style={[styles.noteText, {color: C.textSecondary}]}>
            💡 APIキーはデバイス内にのみ保存されます。チャット送信時にDeepSeek、ウェブ検索時にTavilyのみに送信されます。
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Reusable card for one API key ─────────────────────────────────────

interface CardProps {
  title: string;
  description: string;
  placeholder: string;
  initialValue: string;
  onSave: (value: string) => Promise<void>;
}

function ApiKeyCard({title, description, placeholder, initialValue, onSave}: CardProps) {
  const C = useColors();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Keep the input in sync if the parent's persisted value loads after mount.
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await onSave(value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      console.error(`[Settings] save "${title}" failed:`, e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  // Allow saving an empty string to clear the key.
  const canSave = !saving && value !== initialValue;

  return (
    <View style={[styles.card, {backgroundColor: C.cardBg}]}>
      <Text style={[styles.sectionTitle, {color: C.textPrimary}]}>{title}</Text>
      <Text style={[styles.description, {color: C.textSecondary}]}>
        {description}
      </Text>

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: C.inputBg,
            borderColor: C.inputBorder,
            color: C.textPrimary,
          },
        ]}
        value={value}
        onChangeText={text => {
          setValue(text);
          setSaved(false);
        }}
        placeholder={placeholder}
        placeholderTextColor={C.textSecondary}
        secureTextEntry
        autoCorrect={false}
        autoCapitalize="none"
      />

      <Pressable
        style={({pressed}) => [
          styles.saveButton,
          {
            backgroundColor: saved
              ? C.success
              : pressed
                ? C.accentPressed
                : C.accent,
            opacity: canSave ? 1 : 0.5,
          },
        ]}
        onPress={handleSave}
        disabled={!canSave}>
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.saveButtonText}>
            {saved ? '✓ 保存しました' : '保存'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    padding: 24,
    gap: 16,
  },
  card: {
    borderRadius: 8,
    padding: 20,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Consolas',
  },
  saveButton: {
    borderRadius: 4,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  noteCard: {
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 3,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
