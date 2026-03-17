import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateDefaultName,
  deduplicateName,
  loadProjectIndex,
  saveProjectIndex,
  loadProjectData,
  saveProjectData,
  loadTabState,
  saveTabState,
  createNewProject,
  duplicateProject,
  migrateIfNeeded,
  deleteProject,
  touchProjectUpdatedAt,
  syncWithServer,
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

describe('duplicateProject', () => {
  it('returns null for non-existent source id', () => {
    expect(duplicateProject('non-existent-id')).toBeNull();
  });

  it('duplicates project data matching the original', () => {
    const { meta } = createNewProject('Original');
    const data: ProjectData = {
      rooms: [{ id: 'r1', x: 0, y: 0, w: 5, h: 3, label: 'Room' }],
      freeTexts: [],
      freeStrokes: [],
      viewport: { zoom: 1.5, panX: 10, panY: 20 },
      history: ['snapshot1'],
    };
    saveProjectData(meta.id, data);

    const result = duplicateProject(meta.id);
    expect(result).not.toBeNull();
    expect(result!.data.rooms).toHaveLength(1);
    expect(result!.data.rooms[0].label).toBe('Room');
    expect(result!.data.viewport).toEqual({ zoom: 1.5, panX: 10, panY: 20 });
  });

  it('names the copy with のコピー suffix', () => {
    const { meta } = createNewProject('My Project');
    saveProjectData(meta.id, {
      rooms: [],
      freeTexts: [],
      freeStrokes: [],
      viewport: { zoom: 1, panX: 0, panY: 0 },
      history: [],
    });

    const result = duplicateProject(meta.id);
    expect(result!.meta.name).toBe('My Project のコピー');
  });

  it('appends number when duplicate name already exists', () => {
    const { meta: orig } = createNewProject('My Project');
    saveProjectData(orig.id, {
      rooms: [],
      freeTexts: [],
      freeStrokes: [],
      viewport: { zoom: 1, panX: 0, panY: 0 },
      history: [],
    });

    // First copy
    const first = duplicateProject(orig.id);
    expect(first!.meta.name).toBe('My Project のコピー');

    // Second copy - name 'My Project のコピー' already exists
    const second = duplicateProject(orig.id);
    expect(second!.meta.name).toBe('My Project のコピー (2)');
  });

  it('clears history in the duplicated project', () => {
    const { meta } = createNewProject('With History');
    saveProjectData(meta.id, {
      rooms: [],
      freeTexts: [],
      freeStrokes: [],
      viewport: { zoom: 1, panX: 0, panY: 0 },
      history: ['snap1', 'snap2', 'snap3'],
    });

    const result = duplicateProject(meta.id);
    expect(result!.data.history).toEqual([]);
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

describe('deduplicateName (re-exported)', () => {
  it('returns baseName if not in existingNames', () => {
    expect(deduplicateName('テスト', [])).toBe('テスト');
  });

  it('appends (2) when baseName exists', () => {
    expect(deduplicateName('テスト', ['テスト'])).toBe('テスト (2)');
  });
});

describe('syncWithServer', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  // Default fetch response for fire-and-forget calls (syncToServer, syncIndexToServer)
  const defaultFetchResponse = { ok: true, json: () => Promise.resolve([]) };

  beforeEach(() => {
    storage.clear();
    // Use mockImplementation that always returns a resolved promise by default,
    // so fire-and-forget fetch calls (from saveProjectIndex/saveProjectData) don't break.
    fetchMock = vi.fn().mockResolvedValue(defaultFetchResponse);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips syncing projects with older updatedAt than server', async () => {
    // Setup local project with updatedAt = 1000
    const meta: ProjectMeta = { id: 'p1', name: 'テスト', createdAt: 1000, updatedAt: 1000 };
    saveProjectIndex([meta]);
    saveProjectData('p1', {
      rooms: [],
      freeTexts: [],
      freeStrokes: [],
      viewport: { zoom: 1, panX: 0, panY: 0 },
      history: [],
    });

    // Reset mock call history after setup (setup triggers fire-and-forget syncs)
    fetchMock.mockClear();

    // Server has newer updatedAt = 2000
    const serverIndex: ProjectMeta[] = [
      { id: 'p1', name: 'テスト', createdAt: 1000, updatedAt: 2000 },
    ];

    // All calls now return the default, but configure specific responses:
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === 'string' && url === '/api/projects') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(serverIndex),
        });
      }
      return Promise.resolve({ ok: true });
    });

    await syncWithServer();

    // Should NOT have PUT /api/projects/p1 since server is newer
    const putProjectCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) =>
        typeof call[0] === 'string' &&
        (call[0] as string).includes('/api/projects/p1') &&
        (call[1] as RequestInit | undefined)?.method === 'PUT',
    );
    expect(putProjectCalls).toHaveLength(0);
  });

  it('syncs projects with newer updatedAt than server', async () => {
    // Setup local project with updatedAt = 3000 (newer)
    const meta: ProjectMeta = { id: 'p2', name: 'テスト2', createdAt: 1000, updatedAt: 3000 };
    saveProjectIndex([meta]);
    saveProjectData('p2', {
      rooms: [],
      freeTexts: [],
      freeStrokes: [],
      viewport: { zoom: 1, panX: 0, panY: 0 },
      history: [],
    });

    fetchMock.mockClear();

    const serverIndex: ProjectMeta[] = [
      { id: 'p2', name: 'テスト2', createdAt: 1000, updatedAt: 1000 },
    ];

    fetchMock.mockImplementation((url: string) => {
      if (typeof url === 'string' && url === '/api/projects') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(serverIndex),
        });
      }
      return Promise.resolve({ ok: true });
    });

    await syncWithServer();

    // Should have PUT /api/projects/p2 since local is newer
    const putProjectCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) =>
        typeof call[0] === 'string' &&
        (call[0] as string).includes('/api/projects/p2') &&
        (call[1] as RequestInit | undefined)?.method === 'PUT',
    );
    expect(putProjectCalls).toHaveLength(1);
  });

  it('syncs new local projects not on server', async () => {
    // Setup local project that doesn't exist on server
    const meta: ProjectMeta = { id: 'new-id', name: '新規', createdAt: 1000, updatedAt: 1000 };
    saveProjectIndex([meta]);
    saveProjectData('new-id', {
      rooms: [],
      freeTexts: [],
      freeStrokes: [],
      viewport: { zoom: 1, panX: 0, panY: 0 },
      history: [],
    });

    fetchMock.mockClear();

    fetchMock.mockImplementation((url: string) => {
      if (typeof url === 'string' && url === '/api/projects') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({ ok: true });
    });

    await syncWithServer();

    // Should PUT the new project data
    const putProjectCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) =>
        typeof call[0] === 'string' &&
        (call[0] as string).includes('/api/projects/new-id') &&
        (call[1] as RequestInit | undefined)?.method === 'PUT',
    );
    expect(putProjectCalls).toHaveLength(1);
  });
});
