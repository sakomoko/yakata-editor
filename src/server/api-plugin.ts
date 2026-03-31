/// <reference types="node" />
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as path from 'node:path';
import { UUID_RE } from '../shared/project-utils.ts';
import { setDataDir } from './project-store-fs.ts';

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 MB

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
            const projectId = segments.length >= 3 ? segments[2] : null;

            if (projectId && !UUID_RE.test(projectId)) {
              sendJson(res, 400, { error: 'Invalid project ID format' });
              return;
            }

            const body =
              method === 'POST' || method === 'PUT' ? await readBody(req) : null;

            // ssrLoadModule で毎リクエスト最新のハンドラを読み込む（HMR対応）
            const handlerModule = await server.ssrLoadModule(
              '/src/server/api-handler.ts',
            );
            const { handleApi } = handlerModule as {
              handleApi: (
                method: string,
                projectId: string | null,
                body: string | null,
              ) => { status: number; body: unknown };
            };

            const result = handleApi(method, projectId, body);
            sendJson(res, result.status, result.body);
          } catch (e) {
            const message = e instanceof Error ? e.message : 'Internal error';
            sendJson(res, 500, { error: message });
          }
        },
      );
    },
  };
}
