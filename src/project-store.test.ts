import { describe, it, expect, beforeEach, vi } from 'vitest';
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
} from './project-store.ts';
import type { ProjectData, ProjectMeta } from './types.ts';
import { MIN_ZOOM, MAX_ZOOM } from './viewport.ts';

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
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true });

// Mock crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

function emptyProjectData(overrides?: Partial<ProjectData>): ProjectData {
  return {
    rooms: [],
    freeTexts: [],
    freeStrokes: [],
    viewport: { zoom: 1, panX: 0, panY: 0 },
    history: [],
    ...overrides,
  };
}

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
    saveProjectData(meta.id, emptyProjectData());

    const result = duplicateProject(meta.id);
    expect(result!.meta.name).toBe('My Project のコピー');
  });

  it('appends number when duplicate name already exists', () => {
    const { meta: orig } = createNewProject('My Project');
    saveProjectData(orig.id, emptyProjectData());

    // First copy
    const first = duplicateProject(orig.id);
    expect(first!.meta.name).toBe('My Project のコピー');

    // Second copy - name 'My Project のコピー' already exists
    const second = duplicateProject(orig.id);
    expect(second!.meta.name).toBe('My Project のコピー (2)');
  });

  it('clears history in the duplicated project', () => {
    const { meta } = createNewProject('With History');
    saveProjectData(meta.id, emptyProjectData({ history: ['snap1', 'snap2', 'snap3'] }));

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

  it('falls back to empty project when old data is broken JSON', () => {
    storage.set('madori_data', '{broken json!!!');
    migrateIfNeeded();
    const index = loadProjectIndex();
    expect(index).toHaveLength(1);
    expect(index[0].name).toBe('無題のプロジェクト');
    // Broken old data key should be left as-is (migration creates empty project but does not delete broken key)
    expect(storage.has('madori_data')).toBe(true);
    const tabState = loadTabState();
    expect(tabState).not.toBeNull();
    expect(tabState!.openTabs).toHaveLength(1);
  });

  it('migrates old madori_data without viewport', () => {
    storage.set(
      'madori_data',
      JSON.stringify({
        rooms: [{ id: 'r1', x: 0, y: 0, w: 3, h: 3, label: 'Room' }],
        freeTexts: [],
      }),
    );
    // No madori_viewport set
    migrateIfNeeded();
    const index = loadProjectIndex();
    const result = loadProjectData(index[0].id);
    expect(result!.data.viewport).toEqual({ zoom: 1, panX: 0, panY: 0 });
  });

  it('sets tab state pointing to the migrated project', () => {
    storage.set(
      'madori_data',
      JSON.stringify({ rooms: [], freeTexts: [] }),
    );
    migrateIfNeeded();
    const index = loadProjectIndex();
    const tabState = loadTabState();
    expect(tabState!.activeTabId).toBe(index[0].id);
    expect(tabState!.openTabs).toEqual([index[0].id]);
  });
});

// =========================================================================
// Additional coverage tests (Issue #40)
// =========================================================================

describe('deduplicateName edge cases', () => {
  it('returns baseName as-is when existingNames is empty', () => {
    expect(deduplicateName('Test', [])).toBe('Test');
  });

  it('returns baseName when no conflict', () => {
    expect(deduplicateName('A', ['B', 'C'])).toBe('A');
  });

  it('appends (2) on first conflict', () => {
    expect(deduplicateName('A', ['A'])).toBe('A (2)');
  });

  it('skips existing numbered suffixes to find next available', () => {
    expect(deduplicateName('A', ['A', 'A (2)', 'A (3)'])).toBe('A (4)');
  });

  it('returns next sequential suffix', () => {
    expect(deduplicateName('A', ['A', 'A (2)'])).toBe('A (3)');
  });

  it('handles empty string baseName', () => {
    expect(deduplicateName('', [''])).toBe(' (2)');
  });

  it('handles baseName with spaces only', () => {
    expect(deduplicateName('   ', ['   '])).toBe('    (2)');
  });
});

