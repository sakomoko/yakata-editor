import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as path from 'node:path';
import {
  setDataDir,
  loadProjectIndex,
  saveProjectIndex,
  loadProjectData,
  saveProjectData,
  deleteProject,
  createNewProject,
} from './project-store-fs.ts';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
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

            if (method === 'GET' && !projectId) {
              const index = loadProjectIndex();
              sendJson(res, 200, index);
              return;
            }

            if (method === 'PUT' && !projectId) {
              const body = await readBody(req);
              const parsed = JSON.parse(body) as unknown;
              if (Array.isArray(parsed)) {
                saveProjectIndex(parsed);
                sendJson(res, 200, { ok: true });
                return;
              }
              sendJson(res, 400, { error: 'Expected array of ProjectMeta' });
              return;
            }

            if (method === 'POST' && !projectId) {
              const body = await readBody(req);
              const parsed = body ? (JSON.parse(body) as Record<string, unknown>) : {};
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
              const data = JSON.parse(body);
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
