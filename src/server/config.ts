/// <reference types="node" />
import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeAtomic } from './project-store-fs.ts';

export interface AppConfig {
  dataDir?: string;
}

export function loadConfig(rootDir: string): AppConfig {
  try {
    const raw = fs.readFileSync(path.join(rootDir, 'config.json'), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      return {
        dataDir: typeof obj.dataDir === 'string' ? obj.dataDir : undefined,
      };
    }
  } catch {
    // missing or corrupt — use defaults
  }
  return {};
}

export function saveConfig(rootDir: string, config: AppConfig): void {
  writeAtomic(path.join(rootDir, 'config.json'), JSON.stringify(config, null, 2));
}

export function resolveTilde(p: string): string {
  return p.startsWith('~/') ? path.join(process.env.HOME ?? '', p.slice(1)) : p;
}

export function getEffectiveDataDir(rootDir: string, config: AppConfig): string {
  if (config.dataDir) {
    const resolved = resolveTilde(config.dataDir);
    try {
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        return resolved;
      }
    } catch {
      // directory doesn't exist — fall back
    }
    console.warn(
      `[yakata] config.dataDir "${config.dataDir}" is not accessible, falling back to default`,
    );
  }
  return path.join(rootDir, 'data');
}
