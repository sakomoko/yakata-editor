/// <reference types="node" />
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as path from 'node:path';
import type { ProjectMeta } from '../types.ts';
import { parseStorageData } from '../persistence.ts';
import {
  setDataDir,
  loadProjectIndex,
  saveProjectIndex,
  loadProjectData,
  saveProjectData,
  deleteProject,
  createNewProject,
  parseViewport,
} from './project-store-fs.ts';

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 MB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let rejected = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE && !rejected) {
        rejected = true;
        req.destroy();
        reject(new Error('Body too large'));
        return;
      }
      if (!rejected) chunks.push(chunk);
    });
    req.on('end', () => {
      if (!rejected) resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    req.on('error', (err) => {
      if (!rejected) reject(err);
    });
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function isValidProjectMeta(item: unknown): item is ProjectMeta {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return typeof obj.id === 'string' && typeof obj.name === 'string';
}

export function yakataApiPlugin(): Plugin {
  return {
    name: 'yakata-api',
    configureServer(server: ViteDevServer) {
      const root = server.config.root || process.cwd();
      setDataDir(path.join(root, 'data'));

      server.middlewares.use(
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const url = req.url ?? '';
          const method = req.method ?? 'GET';

          if (!url.startsWith('/api/projects')) {
            next();
            return;
          }

          try {
            const pathPart = url.replace(/\?.*$/, '');
            const segments = pathPart.split('/').filter(Boolean);
            // segments: ['api', 'projects'] or ['api', 'projects', ':id']
            const projectId = segments.length >= 3 ? segments[2] : null;

            if (projectId && !UUID_RE.test(projectId)) {
              sendJson(res, 400, { error: 'Invalid project ID format' });
              return;
            }

            if (method === 'GET' && !projectId) {
              const index = loadProjectIndex();
              sendJson(res, 200, index);
              return;
            }

            if (method === 'PUT' && !projectId) {
              const body = await readBody(req);
              const parsed = JSON.parse(body) as unknown;
              if (!Array.isArray(parsed) || !parsed.every(isValidProjectMeta)) {
                sendJson(res, 400, { error: 'Expected array of ProjectMeta' });
                return;
              }
              saveProjectIndex(parsed);
              sendJson(res, 200, { ok: true });
              return;
            }

            if (method === 'POST' && !projectId) {
              const body = await readBody(req);
              const parsed = body.trim() ? (JSON.parse(body) as Record<string, unknown>) : {};
              const name = typeof parsed.name === 'string' ? parsed.name : undefined;
              const result = createNewProject(name);
              sendJson(res, 201, result);
              return;
            }

            if (method === 'GET' && projectId) {
              const index = loadProjectIndex();
              const meta = index.find((m) => m.id === projectId);
              if (!meta) {
                sendJson(res, 404, { error: 'Not found' });
                return;
              }
              const result = loadProjectData(projectId);
              if (!result) {
                sendJson(res, 404, { error: 'Data not found' });
                return;
              }
              sendJson(res, 200, { meta, data: result.data });
              return;
            }

            if (method === 'PUT' && projectId) {
              const body = await readBody(req);
              const parsed = JSON.parse(body) as unknown;
              const obj = parsed as Record<string, unknown>;
              if (!parsed || typeof parsed !== 'object' || !Array.isArray(obj.rooms)) {
                sendJson(res, 400, { error: 'Invalid project data: rooms array required' });
                return;
              }
              const validated = parseStorageData({
                rooms: obj.rooms,
                freeTexts: obj.freeTexts,
                freeStrokes: obj.freeStrokes,
              });
              const data = {
                rooms: validated.rooms,
                freeTexts: validated.freeTexts,
                freeStrokes: validated.freeStrokes,
                viewport: parseViewport(obj.viewport),
                history: Array.isArray(obj.history)
                  ? (obj.history as unknown[]).filter((h): h is string => typeof h === 'string')
                  : [],
              };
              saveProjectData(projectId, data);
              const index = loadProjectIndex();
              const meta = index.find((m) => m.id === projectId);
              if (meta) {
                meta.updatedAt = Date.now();
                saveProjectIndex(index);
              }
              sendJson(res, 200, { ok: true });
              return;
            }

            if (method === 'DELETE' && projectId) {
              deleteProject(projectId);
              sendJson(res, 200, { ok: true });
              return;
            }

            sendJson(res, 405, { error: 'Method not allowed' });
          } catch (e) {
            const message = e instanceof Error ? e.message : 'Internal error';
            sendJson(res, 500, { error: message });
          }
        },
      );
    },
  };
}
