import type { Room, WallSide, WallObject } from './types.ts';
import { createWallOpening } from './wall-object.ts';

/** 壁面の対面を返す */
export function getOppositeSide(side: WallSide): WallSide {
  switch (side) {
    case 'n':
      return 's';
    case 's':
      return 'n';
    case 'e':
      return 'w';
    case 'w':
      return 'e';
  }
}

export interface AdjacentWallInfo {
  room: Room;
  side: WallSide;
  /** 共有壁セグメントの開始位置（ソース部屋の座標系でのグリッド座標） */
  sharedStart: number;
  /** 共有壁セグメントの終了位置（ソース部屋の座標系でのグリッド座標） */
  sharedEnd: number;
}

/**
 * 指定した部屋の指定した壁面に隣接する部屋を全て返す。
 * 各隣接部屋について、対応する壁面と共有セグメント範囲を返す。
 */
export function findAdjacentRoomsOnWall(
  rooms: Room[],
  sourceRoom: Room,
  side: WallSide,
): AdjacentWallInfo[] {
  const results: AdjacentWallInfo[] = [];

  for (const other of rooms) {
    if (other.id === sourceRoom.id) continue;

    const oppSide = getOppositeSide(side);
    let adjacent = false;
    let sharedStart = 0;
    let sharedEnd = 0;

    if (side === 'e') {
      // ソースの東壁 = other の西壁
      if (sourceRoom.x + sourceRoom.w === other.x) {
        const overlapStart = Math.max(sourceRoom.y, other.y);
        const overlapEnd = Math.min(sourceRoom.y + sourceRoom.h, other.y + other.h);
        if (overlapEnd - overlapStart >= 1) {
          adjacent = true;
          sharedStart = overlapStart;
          sharedEnd = overlapEnd;
        }
      }
    } else if (side === 'w') {
      if (other.x + other.w === sourceRoom.x) {
        const overlapStart = Math.max(sourceRoom.y, other.y);
        const overlapEnd = Math.min(sourceRoom.y + sourceRoom.h, other.y + other.h);
        if (overlapEnd - overlapStart >= 1) {
          adjacent = true;
          sharedStart = overlapStart;
          sharedEnd = overlapEnd;
        }
      }
    } else if (side === 's') {
      if (sourceRoom.y + sourceRoom.h === other.y) {
        const overlapStart = Math.max(sourceRoom.x, other.x);
        const overlapEnd = Math.min(sourceRoom.x + sourceRoom.w, other.x + other.w);
        if (overlapEnd - overlapStart >= 1) {
          adjacent = true;
          sharedStart = overlapStart;
          sharedEnd = overlapEnd;
        }
      }
    } else {
      // side === 'n'
      if (other.y + other.h === sourceRoom.y) {
        const overlapStart = Math.max(sourceRoom.x, other.x);
        const overlapEnd = Math.min(sourceRoom.x + sourceRoom.w, other.x + other.w);
        if (overlapEnd - overlapStart >= 1) {
          adjacent = true;
          sharedStart = overlapStart;
          sharedEnd = overlapEnd;
        }
      }
    }

    if (adjacent) {
      results.push({ room: other, side: oppSide, sharedStart, sharedEnd });
    }
  }

  return results;
}

/**
 * ソース部屋のoffsetを隣接部屋の座標系に変換する。
 * 水平壁(n/s): targetOffset = sourceRoom.x + sourceOffset - targetRoom.x
 * 垂直壁(e/w): targetOffset = sourceRoom.y + sourceOffset - targetRoom.y
 */
export function convertOffset(
  sourceRoom: Room,
  targetRoom: Room,
  sourceSide: WallSide,
  sourceOffset: number,
): number {
  if (sourceSide === 'n' || sourceSide === 's') {
    return sourceRoom.x + sourceOffset - targetRoom.x;
  } else {
    return sourceRoom.y + sourceOffset - targetRoom.y;
  }
}

/** 自動生成された開口かどうか判定 */
export function isPairedAutoOpening(obj: WallObject): boolean {
  return obj.type === 'opening' && obj.pairedWith !== undefined && obj.pairedWith.length > 0;
}

/**
 * 壁オブジェクトのペア開口を同期する。
 * 既存のペアがあれば古い方を削除し、隣接部屋があれば新しい開口を作成する。
 */
