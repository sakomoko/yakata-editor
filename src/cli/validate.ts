/// <reference types="node" />
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Room, WallSide } from '../types.ts';
import { parseStorageData } from '../persistence.ts';

const DATA_DIR = path.join(process.cwd(), 'data');

interface ValidationResult {
  errors: string[];
  warnings: string[];
}

function wallLength(room: Room, side: WallSide): number {
  return side === 'n' || side === 's' ? room.w : room.h;
}

function validate(filePath: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch {
    errors.push(`ファイルを読み込めません: ${filePath}`);
    return { errors, warnings };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    errors.push('JSONの解析に失敗しました。');
    return { errors, warnings };
  }

  if (!parsed || typeof parsed !== 'object') {
    errors.push('トップレベルがオブジェクトではありません。');
    return { errors, warnings };
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.rooms)) {
    errors.push('rooms配列が存在しません。');
    return { errors, warnings };
  }

  const storageData = parseStorageData(parsed);
  if (storageData.warning) {
    warnings.push(`parseStorageData警告: ${storageData.warning}`);
  }

  const rooms = storageData.rooms;
  const roomIds = new Set<string>();

  for (const room of rooms) {
    roomIds.add(room.id);

    if (room.w <= 0 || room.h <= 0) {
      errors.push(
        `部屋 "${room.label}" (${room.id}): サイズが正でありません (${room.w}×${room.h})`,
      );
    }

    for (const wo of room.wallObjects ?? []) {
      const wl = wallLength(room, wo.side);
      if (wo.offset < 0) {
        errors.push(`部屋 "${room.label}" 壁オブジェクト ${wo.id}: offset (${wo.offset}) が負です`);
      }
      if (wo.offset + wo.width > wl) {
        errors.push(
          `部屋 "${room.label}" 壁オブジェクト ${wo.id}: offset+width (${wo.offset}+${wo.width}=${wo.offset + wo.width}) が壁の長さ (${wl}) を超えています`,
        );
      }
    }

    for (const io of room.interiorObjects ?? []) {
      if (io.x < 0 || io.y < 0 || io.x + io.w > room.w || io.y + io.h > room.h) {
        warnings.push(
          `部屋 "${room.label}" インテリア ${io.id}: 位置 (${io.x},${io.y}) サイズ (${io.w}×${io.h}) が部屋の範囲外です`,
        );
      }
    }
  }

  // pairedWith references
  for (const room of rooms) {
    for (const wo of room.wallObjects ?? []) {
      if (!wo.pairedWith) continue;
      for (const pair of wo.pairedWith) {
        if (!roomIds.has(pair.roomId)) {
          errors.push(
            `部屋 "${room.label}" 壁オブジェクト ${wo.id}: pairedWith.roomId "${pair.roomId}" が存在しません`,
          );
          continue;
        }
        const targetRoom = rooms.find((r) => r.id === pair.roomId);
        const targetObj = targetRoom?.wallObjects?.find((o) => o.id === pair.objectId);
        if (!targetObj) {
          errors.push(
            `部屋 "${room.label}" 壁オブジェクト ${wo.id}: pairedWith.objectId "${pair.objectId}" が対象部屋に存在しません`,
          );
        }
      }
    }
  }

  // Room overlap detection
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i];
      const b = rooms[j];
      const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
      const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;
      if (overlapX && overlapY) {
        warnings.push(`部屋 "${a.label}" と "${b.label}" が重なっています`);
      }
    }
  }

  return { errors, warnings };
}

function main(): void {
  const arg = process.argv[2];
  let filePath: string;

  if (!arg) {
    const indexPath = path.join(DATA_DIR, 'index.json');
    if (!fs.existsSync(indexPath)) {
      console.log(
        'プロジェクトが見つかりません。引数にファイルパスまたはプロジェクトIDを指定してください。',
      );
      process.exit(1);
    }
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as Array<{ id: string }>;
    if (index.length === 0) {
      console.log('プロジェクトが見つかりません。');
      process.exit(1);
    }
    filePath = path.join(DATA_DIR, 'projects', `${index[0].id}.json`);
  } else {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isFile = arg.endsWith('.json') || arg.includes('/') || arg.includes('\\');
    if (isFile) {
      filePath = path.resolve(arg);
    } else if (UUID_RE.test(arg)) {
      filePath = path.join(DATA_DIR, 'projects', `${arg}.json`);
    } else {
      console.error(`無効なプロジェクトID形式です: ${arg}`);
      process.exit(1);
    }
  }

  if (!fs.existsSync(filePath)) {
    console.error(`ファイルが見つかりません: ${filePath}`);
    process.exit(1);
  }

  const result = validate(filePath);

  if (result.errors.length === 0 && result.warnings.length === 0) {
    console.log('OK');
    process.exit(0);
  }

  for (const err of result.errors) {
    console.error(`ERROR: ${err}`);
  }
  for (const warn of result.warnings) {
    console.warn(`WARN: ${warn}`);
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main();
