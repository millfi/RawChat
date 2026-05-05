/**
 * RawChat — DeepSeek Chat UI for Windows
 * @format
 */

import React, {useCallback, useEffect, useState} from 'react';
import {Platform, PlatformColor, StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChatScreen} from './src/screens/ChatScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {loadApiKey} from './src/storage/apiKeyStorage';

type Screen = 'chat' | 'settings';

function AppContent() {
  const [screen, setScreen] = useState<Screen>('chat');
  const [apiKey, setApiKey] = useState('');
  const insets = useSafeAreaInsets();

  // Load persisted API key on startup
  useEffect(() => {
    loadApiKey().then(k => setApiKey(k)).catch(() => {});
  }, []);

  // Called by SettingsScreen immediately after a successful save
  const handleApiKeySaved = useCallback((key: string) => {
    setApiKey(key);
  }, []);

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
      {screen === 'chat' ? (
        <ChatScreen
          apiKey={apiKey}
          onOpenSettings={() => setScreen('settings')}
        />
      ) : (
        <SettingsScreen
          initialApiKey={apiKey}
          onBack={() => setScreen('chat')}
          onApiKeySaved={handleApiKeySaved}
        />
      )}
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
});
