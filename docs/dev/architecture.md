# アーキテクチャ

## 概要

yakata-editorは、Canvas APIベースのグリッド間取り図エディタ。vanilla TypeScript + Viteで構築されたフロントエンドのみのアプリケーション。

## データフロー

```
ユーザー入力（マウス/キーボード）
    ↓
editor.ts イベントハンドラ
    ↓
EditorState 更新
    ↓
commitChange()
    ↓
pushUndo() → render() → persistToStorage()
    ↓
Canvas 再描画 + localStorage 保存
```

## モジュール構成

### エントリポイント

- **main.ts** — DOM初期化、`initEditor()` 呼出、ツールバーボタンのイベント接続

### コアモジュール

- **editor.ts** — オーケストレーター。`EditorState` を保持し、Canvas描画（`render()`）とマウス/キーボードイベントを処理。外部向けAPI（`initEditor`, `undo`, `newProject`, `loadProject`, `saveProject`, `exportAsPng`）を提供
- **types.ts** — 全型定義（`Room`, `Project`, `EditorState`, `DragState`, `MouseCoord`, `Handle`）

### 機能モジュール

- **room.ts** — 部屋の生成（`createRoom`）、Canvas描画（`drawRoom`）、ヒット判定（`hitRoom`, `hitHandle`）、リサイズハンドル計算（`getHandles`）
- **selection.ts** — `Set<string>` ベースの選択状態管理
- **history.ts** — Undoスタック（JSON snapshot方式、最大50件）
- **grid.ts** — グリッド定数（`GRID=20px`, `COLS=100`, `ROWS=75`）と描画
- **persistence.ts** — localStorage自動保存、JSON/PNGエクスポート、ファイルインポート

## モジュール依存関係

```
main.ts
  ├─ editor.ts
  │   ├─ types.ts
  │   ├─ grid.ts
  │   ├─ room.ts → types.ts, grid.ts
  │   ├─ selection.ts → types.ts
  │   ├─ history.ts → types.ts
  │   └─ persistence.ts → types.ts
  ├─ persistence.ts
  └─ style.css
```

## 座標系

アプリケーションは2種類の座標系を使用する:

| 座標系 | プロパティ | 用途 |
|--------|-----------|------|
| ピクセル座標 | `px`, `py` | Canvas描画、マウスイベント |
| グリッド座標 | `gx`, `gy` | 部屋の位置・サイズ（`Room.x`, `Room.y`） |

変換: `グリッド座標 = Math.round(ピクセル座標 / GRID)`

マウス座標は常にグリッドにスナップされる。

## 状態管理

`EditorState` が単一の状態オブジェクトとしてアプリケーション全体の状態を保持する。

- `rooms: Room[]` — 全部屋データ
- `selection: Set<string>` — 選択中の部屋ID
- `history: string[]` — Undoスナップショット（JSON文字列）
- `drag: DragState` — ドラッグ操作の状態（discriminated union: `create | move | resize | null`）
- `mouse: MouseCoord` — 現在のマウス座標

状態変更は `commitChange()` を通じて行い、Undo履歴の保存・Canvas再描画・localStorage保存をまとめて実行する。
