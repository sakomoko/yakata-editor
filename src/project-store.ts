import type { ProjectMeta, ProjectData, TabState } from './types.ts';
import type { ViewportState } from './viewport.ts';
import { parseStorageData } from './persistence.ts';
import {
  parseViewport,
  deduplicateName,
  generateDefaultName,
  isValidProjectMeta,
} from './shared/project-utils.ts';

const INDEX_KEY = 'yakata_project_index';
const PROJECT_KEY_PREFIX = 'yakata_project_';
const TAB_STATE_KEY = 'yakata_tab_state';
const OLD_STORAGE_KEY = 'madori_data';
const OLD_VIEWPORT_KEY = 'madori_viewport';

// --- Index ---

export function loadProjectIndex(): ProjectMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidProjectMeta);
  } catch {
    return [];
  }
}

export function saveProjectIndex(index: ProjectMeta[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // storage full or unavailable
  }
  syncIndexToServer(index);
}

// --- Project Data ---

export interface LoadProjectResult {
  data: ProjectData;
  warning?: string;
}

export function loadProjectData(id: string): LoadProjectResult | null {
  try {
    const raw = localStorage.getItem(PROJECT_KEY_PREFIX + id);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;

    const storageData = parseStorageData({
      rooms: obj.rooms,
      freeTexts: obj.freeTexts,
      freeStrokes: obj.freeStrokes,
    });
    const viewport = parseViewport(obj.viewport);
    const history: string[] = Array.isArray(obj.history)
      ? (obj.history as unknown[]).filter((h): h is string => typeof h === 'string')
      : [];

    return {
      data: {
        rooms: storageData.rooms,
        freeTexts: storageData.freeTexts,
        freeStrokes: storageData.freeStrokes,
        viewport,
        history,
      },
      warning: storageData.warning,
    };
  } catch {
    return null;
  }
}

// --- Dev-mode server sync ---

function syncToServer(id: string, data: ProjectData): void {
  if (!import.meta.env.DEV) return;
  fetch(`/api/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {
    // fire-and-forget
  });
}

function syncIndexToServer(index: ProjectMeta[]): void {
  if (!import.meta.env.DEV) return;
  fetch('/api/projects', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(index),
  }).catch(() => {
    // fire-and-forget
  });
}

/** 起動時にlocalStorageの全プロジェクトをサーバーへ送り、サーバー側の新規プロジェクトも取得する。
 *  updatedAt を比較し、ローカル側がサーバーより新しいプロジェクトのみ送信する。 */
export async function syncWithServer(): Promise<void> {
  if (!import.meta.env.DEV) return;
  const index = loadProjectIndex();

  // まずサーバーのindexを取得して updatedAt を比較
  let serverIndex: ProjectMeta[] = [];
  try {
    const res = await fetch('/api/projects');
    if (res.ok) {
      const json: unknown[] = await res.json();
      serverIndex = json.filter(isValidProjectMeta);
    }
  } catch {
    // サーバー未起動の場合は同期をスキップ
    return;
  }
  const serverMap = new Map(serverIndex.map((m) => [m.id, m]));

  // localStorage → サーバー（updatedAtが新しいもののみ）
  // 各プロジェクトについて、updatedAt が新しいほうの meta を採用してマージ
  const localMap = new Map(index.map((m) => [m.id, m]));
  const mergedIndex: ProjectMeta[] = [];

  // サーバー側のプロジェクトをベースに、ローカルのほうが新しければローカルを採用
  for (const serverMeta of serverIndex) {
    const localMeta = localMap.get(serverMeta.id);
    if (!localMeta) {
      mergedIndex.push(serverMeta);
    } else {
      // updatedAt が新しいほうを採用
      mergedIndex.push(
        (localMeta.updatedAt ?? 0) >= (serverMeta.updatedAt ?? 0) ? localMeta : serverMeta,
      );
    }
  }
  // ローカルにしかないプロジェクトを追加
  for (const localMeta of index) {
    if (!serverMap.has(localMeta.id)) {
      mergedIndex.push(localMeta);
    }
  }
  const puts: Promise<unknown>[] = [
    fetch('/api/projects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mergedIndex),
    }),
  ];
  for (const meta of index) {
    const serverMeta = serverMap.get(meta.id);
    // サーバーに存在し、ローカルのupdatedAtがサーバー以下ならスキップ
    if (serverMeta && (meta.updatedAt ?? 0) <= (serverMeta.updatedAt ?? 0)) continue;

    const result = loadProjectData(meta.id);
    if (result) {
      puts.push(
        fetch(`/api/projects/${meta.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result.data),
        }),
      );
    }
  }
  await Promise.allSettled(puts);
  // サーバー → localStorage（サーバー側の最新データを取り込む）
  // ※ mergedIndex は syncFromServer の前に localStorage へ保存しない。
  //    先に保存するとサーバー専用プロジェクトが syncFromServer で「既存」扱いになり
  //    データ本体が取得されない。mergedIndex はサーバーに PUT 済みなので、
  //    syncFromServer が正しくローカルへ反映する。
  await syncFromServer();
}

