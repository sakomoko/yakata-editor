import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Room, WallObject, RoomInteriorObject, FreeText, FreeStroke } from '../types.ts';
import { parseStorageData } from '../persistence.ts';
import { findAdjacentRoomsOnWall } from '../adjacency.ts';
import type { WallSide } from '../types.ts';

const DATA_DIR = path.join(process.cwd(), 'data');

interface ProjectFile {
  rooms: Room[];
  freeTexts: FreeText[];
  freeStrokes: FreeStroke[];
}

function loadProject(filePath: string): ProjectFile {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  const data = parseStorageData(parsed);
  return { rooms: data.rooms, freeTexts: data.freeTexts, freeStrokes: data.freeStrokes };
}

function sideLabel(side: WallSide): string {
  const map: Record<WallSide, string> = { n: '北壁', e: '東壁', s: '南壁', w: '西壁' };
  return map[side];
}

function describeWallObject(obj: WallObject): string {
  const parts = [`offset: ${obj.offset}, 幅: ${obj.width}`];
  if (obj.type === 'door') {
    parts.push(`swing: ${obj.swing}, hinge: ${obj.hinge}`);
  }
  const typeLabel = obj.type === 'window' ? '窓' : obj.type === 'door' ? 'ドア' : '開口';
  return `${sideLabel(obj.side)}: ${typeLabel} (${parts.join(', ')})`;
}

function describeInterior(obj: RoomInteriorObject): string {
  if (obj.type === 'stairs') {
    const kind = obj.stairsType === 'straight' ? '直線階段' : '折り返し階段';
    const dirMap: Record<string, string> = { n: '北', e: '東', s: '南', w: '西' };
    return `${kind} (${obj.x}, ${obj.y}) ${obj.w}×${obj.h} 方向: ${dirMap[obj.direction]}`;
  }
  if (obj.type === 'marker') {
    const label = obj.label ? ` "${obj.label}"` : '';
    return `マーカー(${obj.markerKind})${label} (${obj.x}, ${obj.y}) ${obj.w}×${obj.h}`;
  }
  if (obj.type === 'camera') {
    const angleDeg = Math.round((obj.angle * 180) / Math.PI);
    return `防犯カメラ (${obj.x}, ${obj.y}) 角度: ${angleDeg}° 視野: ${obj.fovRange}グリッド`;
  }
  return `不明なオブジェクト`;
}

function describeProject(project: ProjectFile): string {
  const lines: string[] = [];
  const { rooms, freeTexts, freeStrokes } = project;

  lines.push('# プロジェクト構造');
  lines.push('');
  lines.push(`## 部屋一覧 (${rooms.length}部屋)`);

  for (const room of rooms) {
    lines.push('');
    lines.push(`### ${room.label || '(名前なし)'}`);
    const floor = room.floor ?? 1;
    lines.push(`- 位置: (${room.x}, ${room.y}), サイズ: ${room.w}×${room.h} グリッド`);
    lines.push(`- 階: ${floor}F`);

    const wallObjects = room.wallObjects ?? [];
    if (wallObjects.length > 0) {
      lines.push('- 壁オブジェクト:');
      for (const wo of wallObjects) {
        lines.push(`  - ${describeWallObject(wo)}`);
      }
    }

    const interiors = room.interiorObjects ?? [];
    if (interiors.length > 0) {
      lines.push('- インテリア:');
      for (const io of interiors) {
        lines.push(`  - ${describeInterior(io)}`);
      }
    }
  }

  // Adjacency
  const sides: WallSide[] = ['n', 'e', 's', 'w'];
  const adjacencyPairs = new Set<string>();
  const adjacencyLines: string[] = [];

  for (const room of rooms) {
    for (const side of sides) {
      const adjacents = findAdjacentRoomsOnWall(rooms, room, side);
      for (const adj of adjacents) {
        const key = [room.id, adj.room.id].sort().join('-');
        if (adjacencyPairs.has(key)) continue;
        adjacencyPairs.add(key);

        const sideDesc = side === 'e' || side === 'w' ? '東西壁共有' : '南北壁共有';
        const axis = side === 'e' || side === 'w' ? 'y' : 'x';
        adjacencyLines.push(
          `- ${room.label || room.id} <-> ${adj.room.label || adj.room.id} (${sideDesc}, 共有範囲: ${axis}=${adj.sharedStart}~${adj.sharedEnd})`,
        );
      }
    }
  }

  if (adjacencyLines.length > 0) {
    lines.push('');
    lines.push('## 隣接関係');
    lines.push(...adjacencyLines);
  }

  if (freeTexts.length > 0) {
    lines.push('');
    lines.push(`## フリーテキスト (${freeTexts.length}個)`);
    for (const ft of freeTexts) {
      lines.push(`- "${ft.label}" at (${ft.gx}, ${ft.gy}) サイズ: ${ft.w}×${ft.h}`);
    }
  }

  if (freeStrokes.length > 0) {
    lines.push('');
    lines.push(`## フリーストローク (${freeStrokes.length}本)`);
    for (const stroke of freeStrokes) {
      lines.push(
        `- ${stroke.color} (lineWidth: ${stroke.lineWidth}, opacity: ${stroke.opacity}) ${stroke.points.length}点`,
      );
    }
  }

  return lines.join('\n');
}

function main(): void {
  const arg = process.argv[2];

  if (!arg) {
    // List available projects and describe the first one
    const indexPath = path.join(DATA_DIR, 'index.json');
    if (!fs.existsSync(indexPath)) {
      console.log('プロジェクトが見つかりません。data/ ディレクトリにプロジェクトがありません。');
      process.exit(1);
    }
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as Array<{
      id: string;
      name: string;
    }>;
    if (index.length === 0) {
      console.log('プロジェクトが見つかりません。');
      process.exit(1);
    }
    console.log('利用可能なプロジェクト:');
    for (const entry of index) {
      console.log(`  - ${entry.name} (${entry.id})`);
    }
    console.log('');
    const firstId = index[0].id;
    const filePath = path.join(DATA_DIR, 'projects', `${firstId}.json`);
    if (!fs.existsSync(filePath)) {
      console.log(`プロジェクトファイルが見つかりません: ${filePath}`);
      process.exit(1);
    }
    console.log(describeProject(loadProject(filePath)));
    return;
  }

  // Determine if it's a file path or project ID
  const isFilePath = arg.endsWith('.json') || arg.includes('/') || arg.includes('\\');
  let filePath: string;

  if (isFilePath) {
    filePath = path.resolve(arg);
  } else {
    filePath = path.join(DATA_DIR, 'projects', `${arg}.json`);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`ファイルが見つかりません: ${filePath}`);
    process.exit(1);
  }

  console.log(describeProject(loadProject(filePath)));
}

main();
