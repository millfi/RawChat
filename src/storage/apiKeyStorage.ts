/**
 * API key storage backed by AppSettingsModule (C++ native module).
 *
 * RNW 0.82 runs in New Architecture mode (RnwNewArch=true), so native modules
 * registered via AddAttributedModules() are exposed through TurboModuleRegistry,
 * NOT through the legacy NativeModules bridge.
 */

import {TurboModule, TurboModuleRegistry} from 'react-native';

interface AppSettingsModuleInterface extends TurboModule {
  setString(key: string, value: string): Promise<void>;
  getString(key: string): Promise<string>;
}

const AppSettings =
  TurboModuleRegistry.get<AppSettingsModuleInterface>('AppSettingsModule');

const DEEPSEEK_KEY = 'deepseek_api_key';
const TAVILY_KEY = 'tavily_api_key';

// ── Generic helpers ────────────────────────────────────────────────────

async function setKey(slot: string, value: string): Promise<void> {
  if (!AppSettings) {
    console.warn('[apiKeyStorage] AppSettingsModule not available via TurboModuleRegistry');
    return;
  }
  try {
    await AppSettings.setString(slot, value.trim());
  } catch (e: any) {
    console.error(`[apiKeyStorage] setString(${slot}) failed:`, e?.message ?? String(e));
    throw e;
  }
}

async function getKey(slot: string): Promise<string> {
  if (!AppSettings) {
    console.warn('[apiKeyStorage] AppSettingsModule not available via TurboModuleRegistry');
    return '';
  }
  try {
    const value = await AppSettings.getString(slot);
    return value ?? '';
  } catch (e: any) {
    console.error(`[apiKeyStorage] getString(${slot}) failed:`, e?.message ?? String(e));
    return '';
  }
}

// ── DeepSeek (the chat model) ──────────────────────────────────────────

export const saveApiKey = (key: string) => setKey(DEEPSEEK_KEY, key);
export const loadApiKey = () => getKey(DEEPSEEK_KEY);
export const clearApiKey = () => setKey(DEEPSEEK_KEY, '');

// ── Tavily (the web-search backend) ────────────────────────────────────

export const saveTavilyKey = (key: string) => setKey(TAVILY_KEY, key);
export const loadTavilyKey = () => getKey(TAVILY_KEY);
export const clearTavilyKey = () => setKey(TAVILY_KEY, '');
