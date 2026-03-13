# データ構造

## Room

部屋を表す基本データ構造。座標・サイズはすべてグリッド単位。

```typescript
interface Room {
  id: string;      // UUID
  x: number;       // グリッド座標 X
  y: number;       // グリッド座標 Y
  w: number;       // 幅（グリッド単位）
  h: number;       // 高さ（グリッド単位）
  label: string;   // 部屋名
  floor?: number;  // フロア番号（将来対応）
}
```

## Project

JSON保存ファイルの形式。

```typescript
interface Project {
  version: number;     // ファイル形式バージョン
  name: string;        // プロジェクト名
  gridSize: number;    // グリッドサイズ（px）
  rooms: Room[];       // 部屋の配列
}
```

## DragState

ドラッグ操作の状態を表すdiscriminated union。

```typescript
type DragState =
  | { type: 'create'; start: MouseCoord; cur: MouseCoord }
  | { type: 'move'; originals: Map<string, { x: number; y: number }>; start: MouseCoord }
  | { type: 'resize'; dir: ResizeDirection; orig: { x: number; y: number; w: number; h: number }; targetId: string; start: MouseCoord }
  | null;
```

| type | 発生条件 | 動作 |
|------|---------|------|
| `create` | 空白エリアをドラッグ | 新しい部屋の矩形を描画 |
| `move` | 選択中の部屋をドラッグ | 部屋を移動（複数選択時は一括移動） |
| `resize` | ハンドルをドラッグ | 部屋のリサイズ（単一選択時のみ） |
| `null` | ドラッグなし | 通常状態 |

## EditorState

アプリケーション全体の状態。

```typescript
interface EditorState {
  rooms: Room[];           // 全部屋データ
  selection: Set<string>;  // 選択中の部屋ID
  history: string[];       // Undoスナップショット（JSON文字列、最大50件）
  drag: DragState;         // 現在のドラッグ操作
  mouse: MouseCoord;       // 現在のマウス座標
}
```

## MouseCoord

マウス座標（ピクセルとグリッドの両方を保持）。

```typescript
interface MouseCoord {
  px: number;  // ピクセル座標 X
  py: number;  // ピクセル座標 Y
  gx: number;  // グリッド座標 X（スナップ済み）
  gy: number;  // グリッド座標 Y（スナップ済み）
}
```

## Handle / ResizeDirection

リサイズハンドルの位置と方向。

```typescript
type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

interface Handle {
  px: number;          // ハンドルのピクセル座標 X
  py: number;          // ハンドルのピクセル座標 Y
  dir: ResizeDirection; // リサイズ方向
}
```

8方向のハンドルが部屋の選択時に表示される。ハンドルサイズは `HANDLE_SIZE=8px`、ヒット判定範囲は `HANDLE_HIT=7px`。
