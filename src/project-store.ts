import type { ProjectMeta, ProjectData, TabState } from './types.ts';
import { parseStorageData } from './persistence.ts';
import type { ViewportState } from './viewport.ts';
import { clampZoom } from './viewport.ts';

const INDEX_KEY = 'yakata_project_index';
const PROJECT_KEY_PREFIX = 'yakata_project_';
const TAB_STATE_KEY = 'yakata_tab_state';
const OLD_STORAGE_KEY = 'madori_data';
const OLD_VIEWPORT_KEY = 'madori_viewport';

// --- Viewport validation (shared) ---

function parseViewport(raw: unknown): ViewportState {
  const fallback: ViewportState = { zoom: 1, panX: 0, panY: 0 };
  if (!raw || typeof raw !== 'object') return fallback;
  const vp = raw as Record<string, unknown>;
  if (
    typeof vp.zoom === 'number' &&
    typeof vp.panX === 'number' &&
    typeof vp.panY === 'number' &&
    Number.isFinite(vp.panX) &&
    Number.isFinite(vp.panY)
  ) {
    return { zoom: clampZoom(vp.zoom), panX: vp.panX, panY: vp.panY };
  }
  return fallback;
}

// --- Index ---

export function loadProjectIndex(): ProjectMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProjectMeta[];
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
}

// --- Project Data ---

export function loadProjectData(id: string): ProjectData | null {
  try {
    const raw = localStorage.getItem(PROJECT_KEY_PREFIX + id);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;

    const storageData = parseStorageData({ rooms: obj.rooms, freeTexts: obj.freeTexts });
    const viewport = parseViewport(obj.viewport);
    const history: string[] = Array.isArray(obj.history)
      ? (obj.history as unknown[]).filter((h): h is string => typeof h === 'string')
      : [];

    return {
      rooms: storageData.rooms,
      freeTexts: storageData.freeTexts,
      viewport,
      history,
    };
  } catch {
    return null;
  }
}

/** プロジェクトデータのみ保存（updatedAt は更新しない） */
export function saveProjectData(id: string, data: ProjectData): void {
  try {
    localStorage.setItem(PROJECT_KEY_PREFIX + id, JSON.stringify(data));
  } catch {
    // storage full or unavailable
  }
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

// --- Name generation ---

export function generateDefaultName(existingNames: string[]): string {
  const base = '無題のプロジェクト';
  if (!existingNames.includes(base)) return base;
  let n = 2;
  while (existingNames.includes(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}

// --- New Project ---

export function createNewProject(name?: string): { meta: ProjectMeta; data: ProjectData } {
  const index = loadProjectIndex();
  const existingNames = index.map((m) => m.name);
  const projectName = name ?? generateDefaultName(existingNames);
  const now = Date.now();
  const id = crypto.randomUUID();
  const meta: ProjectMeta = { id, name: projectName, createdAt: now, updatedAt: now };
  const data: ProjectData = {
    rooms: [],
    freeTexts: [],
    viewport: { zoom: 1, panX: 0, panY: 0 },
    history: [],
  };

  index.push(meta);
  saveProjectIndex(index);
  saveProjectData(id, data);

  return { meta, data };
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
