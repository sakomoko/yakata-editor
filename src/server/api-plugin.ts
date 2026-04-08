/// <reference types="node" />
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import { UUID_RE } from '../shared/project-utils.ts';
import { setDataDir } from './project-store-fs.ts';
import { loadConfig, saveConfig, getEffectiveDataDir, resolveTilde } from './config.ts';

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
      const config = loadConfig(root);
      setDataDir(getEffectiveDataDir(root, config));
      let osascriptRunning = false;

      // Settings API
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url ?? '';
        const method = req.method ?? 'GET';

        if (!url.startsWith('/api/settings')) {
          next();
          return;
        }

        if (method === 'GET') {
          const current = loadConfig(root);
          sendJson(res, 200, { dataDir: getEffectiveDataDir(root, current) });
          return;
        }

        if (method === 'PUT') {
          readBody(req)
            .then((body) => {
              let parsed: Record<string, unknown>;
              try {
                parsed = JSON.parse(body) as Record<string, unknown>;
              } catch {
                sendJson(res, 400, { error: 'Invalid JSON' });
                return;
              }
              const newDataDir = typeof parsed.dataDir === 'string' ? parsed.dataDir.trim() : '';

              if (!newDataDir) {
                sendJson(res, 400, { error: 'dataDir is required' });
                return;
              }

              const resolved = resolveTilde(newDataDir);

              // ディレクトリ存在 & 書き込み権限チェック
              try {
                const stat = fs.statSync(resolved);
                if (!stat.isDirectory()) {
                  sendJson(res, 400, { error: `${newDataDir} はディレクトリではありません` });
                  return;
                }
                fs.accessSync(resolved, fs.constants.W_OK);
              } catch {
                sendJson(res, 400, {
                  error: `${newDataDir} が存在しないか、書き込み権限がありません`,
                });
                return;
              }

              saveConfig(root, { dataDir: newDataDir });
              setDataDir(resolved);
              sendJson(res, 200, { ok: true, dataDir: resolved });
            })
            .catch((e) => {
              const message = e instanceof Error ? e.message : 'Internal error';
              sendJson(res, 500, { error: message });
            });
          return;
        }

        if (method === 'POST') {
          if (process.platform !== 'darwin') {
            sendJson(res, 200, { cancelled: true });
            return;
          }
          if (osascriptRunning) {
            sendJson(res, 200, { cancelled: true });
            return;
          }
          osascriptRunning = true;
          child_process.execFile(
            'osascript',
            ['-e', 'POSIX path of (choose folder with prompt "データ保存先を選択")'],
            { timeout: 60000 },
            (err, stdout) => {
              osascriptRunning = false;
              if (err) {
                sendJson(res, 200, { cancelled: true });
                return;
              }
              sendJson(res, 200, { path: stdout.trim() });
            },
          );
          return;
        }

        sendJson(res, 405, { error: 'Method not allowed' });
      });

      // Projects API
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

            const body = method === 'POST' || method === 'PUT' ? await readBody(req) : null;

            // ssrLoadModule で毎リクエスト最新のハンドラを読み込む（HMR対応）
            const handlerModule = await server.ssrLoadModule('/src/server/api-handler.ts');
            const { handleApi } = handlerModule as {
              handleApi: (
                method: string,
                projectId: string | null,
                body: string | null,
              ) => Promise<{ status: number; body: unknown }>;
            };

            const result = await handleApi(method, projectId, body);
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