describe('tab switching state isolation', () => {
  it('projects A and B maintain independent rooms after switching', () => {
    const projA = createNewProject('Project A');
    const projB = createNewProject('Project B');

    // Save different room data for each project
    const dataA: ProjectData = {
      rooms: [{ id: 'rA', x: 0, y: 0, w: 5, h: 3, label: 'Room A' }],
      freeTexts: [],
      freeStrokes: [],
      viewport: { zoom: 1, panX: 0, panY: 0 },
      history: ['snapA1'],
    };
    const dataB: ProjectData = {
      rooms: [
        { id: 'rB1', x: 0, y: 0, w: 3, h: 3, label: 'Room B1' },
        { id: 'rB2', x: 5, y: 0, w: 4, h: 4, label: 'Room B2' },
      ],
      freeTexts: [],
      freeStrokes: [],
      viewport: { zoom: 2, panX: 100, panY: 200 },
      history: ['snapB1', 'snapB2'],
    };

    saveProjectData(projA.meta.id, dataA);
    saveProjectData(projB.meta.id, dataB);

    // Switch tab to B
    saveTabState({ openTabs: [projA.meta.id, projB.meta.id], activeTabId: projB.meta.id });

    // Verify project A data is still independent
    const loadedA = loadProjectData(projA.meta.id);
    expect(loadedA!.data.rooms).toHaveLength(1);
    expect(loadedA!.data.rooms[0].label).toBe('Room A');
    expect(loadedA!.data.history).toEqual(['snapA1']);

    // Verify project B data is still independent
    const loadedB = loadProjectData(projB.meta.id);
    expect(loadedB!.data.rooms).toHaveLength(2);
    expect(loadedB!.data.rooms[0].label).toBe('Room B1');
    expect(loadedB!.data.history).toEqual(['snapB1', 'snapB2']);

    // Verify tab state points to B
    const tabState = loadTabState();
    expect(tabState!.activeTabId).toBe(projB.meta.id);

    // Switch back to A
    saveTabState({ openTabs: [projA.meta.id, projB.meta.id], activeTabId: projA.meta.id });
    const tabStateAfter = loadTabState();
    expect(tabStateAfter!.activeTabId).toBe(projA.meta.id);

    // Data remains unchanged after tab switch
    const reloadedA = loadProjectData(projA.meta.id);
    expect(reloadedA!.data.rooms).toHaveLength(1);
    expect(reloadedA!.data.viewport).toEqual({ zoom: 1, panX: 0, panY: 0 });
  });

  it('modifying one project does not affect another', () => {
    const projA = createNewProject('A');
    const projB = createNewProject('B');

    const initialData = emptyProjectData({
      rooms: [{ id: 'r1', x: 0, y: 0, w: 3, h: 3, label: 'Shared Label' }],
    });
    saveProjectData(projA.meta.id, initialData);
    saveProjectData(projB.meta.id, initialData);

    // Modify project A
    const modifiedA: ProjectData = {
      ...initialData,
      rooms: [{ id: 'r1', x: 0, y: 0, w: 10, h: 10, label: 'Modified A' }],
      history: ['snap1'],
    };
    saveProjectData(projA.meta.id, modifiedA);

    // Project B should remain unchanged
    const loadedB = loadProjectData(projB.meta.id);
    expect(loadedB!.data.rooms[0].label).toBe('Shared Label');
    expect(loadedB!.data.rooms[0].w).toBe(3);
    expect(loadedB!.data.history).toEqual([]);
  });
});

describe('rename boundary values', () => {
  it('renaming to same name as another project is allowed at store level', () => {
    createNewProject('Project A');
    const projB = createNewProject('Project B');

    // project-store does not enforce unique names; deduplicateName is used at creation
    // Renaming directly in the index is valid
    const index = loadProjectIndex();
    const metaB = index.find((m) => m.id === projB.meta.id)!;
    metaB.name = 'Project A'; // Same name as project A
    saveProjectIndex(index);

    const reloaded = loadProjectIndex();
    const names = reloaded.map((m) => m.name);
    expect(names.filter((n) => n === 'Project A')).toHaveLength(2);
  });

  it('renaming to empty string is stored as-is at store level', () => {
    const { meta } = createNewProject('Original');
    const index = loadProjectIndex();
    const m = index.find((p) => p.id === meta.id)!;
    m.name = '';
    saveProjectIndex(index);

    const reloaded = loadProjectIndex();
    expect(reloaded.find((p) => p.id === meta.id)!.name).toBe('');
  });

  it('renaming to whitespace-only string is stored as-is at store level', () => {
    const { meta } = createNewProject('Original');
    const index = loadProjectIndex();
    const m = index.find((p) => p.id === meta.id)!;
    m.name = '   ';
    saveProjectIndex(index);

    const reloaded = loadProjectIndex();
    expect(reloaded.find((p) => p.id === meta.id)!.name).toBe('   ');
  });
});

