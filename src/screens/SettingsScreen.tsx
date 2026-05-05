import React, {useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useColors} from '../hooks/useColors';
import {saveApiKey} from '../storage/apiKeyStorage';

interface Props {
  /** API key already held by App.tsx — pre-fills the input. */
  initialApiKey: string;
  onBack: () => void;
  /** Called immediately after a successful save so App can update its state. */
  onApiKeySaved: (key: string) => void;
}

export function SettingsScreen({initialApiKey, onBack, onApiKeySaved}: Props) {
  const C = useColors();
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await saveApiKey(apiKey);
      onApiKeySaved(apiKey.trim()); // notify App.tsx immediately
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      // Surface storage errors so the user knows the save failed
      console.error('[SettingsScreen] save failed:', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

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
      <View style={styles.content}>
        {/* API key card */}
        <View style={[styles.card, {backgroundColor: C.cardBg}]}>
          <Text style={[styles.sectionTitle, {color: C.textPrimary}]}>
            DeepSeek API キー
          </Text>
          <Text style={[styles.description, {color: C.textSecondary}]}>
            DeepSeek Platform (platform.deepseek.com) で取得したAPIキーを入力してください。
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
            value={apiKey}
            onChangeText={text => {
              setApiKey(text);
              setSaved(false);
            }}
            placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
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
              },
            ]}
            onPress={handleSave}
            disabled={saving || apiKey.trim() === ''}>
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>
                {saved ? '✓ 保存しました' : '保存'}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Note card */}
        <View
          style={[
            styles.noteCard,
            {backgroundColor: C.cardBg, borderLeftColor: C.accent},
          ]}>
          <Text style={[styles.noteText, {color: C.textSecondary}]}>
            💡 APIキーはデバイス内にのみ保存されます。外部サーバーには送信されません。
          </Text>
        </View>
      </View>
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
    flex: 1,
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
