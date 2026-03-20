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
| `npm run describe` | 間取り構造の可読出力 (CLIツール) |
| `npm run validate` | プロジェクトJSONのバリデーション (CLIツール) |

## Architecture

Canvas上でのマウス操作 → editor/ のイベントハンドラ → state更新 → commitChange() → saveUndoPoint() + render() + callbacks.onAutoSave() というデータフローで動作する。エディタはストレージに直接依存せず、App.tsxが `project-store.ts` を通じてアクティブプロジェクトのキーに保存する。

### Module Structure

- **types.ts** — 全型定義 (`Room`, `WallObject`, `FreeStroke`, `Project`, `EditorState`, `DragState` discriminated union, `MouseCoord`, `GridPoint`, `ProjectMeta`, `ProjectData`, `TabState`, `EntitySnapshot`)
- **editor/** — エディタのオーケストレーター。`EditorContext`オブジェクトで共有状態を管理し、各ハンドラを独立モジュールに分割
  - **editor/index.ts** — `initEditor()` エントリポイント。状態初期化・イベント登録・API返却
  - **editor/context.ts** — `EditorContext`, `EditorCallbacks`, `EditorAPI` 等のインターフェース定義
  - **editor/render.ts** — `render()`, `updateStatus()` 描画処理
  - **editor/project.ts** — `commitChange()`, `undo()`, `redo()`, `newProject()`, `loadProjectData()`, `saveProject()`, `exportAsPng()`, `applyRoomEdit()`
  - **editor/mouse-down.ts** — `onMouseDown()` マウスダウンイベント処理
  - **editor/mouse-move.ts** — `onMouseMove()` マウスムーブイベント処理
  - **editor/mouse-up.ts** — `onMouseUp()` マウスアップイベント処理
  - **editor/context-menu-handler.ts** — `onContextMenu()` 右クリックメニュー構築
  - **editor/keyboard.ts** — `onKeyDown()`, `onKeyUp()` キーボードイベント処理
  - **editor/wheel.ts** — `onWheel()` ホイールズーム・パン処理
  - **editor/dblclick.ts** — `onDblClick()` ダブルクリックイベント処理
  - **editor/clipboard.ts** — `copySelection()`, `pasteClipboard()`, `duplicateSelection()` コピー＆ペースト・ミラー変換処理
  - **editor/marker-edit.ts** — `editMarkerViaDialog()` マーカー編集ダイアログの共通処理
  - **editor/gesture.ts** — `initGestures()` マルチタッチジェスチャー認識（ピンチズーム・2本指パン・長押し）
  - **editor/utils.ts** — `labelDisplayWidth()`, `createMousePos()`, `getEntitySnapshot()` ユーティリティ
- **lookup.ts** — ID検索ヘルパー (`findRoomById`, `findRoomIndexById`, `findFreeTextById`, `findFreeStrokeById`, `findWallObjectById`, `findInteriorObjectById`)
- **snap.ts** — 頂点スナップ計算。他部屋の頂点・辺への近接スナップ(`findVertexSnap`)。`polygon.ts`の`getRoomVertices`/`projectPointOnSegment`を利用
- **polygon.ts** — 四角形（非直角）部屋のユーティリティ。点の包含判定(`pointInQuad`)、重心計算(`quadCentroid`)、AABB更新(`updateRoomBBFromVertices`)、辺計算(`quadEdgeEndpoints`, `quadEdgeLength`)、頂点ハンドル(`getVertexHandles`, `hitVertexHandle`)
- **room.ts** — 部屋の生成(`createRoom`)、描画(`drawRoom`)、ヒット判定(`hitRoom`, `hitHandle`)、リサイズハンドル計算(`getHandles`)
- **wall-object.ts** — 壁オブジェクト(窓など)の生成・ヒット判定・ピクセル座標変換・壁セグメント分割
- **interior-object.ts** — 部屋内オブジェクト(階段・マーカー)の生成・描画・ヒット判定・クランプ・移動/リサイズ計算
- **camera.ts** — 防犯カメラ(SecurityCamera)の生成・描画・ヒット判定・FOVハンドル計算・カラープリセット定数
- **free-text.ts** — 自由配置テキスト(FreeText)の生成・描画・ヒット判定・リサイズ計算。部屋に属さない独立オブジェクト
- **free-stroke.ts** — フリーペイントストローク(FreeStroke)の生成・描画・ヒット判定・バウンディングボックス・移動・点列間引き(Douglas-Peucker)・直線制約
- **adjacency.ts** — 隣接部屋の壁オブジェクト自動同期。ペア開口の作成・削除・全再構築
- **context-menu.ts** / **ContextMenu.tsx** — 壁の右クリックコンテキストメニュー(窓の追加・削除)
- **selection.ts** — 選択状態管理 (Set\<string\>ベース)
- **history.ts** — Undo/Redoスタック (JSON snapshot方式、各最大50件)。`saveUndoPoint()` でUndoへのpushとRedoクリアを一括実行
- **grid.ts** — グリッド定数 (`GRID=20px`) とビューポート対応のグリッド描画
- **project-store.ts** — マルチプロジェクト対応のlocalStorageストレージ層。プロジェクトindex・データ・タブ状態のCRUD、旧形式からの自動マイグレーション。開発モード時はREST APIへの自動同期
- **persistence.ts** — データバリデーション(`parseStorageData`)、JSON/PNGエクスポート、ファイルインポート
- **TabBar.tsx** — タブバーコンポーネント（タブ切り替え・追加・閉じ・リネーム）
- **ProjectListModal.tsx** — プロジェクト一覧モーダル（開く・削除）
- **main.ts** — エントリポイント。DOM初期化、`initEditor()`呼出、ツールバーボタンのイベント接続
- **server/** — 開発サーバー用モジュール（本番ビルドには含まれない）
  - **server/api-plugin.ts** — ViteプラグインでREST API(`/api/projects`)を提供
  - **server/project-store-fs.ts** — ファイルベースのプロジェクトストレージ(`data/`ディレクトリ)
- **cli/** — CLIツール
  - **cli/describe.ts** — 間取り構造の人間/AI可読出力（`npx tsx src/cli/describe.ts`）
  - **cli/validate.ts** — プロジェクトJSONのバリデーション（`npx tsx src/cli/validate.ts`）

### Key Design Decisions

- 座標系は2種類: ピクセル座標(px, py)とグリッド座標(gx, gy)。マウス座標は通常グリッドにスナップ（Shift押下時はサブグリッド＝浮動小数点を許容）
- DragStateはdiscriminated union (`create | move | resize | null`)
- 部屋のヒット判定はz-order考慮(後に追加された部屋が優先)
- キャンバスは無限（固定境界なし）。グリッドは可視範囲のみ描画
- editor/ は `EditorContext` オブジェクトパターンで共有状態を管理。クラスではなく関数型スタイルを維持

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

## GitHub CLI (`gh`) 利用ルール

- `gh pr create` でPR本文を渡すときは **`Write` ツールで `.pr-body.md` を作成** → `--body-file .pr-body.md` → 完了後 `rm .pr-body.md`。Bashでのヒアドキュメント・`$()`・`/tmp` 書き込みは権限チェックでブロックされるため禁止
- `gh issue create` では `--body "..."` で直接渡す。ただし `#` 見出しを含む場合は上記の `--body-file` 方式を使う