async function syncFromServer(): Promise<void> {
  if (!import.meta.env.DEV) return;
  try {
    const res = await fetch('/api/projects');
    if (!res.ok) return;
    const serverIndex = ((await res.json()) as unknown[]).filter(isValidProjectMeta);
    const localIndex = loadProjectIndex();
    const localMap = new Map(localIndex.map((m) => [m.id, m]));

    // サーバーにしかないプロジェクト（新規）
    const newMetas = serverIndex.filter((m) => !localMap.has(m.id));
    // サーバー側のほうが新しいプロジェクト（更新）
    const updatedMetas = serverIndex.filter((m) => {
      const local = localMap.get(m.id);
      return local && (m.updatedAt ?? 0) > (local.updatedAt ?? 0);
    });

    // 新規 + 更新のデータを一括取得
    const fetchTargets = [...newMetas, ...updatedMetas];
    const results = await Promise.all(
      fetchTargets.map(async (meta) => {
        try {
          const dataRes = await fetch(`/api/projects/${meta.id}`);
          if (!dataRes.ok) return null;
          const { data } = (await dataRes.json()) as { meta: ProjectMeta; data: ProjectData };
          return { meta, data, isNew: !localMap.has(meta.id) };
        } catch {
          return null;
        }
      }),
    );
    for (const result of results) {
      if (!result) continue;
      if (result.isNew) {
        localIndex.push(result.meta);
      } else {
        // 既存プロジェクトのメタデータを全体上書き（name等の変更も反映）
        const idx = localIndex.findIndex((m) => m.id === result.meta.id);
        if (idx !== -1) {
          localIndex[idx] = result.meta;
        }
      }
      try {
        localStorage.setItem(PROJECT_KEY_PREFIX + result.meta.id, JSON.stringify(result.data));
      } catch {
        // storage full
      }
    }
    // indexもlocalStorageのみに保存
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify(localIndex));
    } catch {
      // storage full
    }
  } catch {
    // server not available
  }
}

/** プロジェクトデータのみ保存（updatedAt は更新しない） */
export function saveProjectData(id: string, data: ProjectData): void {
  try {
    localStorage.setItem(PROJECT_KEY_PREFIX + id, JSON.stringify(data));
  } catch {
    // storage full or unavailable
  }
  syncToServer(id, data);
}

/** updatedAt を現在時刻に更新して index を保存 */
export function touchProjectUpdatedAt(id: string): void {
  const index = loadProjectIndex();
  const meta = index.find((m) => m.id === id);
  if (meta) {
    meta.updatedAt = Date.now();
    saveProjectIndex(index);
  }
}

export function deleteProject(id: string): void {
  localStorage.removeItem(PROJECT_KEY_PREFIX + id);
  const index = loadProjectIndex().filter((m) => m.id !== id);
  saveProjectIndex(index);
}

// --- Tab State ---

