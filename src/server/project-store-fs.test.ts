import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  setDataDir,
  writeAtomic,
  loadProjectIndex,
  saveProjectIndex,
  loadProjectData,
  saveProjectData,
  deleteProject,
  createNewProject,
} from './project-store-fs.ts';

describe('project-store-fs', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yakata-fs-'));
    setDataDir(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('writeAtomic', () => {
    it('writes content to file', () => {
      const filePath = path.join(tmpDir, 'test.txt');
      writeAtomic(filePath, 'hello world');
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('hello world');
    });

    it('creates parent directories', () => {
      const filePath = path.join(tmpDir, 'nested', 'dir', 'test.txt');
      writeAtomic(filePath, 'nested content');
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('nested content');
    });

    it('overwrites existing file', () => {
      const filePath = path.join(tmpDir, 'overwrite.txt');
      writeAtomic(filePath, 'first');
      writeAtomic(filePath, 'second');
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('second');
    });
  });

  describe('loadProjectIndex', () => {
    it('returns empty array if index file does not exist', () => {
      expect(loadProjectIndex()).toEqual([]);
    });

    it('returns parsed index', () => {
      const index = [{ id: 'abc', name: 'テスト', createdAt: 1000, updatedAt: 2000 }];
      const indexPath = path.join(tmpDir, 'index.json');
      fs.writeFileSync(indexPath, JSON.stringify(index), 'utf-8');
      const result = loadProjectIndex();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('abc');
      expect(result[0].name).toBe('テスト');
    });

    it('filters out invalid entries', () => {
      const data = [
        { id: 'valid', name: 'ok' },
        { id: 123, name: 'bad-id' },
        { id: 'bad-name', name: null },
        null,
      ];
      fs.writeFileSync(path.join(tmpDir, 'index.json'), JSON.stringify(data), 'utf-8');
      const result = loadProjectIndex();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('valid');
    });
  });

  describe('saveProjectIndex', () => {
    it('saves and loads index round-trip', () => {
      const index = [{ id: 'p1', name: 'プロジェクト1', createdAt: 1000, updatedAt: 2000 }];
      saveProjectIndex(index);
      const loaded = loadProjectIndex();
      expect(loaded).toEqual(index);
    });
  });

  describe('saveProjectData / loadProjectData', () => {
    it('saves and loads project data round-trip', () => {
      const data = {
        rooms: [{ id: 'r1', x: 0, y: 0, w: 5, h: 5, label: 'テスト' }],
        freeTexts: [],
        freeStrokes: [],
        viewport: { zoom: 1, panX: 0, panY: 0 },
        history: ['snapshot1'],
      };
      saveProjectData('test-id', data);
      const result = loadProjectData('test-id');
      expect(result).not.toBeNull();
      expect(result!.data.rooms).toHaveLength(1);
      expect(result!.data.rooms[0].label).toBe('テスト');
      expect(result!.data.history).toEqual(['snapshot1']);
    });

    it('returns null for non-existent project', () => {
      expect(loadProjectData('nonexistent')).toBeNull();
    });
  });

  describe('deleteProject', () => {
    it('removes project file and updates index', () => {
      const index = [{ id: 'del-me', name: 'Delete Me', createdAt: 1000, updatedAt: 2000 }];
      saveProjectIndex(index);
      saveProjectData('del-me', {
        rooms: [],
        freeTexts: [],
        freeStrokes: [],
        viewport: { zoom: 1, panX: 0, panY: 0 },
        history: [],
      });

      deleteProject('del-me');
      expect(loadProjectIndex()).toHaveLength(0);
      expect(loadProjectData('del-me')).toBeNull();
    });

    it('handles deletion of non-existent project gracefully', () => {
      saveProjectIndex([]);
      expect(() => deleteProject('nonexistent')).not.toThrow();
    });
  });

  describe('createNewProject', () => {
    it('creates a new project with default name', () => {
      const result = createNewProject();
      expect(result.meta.name).toBe('無題のプロジェクト');
      expect(result.data.rooms).toEqual([]);
      expect(loadProjectIndex()).toHaveLength(1);
    });

    it('creates a new project with custom name', () => {
      const result = createNewProject('カスタム名');
      expect(result.meta.name).toBe('カスタム名');
    });

    it('deduplicates default name', () => {
      createNewProject();
      const second = createNewProject();
      expect(second.meta.name).toBe('無題のプロジェクト (2)');
    });
  });
});
