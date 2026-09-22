// LLM settings (non-secret) + API key storage abstraction.
// In the Tauri app the key goes to the OS credential store via Rust commands
// (Windows Credential Manager / macOS Keychain); in plain-browser dev mode it
// falls back to localStorage, which is fine for development only.

export interface LlmSettings {
  baseUrl: string;
  model: string;
  anonymize: boolean;
}

export const DEFAULT_SETTINGS: LlmSettings = {
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  anonymize: true,
};

const LS_SETTINGS = 'wf-llm-settings';
const LS_KEY_FALLBACK = 'wf-llm-api-key';

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const getSettings = (): LlmSettings => {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* corrupted settings fall back to defaults */ }
  return { ...DEFAULT_SETTINGS };
};

export const saveSettings = (s: LlmSettings) => {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
};

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export const getApiKey = async (): Promise<string> => {
  if (isTauri()) {
    const stored = await invoke<string | null>('load_secret');
    return stored ?? '';
  }
  return localStorage.getItem(LS_KEY_FALLBACK) ?? '';
};

export const saveApiKey = async (key: string): Promise<void> => {
  if (isTauri()) {
    await invoke('save_secret', { secret: key });
  } else {
    localStorage.setItem(LS_KEY_FALLBACK, key);
  }
};

export const deleteApiKey = async (): Promise<void> => {
  if (isTauri()) {
    await invoke('delete_secret');
  } else {
    localStorage.removeItem(LS_KEY_FALLBACK);
  }
};

export const hasApiKey = async (): Promise<boolean> => (await getApiKey()).length > 0;
