/// <reference types="node" />
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { ProjectMeta, ProjectData } from '../types.ts';
import { parseStorageData } from '../persistence.ts';
import { parseViewport, generateDefaultName, isValidProjectMeta } from '../shared/project-utils.ts';

export interface LoadProjectResult {
  data: ProjectData;
  warning?: string;
}

let dataDir = 'data';

export function setDataDir(dir: string): void {
  dataDir = dir;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function indexPath(): string {
  return path.join(dataDir, 'index.json');
}

function projectPath(id: string): string {
  return path.join(dataDir, 'projects', `${id}.json`);
}

/** @internal Exported for testing */
export function writeAtomic(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tmp = filePath + '.tmp.' + crypto.randomUUID();
  try {
    fs.writeFileSync(tmp, content, 'utf-8');
    fs.renameSync(tmp, filePath);
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore cleanup failure
    }
    throw e;
  }
}

export function loadProjectIndex(): ProjectMeta[] {
  try {
    const raw = fs.readFileSync(indexPath(), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidProjectMeta);
  } catch {
    return [];
  }
}

export function saveProjectIndex(index: ProjectMeta[]): void {
  writeAtomic(indexPath(), JSON.stringify(index, null, 2));
}

export function loadProjectData(id: string): LoadProjectResult | null {
  try {
    const raw = fs.readFileSync(projectPath(id), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;

    const storageData = parseStorageData({
      rooms: obj.rooms,
      freeTexts: obj.freeTexts,
      freeStrokes: obj.freeStrokes,
      arrows: obj.arrows,
      stickyNotes: obj.stickyNotes,
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
        arrows: storageData.arrows,
        stickyNotes: storageData.stickyNotes,
        viewport,
        history,
      },
      warning: storageData.warning,
    };
  } catch {
    return null;
  }
}

export function saveProjectData(id: string, data: ProjectData): void {
  writeAtomic(projectPath(id), JSON.stringify(data, null, 2));
}

export function deleteProject(id: string): void {
  try {
    fs.unlinkSync(projectPath(id));
  } catch {
    // file may not exist
  }
  const index = loadProjectIndex().filter((m) => m.id !== id);
  saveProjectIndex(index);
}

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
    freeStrokes: [],
    arrows: [],
    stickyNotes: [],
    viewport: { zoom: 1, panX: 0, panY: 0 },
    history: [],
  };

  index.push(meta);
  saveProjectIndex(index);
  saveProjectData(id, data);

  return { meta, data };
}
