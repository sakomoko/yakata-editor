/// <reference types="node" />
import { parseStorageData } from '../persistence.ts';
import { isValidProjectMeta, parseViewport } from '../shared/project-utils.ts';
import {
  loadProjectIndex,
  saveProjectIndex,
  loadProjectData,
  saveProjectData,
  deleteProject,
  createNewProject,
} from './project-store-fs.ts';

export interface ApiResult {
  status: number;
  body: unknown;
}

export function handleApi(
  method: string,
  projectId: string | null,
  body: string | null,
): ApiResult {
  if (method === 'GET' && !projectId) {
    return { status: 200, body: loadProjectIndex() };
  }

  if (method === 'PUT' && !projectId) {
    const parsed = JSON.parse(body!) as unknown;
    if (!Array.isArray(parsed) || !parsed.every(isValidProjectMeta)) {
      return { status: 400, body: { error: 'Expected array of ProjectMeta' } };
    }
    saveProjectIndex(parsed);
    return { status: 200, body: { ok: true } };
  }

  if (method === 'POST' && !projectId) {
    const parsed = body?.trim() ? (JSON.parse(body) as Record<string, unknown>) : {};
    const name = typeof parsed.name === 'string' ? parsed.name : undefined;
    const result = createNewProject(name);
    return { status: 201, body: result };
  }

  if (method === 'GET' && projectId) {
    const index = loadProjectIndex();
    const meta = index.find((m) => m.id === projectId);
    if (!meta) {
      return { status: 404, body: { error: 'Not found' } };
    }
    const result = loadProjectData(projectId);
    if (!result) {
      return { status: 404, body: { error: 'Data not found' } };
    }
    return { status: 200, body: { meta, data: result.data } };
  }

  if (method === 'PUT' && projectId) {
    const index = loadProjectIndex();
    const meta = index.find((m) => m.id === projectId);
    if (!meta) {
      return { status: 404, body: { error: 'Project not found' } };
    }
    const parsed = JSON.parse(body!) as unknown;
    const obj = parsed as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(obj.rooms)) {
      return { status: 400, body: { error: 'Invalid project data: rooms array required' } };
    }
    const validated = parseStorageData({
      rooms: obj.rooms,
      freeTexts: obj.freeTexts,
      freeStrokes: obj.freeStrokes,
      arrows: obj.arrows,
      stickyNotes: obj.stickyNotes,
    });
    const data = {
      rooms: validated.rooms,
      freeTexts: validated.freeTexts,
      freeStrokes: validated.freeStrokes,
      arrows: validated.arrows,
      stickyNotes: validated.stickyNotes,
      viewport: parseViewport(obj.viewport),
      history: Array.isArray(obj.history)
        ? (obj.history as unknown[]).filter((h): h is string => typeof h === 'string')
        : [],
    };
    saveProjectData(projectId, data);
    meta.updatedAt = Date.now();
    saveProjectIndex(index);
    return { status: 200, body: { ok: true } };
  }

  if (method === 'DELETE' && projectId) {
    deleteProject(projectId);
    return { status: 200, body: { ok: true } };
  }

  return { status: 405, body: { error: 'Method not allowed' } };
}