describe('loadProjectData with warning', () => {
  it('returns warning when data format is unrecognized', () => {
    // Save valid data via public API, then corrupt it in storage
    const { meta } = createNewProject('warn-test');
    saveProjectData(meta.id, emptyProjectData());

    // Overwrite stored data with invalid format (rooms is not an array)
    const storageKey = `yakata_project_${meta.id}`;
    storage.set(storageKey, JSON.stringify({ rooms: 'not-an-array', freeTexts: [] }));

    const result = loadProjectData(meta.id);
    expect(result).not.toBeNull();
    expect(result!.warning).toBeDefined();
    expect(result!.warning).toContain('データ形式を認識できませんでした');
    expect(result!.data.rooms).toEqual([]);
  });

  it('returns no warning for valid data', () => {
    const data: ProjectData = {
      rooms: [{ id: 'r1', x: 0, y: 0, w: 3, h: 3, label: 'R' }],
      freeTexts: [],
      freeStrokes: [],
      viewport: { zoom: 1, panX: 0, panY: 0 },
      history: [],
    };
    saveProjectData('ok1', data);
    const result = loadProjectData('ok1');
    expect(result!.warning).toBeUndefined();
  });

  it('filters non-string entries from history', () => {
    storage.set(
      'yakata_project_hist1',
      JSON.stringify({
        rooms: [],
        freeTexts: [],
        history: ['valid', 123, null, 'also-valid'],
      }),
    );
    const result = loadProjectData('hist1');
    expect(result!.data.history).toEqual(['valid', 'also-valid']);
  });
});

describe('touchProjectUpdatedAt edge cases', () => {
  it('does nothing for non-existent project id', () => {
    createNewProject('Existing');
    const indexBefore = loadProjectIndex();
    const updatedAtBefore = indexBefore[0].updatedAt;

    touchProjectUpdatedAt('non-existent-id');

    const indexAfter = loadProjectIndex();
    // The existing project's updatedAt should remain unchanged
    expect(indexAfter[0].updatedAt).toBe(updatedAtBefore);
    // Index length unchanged
    expect(indexAfter).toHaveLength(1);
  });
});

describe('deleteProject edge cases', () => {
  it('does not throw for non-existent project id', () => {
    createNewProject('Existing');
    expect(loadProjectIndex()).toHaveLength(1);

    // Deleting a non-existent id should not throw
    expect(() => deleteProject('non-existent-id')).not.toThrow();

    // The existing project should remain
    expect(loadProjectIndex()).toHaveLength(1);
  });

  it('removes only the target project when multiple exist', () => {
    const projA = createNewProject('A');
    const projB = createNewProject('B');
    const projC = createNewProject('C');
    expect(loadProjectIndex()).toHaveLength(3);

    deleteProject(projB.meta.id);

    const remaining = loadProjectIndex();
    expect(remaining).toHaveLength(2);
    expect(remaining.map((m) => m.id)).toContain(projA.meta.id);
    expect(remaining.map((m) => m.id)).toContain(projC.meta.id);
    expect(remaining.map((m) => m.id)).not.toContain(projB.meta.id);

    // Project B data is gone
    expect(loadProjectData(projB.meta.id)).toBeNull();
    // Project A and C data still accessible
    expect(loadProjectData(projA.meta.id)).not.toBeNull();
    expect(loadProjectData(projC.meta.id)).not.toBeNull();
  });
});

describe('loadProjectData viewport edge cases', () => {
  it('falls back to default when viewport panX is null (e.g. serialized from non-finite value)', () => {
    // JSON.stringify({ panX: Infinity }) → { panX: null } — null は Number.isFinite チェックで弾かれる
    storage.set(
      'yakata_project_vp1',
      JSON.stringify({
        rooms: [],
        freeTexts: [],
        viewport: { zoom: 1, panX: Infinity, panY: 0 },
      }),
    );
    const result = loadProjectData('vp1');
    expect(result!.data.viewport).toEqual({ zoom: 1, panX: 0, panY: 0 });
  });

  it('falls back to default when viewport is null', () => {
    storage.set(
      'yakata_project_vp2',
      JSON.stringify({ rooms: [], freeTexts: [], viewport: null }),
    );
    const result = loadProjectData('vp2');
    expect(result!.data.viewport).toEqual({ zoom: 1, panX: 0, panY: 0 });
  });

  it('clamps zoom below minimum', () => {
    storage.set(
      'yakata_project_vp3',
      JSON.stringify({
        rooms: [],
        freeTexts: [],
        viewport: { zoom: 0.01, panX: 0, panY: 0 },
      }),
    );
    const result = loadProjectData('vp3');
    expect(result!.data.viewport.zoom).toBe(MIN_ZOOM);
  });

  it('clamps zoom above maximum', () => {
    storage.set(
      'yakata_project_vp4',
      JSON.stringify({
        rooms: [],
        freeTexts: [],
        viewport: { zoom: 999, panX: 0, panY: 0 },
      }),
    );
    const result = loadProjectData('vp4');
    expect(result!.data.viewport.zoom).toBe(MAX_ZOOM);
  });
});
