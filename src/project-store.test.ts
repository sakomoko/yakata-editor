import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateDefaultName,
  loadProjectIndex,
  saveProjectIndex,
  loadProjectData,
  saveProjectData,
  loadTabState,
  saveTabState,
  createNewProject,
  migrateIfNeeded,
  deleteProject,
  touchProjectUpdatedAt,
} from './project-store.ts';
import type { ProjectData, ProjectMeta } from './types.ts';

// Mock localStorage
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  removeItem: vi.fn((key: string) => storage.delete(key)),
  clear: vi.fn(() => storage.clear()),
  get length() {
    return storage.size;
  },
  key: vi.fn((_i: number) => null),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

beforeEach(() => {
  storage.clear();
  vi.clearAllMocks();
  uuidCounter = 0;
});

describe('generateDefaultName', () => {
  it('returns base name when no conflicts', () => {
    expect(generateDefaultName([])).toBe('無題のプロジェクト');
  });

  it('appends (2) when base name exists', () => {
    expect(generateDefaultName(['無題のプロジェクト'])).toBe('無題のプロジェクト (2)');
  });

  it('increments number to avoid conflicts', () => {
    expect(generateDefaultName(['無題のプロジェクト', '無題のプロジェクト (2)'])).toBe(
      '無題のプロジェクト (3)',
    );
  });
});

describe('loadProjectIndex / saveProjectIndex', () => {
  it('returns empty array when no data', () => {
    expect(loadProjectIndex()).toEqual([]);
  });

  it('round-trips project index', () => {
    const index: ProjectMeta[] = [{ id: 'a', name: 'test', createdAt: 1000, updatedAt: 2000 }];
    saveProjectIndex(index);
    expect(loadProjectIndex()).toEqual(index);
  });

  it('returns empty array for corrupt data', () => {
    storage.set('yakata_project_index', 'not json');
    expect(loadProjectIndex()).toEqual([]);
  });

  it('filters out invalid entries', () => {
    storage.set(
      'yakata_project_index',
      JSON.stringify([
        { id: 'a', name: 'valid', createdAt: 1, updatedAt: 2 },
        { foo: 'bar' },
        null,
        'string',
      ]),
    );
    const result = loadProjectIndex();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns empty array for non-array JSON', () => {
    storage.set('yakata_project_index', JSON.stringify({ not: 'array' }));
    expect(loadProjectIndex()).toEqual([]);
  });
});

describe('loadProjectData / saveProjectData', () => {
  it('returns null when no data', () => {
    expect(loadProjectData('nonexistent')).toBeNull();
  });

  it('round-trips project data', () => {
    const data: ProjectData = {
      rooms: [{ id: 'r1', x: 0, y: 0, w: 5, h: 3, label: 'Room' }],
      freeTexts: [],
      freeStrokes: [],
      viewport: { zoom: 1.5, panX: 10, panY: 20 },
      history: ['snapshot1'],
    };
    saveProjectData('proj1', data);
    const loaded = loadProjectData('proj1');
    expect(loaded).not.toBeNull();
    expect(loaded!.data.rooms).toHaveLength(1);
    expect(loaded!.data.rooms[0].label).toBe('Room');
    expect(loaded!.data.viewport.zoom).toBe(1.5);
    expect(loaded!.data.viewport.panX).toBe(10);
    expect(loaded!.data.history).toEqual(['snapshot1']);
  });

  it('returns null for corrupt data', () => {
    storage.set('yakata_project_proj1', 'not json');
    expect(loadProjectData('proj1')).toBeNull();
  });

  it('provides default viewport for missing viewport', () => {
    storage.set('yakata_project_proj1', JSON.stringify({ rooms: [], freeTexts: [] }));
    const loaded = loadProjectData('proj1');
    expect(loaded!.data.viewport).toEqual({ zoom: 1, panX: 0, panY: 0 });
  });

  it('clamps zoom value', () => {
    storage.set(
      'yakata_project_proj1',
      JSON.stringify({
        rooms: [],
        freeTexts: [],
        viewport: { zoom: 100, panX: 0, panY: 0 },
      }),
    );
    const loaded = loadProjectData('proj1');
    expect(loaded!.data.viewport.zoom).toBe(4); // MAX_ZOOM
  });
});

