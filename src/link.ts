import type { Room } from './types.ts';

/** 2つの部屋が壁辺で接触し、1グリッド以上の重なりがあるか判定 */
export function areAdjacent(a: Room, b: Room): boolean {
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

  // 水平隣接: 辺が接触 かつ Y方向に1グリッド以上重なり
  if (a.x + a.w === b.x || b.x + b.w === a.x) {
    return overlapY >= 1;
  }
  // 垂直隣接: 辺が接触 かつ X方向に1グリッド以上重なり
  if (a.y + a.h === b.y || b.y + b.h === a.y) {
    return overlapX >= 1;
  }
  return false;
}

/** 選択IDをlinkGroupで拡張して返す */
export function expandWithLinked(rooms: Room[], selectedIds: Set<string>): Set<string> {
  const result = new Set(selectedIds);
  const groups = new Set<string>();
  for (const id of selectedIds) {
    const room = rooms.find((r) => r.id === id);
    if (room?.linkGroup) {
      groups.add(room.linkGroup);
    }
  }
  if (groups.size === 0) return result;
  for (const room of rooms) {
    if (room.linkGroup && groups.has(room.linkGroup)) {
      result.add(room.id);
    }
  }
  return result;
}

/** 選択した部屋群に同一のlinkGroup UUIDを付与。既存グループがあれば統合 */
export function linkRooms(rooms: Room[], roomIds: Set<string>): void {
  // 既存グループを収集
  const existingGroups = new Set<string>();
  for (const room of rooms) {
    if (roomIds.has(room.id) && room.linkGroup) {
      existingGroups.add(room.linkGroup);
    }
  }

  // 統合先のグループID（既存があればその1つ、なければ新規）
  const targetGroup =
    existingGroups.size > 0 ? [...existingGroups][0] : crypto.randomUUID();

  // 選択した部屋に付与
  for (const room of rooms) {
    if (roomIds.has(room.id)) {
      room.linkGroup = targetGroup;
    }
  }

  // 既存グループの他メンバーも統合
  if (existingGroups.size > 1) {
    for (const room of rooms) {
      if (!roomIds.has(room.id) && room.linkGroup && existingGroups.has(room.linkGroup)) {
        room.linkGroup = targetGroup;
      }
    }
  }
}

/** 選択した部屋のlinkGroupを除去 */
export function unlinkRooms(rooms: Room[], roomIds: Set<string>): void {
  for (const room of rooms) {
    if (roomIds.has(room.id)) {
      room.linkGroup = undefined;
    }
  }
  cleanupSingletonGroups(rooms);
}

/** グループメンバーが1部屋しかいない場合、そのlinkGroupを除去 */
export function cleanupSingletonGroups(rooms: Room[]): void {
  const groupCounts = new Map<string, number>();
  for (const room of rooms) {
    if (room.linkGroup) {
      groupCounts.set(room.linkGroup, (groupCounts.get(room.linkGroup) ?? 0) + 1);
    }
  }
  for (const room of rooms) {
    if (room.linkGroup && (groupCounts.get(room.linkGroup) ?? 0) <= 1) {
      room.linkGroup = undefined;
    }
  }
}

/** 選択した部屋の中に隣接ペアが存在するか */
export function hasAdjacentPair(rooms: Room[], roomIds: Set<string>): boolean {
  const selected = rooms.filter((r) => roomIds.has(r.id));
  for (let i = 0; i < selected.length; i++) {
    for (let j = i + 1; j < selected.length; j++) {
      if (areAdjacent(selected[i], selected[j])) return true;
    }
  }
  return false;
}

/** 選択した部屋にlinkGroupを持つものがあるか */
export function hasLinkedRoom(rooms: Room[], roomIds: Set<string>): boolean {
  return rooms.some((r) => roomIds.has(r.id) && r.linkGroup !== undefined);
}