export function loadTabState(): TabState | null {
  try {
    const raw = localStorage.getItem(TAB_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (Array.isArray(parsed.openTabs) && typeof parsed.activeTabId === 'string') {
      const openTabs = (parsed.openTabs as unknown[]).filter(
        (t): t is string => typeof t === 'string',
      );
      return { openTabs, activeTabId: parsed.activeTabId };
    }
  } catch {
    // corrupt
  }
  return null;
}

export function saveTabState(tabState: TabState): void {
  try {
    localStorage.setItem(TAB_STATE_KEY, JSON.stringify(tabState));
  } catch {
    // storage full or unavailable
  }
}

// Re-export shared utilities for backward compatibility
export { deduplicateName, generateDefaultName } from './shared/project-utils.ts';

// --- Register (shared create logic) ---

/** プロジェクトを新IDで登録し、indexとdataをlocalStorageに保存する */
function registerProject(
  name: string,
  data: ProjectData,
): { meta: ProjectMeta; data: ProjectData } {
  const now = Date.now();
  const id = crypto.randomUUID();
  const meta: ProjectMeta = { id, name, createdAt: now, updatedAt: now };

  const index = loadProjectIndex();
  index.push(meta);
  saveProjectIndex(index);
  saveProjectData(id, data);

  return { meta, data };
}

// --- New Project ---

export function createNewProject(name?: string): { meta: ProjectMeta; data: ProjectData } {
  const existingNames = loadProjectIndex().map((m) => m.name);
  const projectName = name ?? generateDefaultName(existingNames);
  return registerProject(projectName, {
    rooms: [],
    freeTexts: [],
    freeStrokes: [],
    viewport: { zoom: 1, panX: 0, panY: 0 },
    history: [],
  });
}

// --- Duplicate Project ---

export function duplicateProject(
  sourceId: string,
): { meta: ProjectMeta; data: ProjectData } | null {
  const result = loadProjectData(sourceId);
  if (!result) return null;

  const index = loadProjectIndex();
  const sourceMeta = index.find((m) => m.id === sourceId);
  const existingNames = index.map((m) => m.name);
  const baseName = sourceMeta ? `${sourceMeta.name} のコピー` : '無題のプロジェクト';
  const projectName = deduplicateName(baseName, existingNames);

  // Deep copy data, then clear history for the new project
  const clonedData: ProjectData = structuredClone(result.data);
  clonedData.history = [];

  return registerProject(projectName, clonedData);
}

// --- Migration ---

export function migrateIfNeeded(): void {
  if (localStorage.getItem(INDEX_KEY)) return;

  const oldData = localStorage.getItem(OLD_STORAGE_KEY);
  const now = Date.now();
  const id = crypto.randomUUID();

  if (oldData) {
    try {
      const parsed: unknown = JSON.parse(oldData);
      const storageData = parseStorageData(parsed);

      let viewport: ViewportState = { zoom: 1, panX: 0, panY: 0 };
      const oldVpRaw = localStorage.getItem(OLD_VIEWPORT_KEY);
      if (oldVpRaw) {
        try {
          viewport = parseViewport(JSON.parse(oldVpRaw));
        } catch {
          // ignore
        }
      }

      const meta: ProjectMeta = {
        id,
        name: '無題のプロジェクト',
        createdAt: now,
        updatedAt: now,
      };
      const data: ProjectData = {
        rooms: storageData.rooms,
        freeTexts: storageData.freeTexts,
        freeStrokes: storageData.freeStrokes,
        viewport,
        history: [],
      };

      saveProjectIndex([meta]);
      saveProjectData(id, data);
      saveTabState({ openTabs: [id], activeTabId: id });

      localStorage.removeItem(OLD_STORAGE_KEY);
      localStorage.removeItem(OLD_VIEWPORT_KEY);
    } catch {
      createEmptyInitialProject();
    }
  } else {
    createEmptyInitialProject();
  }
}

function createEmptyInitialProject(): void {
  const { meta } = createNewProject();
  saveTabState({ openTabs: [meta.id], activeTabId: meta.id });
}
