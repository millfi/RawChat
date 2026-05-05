/**
 * API key storage backed by AppSettingsModule (C++ native module).
 *
 * RNW 0.82 runs in New Architecture mode (RnwNewArch=true), so native modules
 * registered via AddAttributedModules() are exposed through TurboModuleRegistry,
 * NOT through the legacy NativeModules bridge.
 */

import {TurboModuleRegistry} from 'react-native';

interface AppSettingsModuleInterface {
  setString(key: string, value: string): Promise<void>;
  getString(key: string): Promise<string>;
}

const AppSettings =
  TurboModuleRegistry.get<AppSettingsModuleInterface>('AppSettingsModule');

const API_KEY = 'deepseek_api_key';

export async function saveApiKey(key: string): Promise<void> {
  if (!AppSettings) {
    console.warn('[apiKeyStorage] AppSettingsModule not available via TurboModuleRegistry');
    return;
  }
  try {
    await AppSettings.setString(API_KEY, key.trim());
  } catch (e: any) {
    console.error('[apiKeyStorage] setString failed:', e?.message ?? String(e));
    throw e;
  }
}

export async function loadApiKey(): Promise<string> {
  if (!AppSettings) {
    console.warn('[apiKeyStorage] AppSettingsModule not available via TurboModuleRegistry');
    return '';
  }
  try {
    const value = await AppSettings.getString(API_KEY);
    return value ?? '';
  } catch (e: any) {
    console.error('[apiKeyStorage] getString failed:', e?.message ?? String(e));
    return '';
  }
}

export async function clearApiKey(): Promise<void> {
  if (!AppSettings) {return;}
  try {
    await AppSettings.setString(API_KEY, '');
  } catch {/* ignore */}
}
