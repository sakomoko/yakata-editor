import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { resolveTilde, getEffectiveDataDir, loadConfig, saveConfig } from './config.ts';

describe('config', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yakata-config-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('resolveTilde', () => {
    it('resolves ~ to homedir', () => {
      expect(resolveTilde('~')).toBe(os.homedir());
    });

    it('resolves ~/foo to homedir/foo', () => {
      expect(resolveTilde('~/foo')).toBe(path.join(os.homedir(), 'foo'));
    });

    it('resolves ~/nested/path correctly', () => {
      expect(resolveTilde('~/a/b/c')).toBe(path.join(os.homedir(), 'a', 'b', 'c'));
    });

    it('returns absolute paths unchanged', () => {
      expect(resolveTilde('/absolute/path')).toBe('/absolute/path');
    });

    it('returns relative paths unchanged', () => {
      expect(resolveTilde('relative/path')).toBe('relative/path');
    });
  });

  describe('getEffectiveDataDir', () => {
    it('returns configured directory when it exists', () => {
      const dataDir = path.join(tmpDir, 'custom-data');
      fs.mkdirSync(dataDir);
      const result = getEffectiveDataDir(tmpDir, { dataDir });
      expect(result).toBe(dataDir);
    });

    it('falls back to default when configured directory does not exist', () => {
      const result = getEffectiveDataDir(tmpDir, { dataDir: '/nonexistent/path' });
      expect(result).toBe(path.join(tmpDir, 'data'));
    });

    it('falls back to default when config has no dataDir', () => {
      const result = getEffectiveDataDir(tmpDir, {});
      expect(result).toBe(path.join(tmpDir, 'data'));
    });

    it('resolves tilde in configured path', () => {
      // This test uses homedir which should exist
      const result = getEffectiveDataDir(tmpDir, { dataDir: '~' });
      expect(result).toBe(os.homedir());
    });
  });

  describe('loadConfig / saveConfig', () => {
    it('returns empty config when no file exists', () => {
      expect(loadConfig(tmpDir)).toEqual({});
    });

    it('round-trips config through save and load', () => {
      const config = { dataDir: '/some/path' };
      saveConfig(tmpDir, config);
      expect(loadConfig(tmpDir)).toEqual(config);
    });

    it('returns empty config for corrupt JSON', () => {
      fs.writeFileSync(path.join(tmpDir, 'config.json'), 'not json');
      expect(loadConfig(tmpDir)).toEqual({});
    });

    it('ignores non-string dataDir values', () => {
      fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ dataDir: 42 }));
      expect(loadConfig(tmpDir)).toEqual({ dataDir: undefined });
    });
  });
});
