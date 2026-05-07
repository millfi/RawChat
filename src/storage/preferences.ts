/**
 * Persisted user preferences (model selection, web-search toggle).
 *
 * Backed by the same C++ AppSettingsModule that stores the API key —
 * `setString` / `getString` against `LocalSettings`.
 */

import {TurboModule, TurboModuleRegistry} from 'react-native';
import {DEFAULT_MODEL, ModelId, MODELS} from '../api/deepseek';

interface AppSettingsModuleInterface extends TurboModule {
  setString(key: string, value: string): Promise<void>;
  getString(key: string): Promise<string>;
}

const AppSettings =
  TurboModuleRegistry.get<AppSettingsModuleInterface>('AppSettingsModule');

const KEY_MODEL = 'selected_model';
const KEY_WEB_SEARCH = 'web_search_enabled';

const VALID_MODEL_IDS = new Set<string>(MODELS.map(m => m.id));

// ── Model ─────────────────────────────────────────────────────────────

export async function loadSelectedModel(): Promise<ModelId> {
  if (!AppSettings) {return DEFAULT_MODEL;}
  try {
    const v = await AppSettings.getString(KEY_MODEL);
    if (v && VALID_MODEL_IDS.has(v)) {return v as ModelId;}
  } catch (e: any) {
    console.warn('[preferences] loadSelectedModel:', e?.message ?? e);
  }
  return DEFAULT_MODEL;
}

export async function saveSelectedModel(model: ModelId): Promise<void> {
  if (!AppSettings) {return;}
  try {
    await AppSettings.setString(KEY_MODEL, model);
  } catch (e: any) {
    console.warn('[preferences] saveSelectedModel:', e?.message ?? e);
  }
}

// ── Web search toggle ─────────────────────────────────────────────────

export async function loadWebSearchEnabled(): Promise<boolean> {
  if (!AppSettings) {return false;}
  try {
    const v = await AppSettings.getString(KEY_WEB_SEARCH);
    return v === 'true';
  } catch (e: any) {
    console.warn('[preferences] loadWebSearchEnabled:', e?.message ?? e);
    return false;
  }
}

export async function saveWebSearchEnabled(enabled: boolean): Promise<void> {
  if (!AppSettings) {return;}
  try {
    await AppSettings.setString(KEY_WEB_SEARCH, enabled ? 'true' : 'false');
  } catch (e: any) {
    console.warn('[preferences] saveWebSearchEnabled:', e?.message ?? e);
  }
}