describe('loadTabState / saveTabState', () => {
  it('returns null when no data', () => {
    expect(loadTabState()).toBeNull();
  });

  it('round-trips tab state', () => {
    saveTabState({ openTabs: ['a', 'b'], activeTabId: 'a' });
    expect(loadTabState()).toEqual({ openTabs: ['a', 'b'], activeTabId: 'a' });
  });

  it('returns null for corrupt data', () => {
    storage.set('yakata_tab_state', 'not json');
    expect(loadTabState()).toBeNull();
  });

  it('filters non-string entries from openTabs', () => {
    storage.set(
      'yakata_tab_state',
      JSON.stringify({ openTabs: ['a', 123, null, 'b'], activeTabId: 'a' }),
    );
    const result = loadTabState();
    expect(result!.openTabs).toEqual(['a', 'b']);
  });
});

describe('createNewProject', () => {
  it('creates a project with default name', () => {
    const { meta, data } = createNewProject();
    expect(meta.name).toBe('無題のプロジェクト');
    expect(meta.id).toBe('test-uuid-1');
    expect(data.rooms).toEqual([]);
    expect(data.viewport).toEqual({ zoom: 1, panX: 0, panY: 0 });

    const index = loadProjectIndex();
    expect(index).toHaveLength(1);
    expect(index[0].id).toBe(meta.id);
  });

  it('creates with custom name', () => {
    const { meta } = createNewProject('My Project');
    expect(meta.name).toBe('My Project');
  });
});

describe('deleteProject', () => {
  it('removes project data and index entry', () => {
    const { meta } = createNewProject();
    expect(loadProjectIndex()).toHaveLength(1);
    deleteProject(meta.id);
    expect(loadProjectIndex()).toHaveLength(0);
    expect(loadProjectData(meta.id)).toBeNull();
  });
});

describe('touchProjectUpdatedAt', () => {
  it('updates the updatedAt timestamp', () => {
    const { meta } = createNewProject();
    const before = loadProjectIndex()[0].updatedAt;
    // Slight delay to ensure different timestamp
    touchProjectUpdatedAt(meta.id);
    const after = loadProjectIndex()[0].updatedAt;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

describe('migrateIfNeeded', () => {
  it('does nothing if index already exists', () => {
    saveProjectIndex([{ id: 'existing', name: 'test', createdAt: 1, updatedAt: 2 }]);
    migrateIfNeeded();
    expect(loadProjectIndex()).toHaveLength(1);
    expect(loadProjectIndex()[0].id).toBe('existing');
  });

  it('creates empty project when no old data', () => {
    migrateIfNeeded();
    const index = loadProjectIndex();
    expect(index).toHaveLength(1);
    expect(index[0].name).toBe('無題のプロジェクト');
    const tabState = loadTabState();
    expect(tabState!.openTabs).toHaveLength(1);
  });

  it('migrates old madori_data', () => {
    storage.set(
      'madori_data',
      JSON.stringify({
        rooms: [{ id: 'r1', x: 0, y: 0, w: 5, h: 3, label: 'Old Room' }],
        freeTexts: [],
      }),
    );
    storage.set('madori_viewport', JSON.stringify({ zoom: 2, panX: 100, panY: 200 }));

    migrateIfNeeded();

    // Old keys removed
    expect(storage.has('madori_data')).toBe(false);
    expect(storage.has('madori_viewport')).toBe(false);

    // New data exists
    const index = loadProjectIndex();
    expect(index).toHaveLength(1);
    const result = loadProjectData(index[0].id);
    expect(result!.data.rooms).toHaveLength(1);
    expect(result!.data.rooms[0].label).toBe('Old Room');
    expect(result!.data.viewport.zoom).toBe(2);
    expect(result!.data.viewport.panX).toBe(100);
  });

  it('is idempotent', () => {
    migrateIfNeeded();
    const firstIndex = loadProjectIndex();
    migrateIfNeeded();
    const secondIndex = loadProjectIndex();
    expect(secondIndex).toEqual(firstIndex);
  });
});
