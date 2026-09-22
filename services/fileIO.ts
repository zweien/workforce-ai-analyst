// File save/open helpers with dual runtime paths:
// - Tauri app: native save/open dialogs (tauri-plugin-dialog) + fs plugin writes.
//   Paths picked through the dialog are auto-allowed in the fs scope.
// - Browser dev: classic blob downloads / <input type=file>.
import { isTauri } from "./settings";

// Re-export so UI components have a single import site for runtime detection.
export { isTauri };

export const EXCEL_FILTERS = [{ name: 'Excel', extensions: ['xlsx', 'xls'] }];

export const saveTextFile = async (fileName: string, content: string): Promise<boolean> => {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const path = await save({ defaultPath: fileName });
    if (!path) return false;
    await writeTextFile(path, content);
    return true;
  }
  triggerBlobDownload(fileName, new Blob([content], { type: 'text/markdown;charset=utf-8;' }));
  return true;
};

export const saveBinaryFile = async (fileName: string, data: Uint8Array): Promise<boolean> => {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const path = await save({ defaultPath: fileName });
    if (!path) return false;
    await writeFile(path, data);
    return true;
  }
  triggerBlobDownload(fileName, new Blob([data.buffer as ArrayBuffer]));
  return true;
};

const triggerBlobDownload = (fileName: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export interface PickedFile {
  name: string;
  data: ArrayBuffer;
}

export interface PickedFileWithPath extends PickedFile {
  path: string;
}

/** Native multi-select for Excel files. Returns null when cancelled. */
export const openExcelFiles = async (): Promise<PickedFileWithPath[] | null> => {
  if (!isTauri()) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readFile } = await import('@tauri-apps/plugin-fs');
  const picked = await open({ multiple: true, filters: EXCEL_FILTERS });
  if (!picked) return null;
  const paths = Array.isArray(picked) ? picked : [picked];
  const files: PickedFileWithPath[] = [];
  for (const path of paths) {
    const data = await readFile(path);
    files.push({ path, name: path.split(/[\\/]/).pop() ?? path, data: data.buffer as ArrayBuffer });
  }
  return files;
};

// --- Recent files (Tauri only; paths are meaningless in the browser) ---

export interface RecentFile {
  path: string;
  name: string;
}

const LS_RECENT = 'wf-recent-files';

export const getRecentFiles = (): RecentFile[] => {
  if (!isTauri()) return [];
  try {
    return JSON.parse(localStorage.getItem(LS_RECENT) ?? '[]');
  } catch {
    return [];
  }
};

export const addRecentFiles = (paths: string[]) => {
  if (!isTauri() || paths.length === 0) return;
  const existing = getRecentFiles().filter(f => !paths.includes(f.path));
  const added: RecentFile[] = paths.map(p => ({ path: p, name: p.split(/[\\/]/).pop() ?? p }));
  localStorage.setItem(LS_RECENT, JSON.stringify([...added, ...existing].slice(0, 8)));
};

export const clearRecentFiles = () => localStorage.removeItem(LS_RECENT);

/** Re-read a previously picked file. May fail after restart if outside scoped dirs. */
export const readRecentFile = async (path: string): Promise<PickedFile> => {
  const { readFile } = await import('@tauri-apps/plugin-fs');
  const data = await readFile(path);
  return { name: path.split(/[\\/]/).pop() ?? path, data: data.buffer as ArrayBuffer };
};
