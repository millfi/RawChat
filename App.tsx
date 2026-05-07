/**
 * RawChat — DeepSeek Chat UI for Windows
 * @format
 */

import React, {useCallback, useEffect, useState} from 'react';
import {Platform, PlatformColor, StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {DEFAULT_MODEL, ModelId} from './src/api/deepseek';
import {ChatScreen} from './src/screens/ChatScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {loadApiKey, loadTavilyKey} from './src/storage/apiKeyStorage';
import {
  loadSelectedModel,
  loadWebSearchEnabled,
} from './src/storage/preferences';

type Screen = 'chat' | 'settings';

function AppContent() {
  const [screen, setScreen] = useState<Screen>('chat');
  const [apiKey, setApiKey] = useState('');
  const [tavilyKey, setTavilyKey] = useState('');
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const insets = useSafeAreaInsets();

  // Load all persisted state on startup.
  useEffect(() => {
    loadApiKey().then(setApiKey).catch(() => {});
    loadTavilyKey().then(setTavilyKey).catch(() => {});
    loadSelectedModel().then(setModel).catch(() => {});
    loadWebSearchEnabled().then(setWebSearchEnabled).catch(() => {});
  }, []);

  const handleApiKeySaved = useCallback((key: string) => {
    setApiKey(key);
  }, []);
  const handleTavilyKeySaved = useCallback((key: string) => {
    setTavilyKey(key);
  }, []);

  // Both screens stay mounted at all times — the inactive one is hidden
  // via `display: 'none'`. This preserves ChatScreen's conversation
  // history, draft input, in-flight request and abort controller across
  // round-trips through Settings.
  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}>
      <View
        style={styles.screen}
        pointerEvents={screen === 'chat' ? 'auto' : 'none'}>
        <View
          style={screen === 'chat' ? styles.flex : styles.hidden}>
          <ChatScreen
            apiKey={apiKey}
            tavilyKey={tavilyKey}
            model={model}
            webSearchEnabled={webSearchEnabled}
            onModelChange={setModel}
            onWebSearchChange={setWebSearchEnabled}
            onOpenSettings={() => setScreen('settings')}
          />
        </View>
      </View>
      <View
        style={styles.screen}
        pointerEvents={screen === 'settings' ? 'auto' : 'none'}>
        <View
          style={screen === 'settings' ? styles.flex : styles.hidden}>
          <SettingsScreen
            initialApiKey={apiKey}
            initialTavilyKey={tavilyKey}
            onBack={() => setScreen('chat')}
            onApiKeySaved={handleApiKeySaved}
            onTavilyKeySaved={handleTavilyKeySaved}
          />
        </View>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AppContent />
    </SafeAreaProvider>
  );
}

const APP_BG =
  Platform.OS === 'windows'
    ? PlatformColor('SystemControlAcrylicWindowBrush')
    : '#1A1A1A';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_BG as any,
  },
  screen: {
    ...StyleSheet.absoluteFillObject,
  },
  flex: {flex: 1},
  hidden: {
    flex: 1,
    display: 'none',
  },
});
