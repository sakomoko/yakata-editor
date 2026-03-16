# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

yakata-editor（館エディタ）は、グリッドベースの間取り図エディタ。推理作家・TRPGゲームマスター・ゲーム開発者向け。vanilla TypeScript + Canvas API で構築されたフロントエンドのみのアプリケーション。

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | 開発サーバー起動 (localhost:5555, auto-open) |
| `npm run build` | `tsc && vite build` で本番ビルド → dist/ |
| `npm run typecheck` | TypeScript型チェックのみ (--noEmit) |
| `npm run lint` | ESLint (src/) |
| `npm run format` | Prettier整形 |
| `npm run format:check` | Prettier整形チェック |
| `npm test` | Vitest 一回実行 |
| `npm run test:watch` | Vitest watch モード |

## Architecture

Canvas上でのマウス操作 → editor.ts のイベントハンドラ → state更新 → commitChange() → pushUndo() + render() + persistToStorage() というデータフローで動作する。

### Module Structure

- **types.ts** — 全型定義 (`Room`, `WallObject`, `Project`, `EditorState`, `DragState` discriminated union, `MouseCoord`)
- **editor.ts** — オーケストレーター。EditorState保持、Canvas描画(`render()`)、マウス/キーボードイベント処理、公開API (`initEditor`, `undo`, `newProject`, `loadProject`, `saveProject`, `exportAsPng`)
- **room.ts** — 部屋の生成(`createRoom`)、描画(`drawRoom`)、ヒット判定(`hitRoom`, `hitHandle`)、リサイズハンドル計算(`getHandles`)
- **wall-object.ts** — 壁オブジェクト(窓など)の生成・ヒット判定・ピクセル座標変換・壁セグメント分割
- **interior-object.ts** — 部屋内オブジェクト(階段・マーカー)の生成・描画・ヒット判定・クランプ・移動/リサイズ計算
- **free-text.ts** — 自由配置テキスト(FreeText)の生成・描画・ヒット判定・リサイズ計算。部屋に属さない独立オブジェクト
- **adjacency.ts** — 隣接部屋の壁オブジェクト自動同期。ペア開口の作成・削除・全再構築
- **context-menu.ts** / **ContextMenu.tsx** — 壁の右クリックコンテキストメニュー(窓の追加・削除)
- **selection.ts** — 選択状態管理 (Set\<string\>ベース)
- **history.ts** — Undoスタック (JSON snapshot方式、最大50件、Redo無し)
- **grid.ts** — グリッド定数 (`GRID=20px`) とビューポート対応のグリッド描画
- **persistence.ts** — localStorage自動保存、JSON/PNGエクスポート、ファイルインポート
- **main.ts** — エントリポイント。DOM初期化、`initEditor()`呼出、ツールバーボタンのイベント接続

### Key Design Decisions

- 座標系は2種類: ピクセル座標(px, py)とグリッド座標(gx, gy)。マウス座標は常にグリッドにスナップ
- DragStateはdiscriminated union (`create | move | resize | null`)
- 部屋のヒット判定はz-order考慮(後に追加された部屋が優先)
- キャンバスは無限（固定境界なし）。グリッドは可視範囲のみ描画

### 型拡張時の注意: persistence.ts の同期

`WallObject` など discriminated union に新しい型を追加した場合、`persistence.ts` の以下を必ず更新すること:

1. **バリデーション定数** — `VALID_WALL_OBJECT_TYPES` に新しい type 値を追加
2. **復元ロジック** — `ensureWallObjectIds` で新しい型固有のプロパティ（例: `WallDoor.swing`）を復元する分岐を追加

これを怠るとシリアライズは成功するがロード時にフィルタで除外され、リロードでデータが消失する。

## Code Style

- Strict TypeScript (noUnusedLocals, noUnusedParameters有効)
- `_` プレフィックスで未使用引数を許可
- singleQuote, trailingComma: all, printWidth: 100
- eqeqeq: always (厳密等価のみ)
- prefer-const

## Testing

テストファイルは `src/` 内に `*.test.ts` として配置。Vitestを使用。
DOMに依存しないロジック層（history, selection, room計算）がテスト対象。