export function syncPairedOpening(rooms: Room[], sourceRoom: Room, wallObject: WallObject): void {
  // 1. 既存のペアを削除
  removePairedOpening(rooms, wallObject);

  // 2. 隣接部屋を検索
  const adjacentInfos = findAdjacentRoomsOnWall(rooms, sourceRoom, wallObject.side);

  for (const adjInfo of adjacentInfos) {
    const targetRoom = adjInfo.room;

    // ソースのoffsetをターゲットの座標系に変換
    const targetOffset = convertOffset(sourceRoom, targetRoom, wallObject.side, wallObject.offset);
    const targetSideLen =
      adjInfo.side === 'n' || adjInfo.side === 's' ? targetRoom.w : targetRoom.h;

    // 共有壁セグメントの範囲をターゲットの座標系に変換
    let sharedStartInTarget: number;
    let sharedEndInTarget: number;
    if (wallObject.side === 'n' || wallObject.side === 's') {
      sharedStartInTarget = adjInfo.sharedStart - targetRoom.x;
      sharedEndInTarget = adjInfo.sharedEnd - targetRoom.x;
    } else {
      sharedStartInTarget = adjInfo.sharedStart - targetRoom.y;
      sharedEndInTarget = adjInfo.sharedEnd - targetRoom.y;
    }

    // オブジェクトの範囲
    const objStart = targetOffset;
    const objEnd = targetOffset + wallObject.width;

    // 共有壁セグメントとの交差を計算
    const clampedStart = Math.max(objStart, sharedStartInTarget);
    const clampedEnd = Math.min(objEnd, sharedEndInTarget);

    if (clampedEnd - clampedStart < 1) continue; // 共有壁上に1グリッド未満なら作成しない

    // クランプされたoffsetとwidthを壁の範囲内に収める
    const finalOffset = Math.max(0, Math.min(clampedStart, targetSideLen - 1));
    const finalWidth = Math.max(1, Math.min(clampedEnd - finalOffset, targetSideLen - finalOffset));

    // 3. 開口を作成
    const opening = createWallOpening(adjInfo.side, finalOffset, finalWidth);
    opening.pairedWith = [{ roomId: sourceRoom.id, objectId: wallObject.id }];

    if (!targetRoom.wallObjects) targetRoom.wallObjects = [];
    targetRoom.wallObjects.push(opening);

    // 4. ソースにもpairedWithを追加（配列に蓄積）
    if (!wallObject.pairedWith) wallObject.pairedWith = [];
    wallObject.pairedWith.push({ roomId: targetRoom.id, objectId: opening.id });
  }
}

/** ペアの開口を削除する */
export function removePairedOpening(rooms: Room[], wallObject: WallObject): void {
  if (!wallObject.pairedWith || wallObject.pairedWith.length === 0) return;

  for (const pair of wallObject.pairedWith) {
    const targetRoom = rooms.find((r) => r.id === pair.roomId);
    if (targetRoom?.wallObjects) {
      targetRoom.wallObjects = targetRoom.wallObjects.filter((o) => o.id !== pair.objectId);
      if (targetRoom.wallObjects.length === 0) targetRoom.wallObjects = undefined;
    }
  }

  wallObject.pairedWith = undefined;
}

/** 全部屋の全壁オブジェクトについてペア同期を再構築する */
export function syncAllPairedOpenings(rooms: Room[]): void {
  // 1. 全ての自動生成された開口を削除
  for (const room of rooms) {
    if (!room.wallObjects) continue;
    room.wallObjects = room.wallObjects.filter((o) => !isPairedAutoOpening(o));
    if (room.wallObjects.length === 0) room.wallObjects = undefined;
  }

  // 2. 全ての非ペア壁オブジェクトのpairedWithをクリア
  for (const room of rooms) {
    if (!room.wallObjects) continue;
    for (const obj of room.wallObjects) {
      obj.pairedWith = undefined;
    }
  }

  // 3. 全ての壁オブジェクトについて同期を実行
  // rooms配列のスナップショットを取得（syncPairedOpeningが壁オブジェクトを追加するため）
  const roomObjects: { room: Room; obj: WallObject }[] = [];
  for (const room of rooms) {
    if (!room.wallObjects) continue;
    for (const obj of room.wallObjects) {
      roomObjects.push({ room, obj });
    }
  }

  for (const { room, obj } of roomObjects) {
    syncPairedOpening(rooms, room, obj);
  }
}
