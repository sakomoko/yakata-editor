# アーキテクチャ

## 概要

yakata-editorは、Canvas APIベースのグリッド間取り図エディタ。vanilla TypeScript + Viteで構築されたフロントエンドのみのアプリケーション。

## データフロー

```
ユーザー入力（マウス/タッチ/ペン/キーボード）
    ↓
editor/ イベントハンドラ（mouse-down.ts, mouse-move.ts 等）
    ↓
EditorContext 経由で EditorState 更新
    ↓
commitChange()（editor/project.ts）
    ↓
pushUndo() → render() → callbacks.onAutoSave()
    ↓
Canvas 再描画 + App.tsx → project-store.ts → localStorage 保存
                                                 ↓ (開発モード時)
                                            REST API → server/project-store-fs.ts → data/*.json
```

エディタはストレージに直接依存せず、`onAutoSave` / `onViewportChange` コールバックを通じて App.tsx に通知する。App.tsx が `project-store.ts` を使ってアクティブプロジェクトのキーに保存する。

開発モード（`import.meta.env.DEV`）時は、localStorage保存と同時にREST API経由でファイルストレージにも同期する（fire-and-forget）。これにより、CLIツールやAIエージェントがファイルシステム上のプロジェクトデータに直接アクセスできる。

## モジュール構成

### エントリポイント

- **main.ts** — DOM初期化、`initEditor()` 呼出、ツールバーボタンのイベント接続

### コアモジュール

- **editor/** — オーケストレーター。`EditorContext` オブジェクトパターンで共有状態を管理し、各イベントハンドラを独立モジュールに分割
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
  - **editor/clipboard.ts** — `copySelection()`, `pasteClipboard()`, `duplicateSelection()` コピー＆ペースト・ミラー変換処理。`ClipboardData` を `flags.clipboard` に保持（Undo対象外）
  - **editor/marker-edit.ts** — `editMarkerViaDialog()` マーカー編集ダイアログの共通処理（dblclick/context-menuから利用）
  - **editor/gesture.ts** — `initGestures()` マルチタッチジェスチャー認識（ピンチズーム・2本指パン・長押しコンテキストメニュー）。Pointer Eventsのリスナー登録を一元管理し、シングルポインタイベントをハンドラに委譲
  - **editor/utils.ts** — `labelDisplayWidth()`, `createMousePos()`, `getEntitySnapshot()` ユーティリティ
- **types.ts** — 全型定義（`Room`, `FreeText`, `FreeStroke`, `WallObject`, `RoomInteriorObject`, `Project`, `EditorState`, `DragState`, `MouseCoord`, `Handle`, `GroupHandle`, `GroupScaleOriginal`, `GridPoint`, `CornerDirection`, `ProjectMeta`, `ProjectData`, `TabState`, `EntitySnapshot`）

### 機能モジュール

- **snap.ts** — 頂点スナップ計算。他部屋の頂点・辺への近接スナップ（`findVertexSnap`）。頂点優先・辺フォールバックのアルゴリズム。`polygon.ts` の `getRoomVertices` / `projectPointOnSegment` を利用
- **polygon.ts** — 四角形（非直角）部屋のユーティリティ。点の包含判定（`pointInQuad`）、重心計算（`quadCentroid`）、AABB更新（`updateRoomBBFromVertices`）、辺の端点取得（`quadEdgeEndpoints`）、辺の長さ計算（`quadEdgeLength`）、頂点ハンドル計算（`getVertexHandles`）、頂点ハンドルのヒット判定（`hitVertexHandle`）。25テスト追加
- **room.ts** — 部屋の生成（`createRoom`）、Canvas描画（`drawRoom`）、ヒット判定（`hitRoom`, `hitHandle`）、リサイズハンドル計算（`getHandles`）、矩形包含判定（`findRoomsInArea`）、ドラッグ矩形の正規化（`normalizeArea`）、範囲選択プレビュー描画（`drawAreaSelectPreview`）、グループBB計算（`computeGroupBoundingBox`）・ハンドル（`getGroupHandles`, `hitGroupHandle`）・アンカー計算（`getAnchorForDir`）・スケーリング（`computeGroupScale`, `applyGroupScale`）・BB描画（`drawGroupBoundingBox`）。四角形部屋の描画・ヒット判定分岐あり（`vertices`設定時は`polygon.ts`の関数を使用）
- **free-text.ts** — 自由配置テキスト（FreeText）の生成（`createFreeText`）、描画（`drawFreeText`, `drawFreeTextHandles`）、ヒット判定（`hitFreeText`, `hitFreeTextHandle`）、範囲検索（`findFreeTextsInArea`）、リサイズ計算（`computeFreeTextResize`）。部屋に紐付かず、グリッド座標で自由配置。front/backの2レイヤーで描画順を制御
- **free-stroke.ts** — フリーペイントストローク（FreeStroke）の生成（`createFreeStroke`）、描画（`drawFreeStroke`, `drawFreeStrokeBounds`）、ヒット判定（`hitFreeStroke`, `hitFreeStrokeInList`）、バウンディングボックス計算（`getStrokeBounds`）、移動（`moveStroke`）、点列間引き（`simplifyPoints` — Douglas-Peuckerアルゴリズム）、直線制約（`constrainToLine` — 8方向スナップ）。ピクセル座標（ワールド座標系）で自由描画、常に最前面レイヤーに描画
- **interior-object.ts** — 部屋内オブジェクト（階段・マーカー）の生成（`createStraightStairs`, `createFoldingStairs`, `createMarker`）、描画（`drawInteriorObjects`）、ヒット判定（`hitInteriorObject`, `hitInteriorObjectInRooms`）、ハンドルヒット判定（`hitInteriorObjectHandle`, `hitInteriorObjectHandleInRooms`）、クランプ処理（`clampInteriorObject`, `clampAllInteriorObjects`）、移動/リサイズ計算（`computeInteriorObjectMove`, `computeInteriorObjectResize`）。マーカーは死体（チョークアウトライン）・ピン（アイコン+ラベル）・テキスト（ラベルのみ）の3種類で、ラベルのフォントサイズはリサイズに追従。カメラの描画は `camera.ts` に委譲
- **camera.ts** — 防犯カメラ（SecurityCamera）の生成（`createSecurityCamera`）、カメラアイコン描画（`drawCameraIcon`）、視野コーンオーバーレイ描画（`drawCameraFovOverlay`）、FOVハンドル描画（`drawCameraHandles`）・ヒット判定（`hitCameraHandle`, `hitCameraHandleInRooms`）、回転・FOV角度・FOV距離の計算（`computeCameraAngle`, `computeCameraFovAngle`, `computeCameraFovRange`）。FOVコーンは2パスレンダリングで部屋の外まで描画可能
- **wall-object.ts** — 壁オブジェクト（窓・ドア・開口）の生成（`createWallWindow`, `createWallDoor`, `createWallOpening`）、描画（`drawWallObjects`）、ヒット判定（`hitWallObject`, `hitWallObjectInRooms`）、エッジヒット判定（`hitWallObjectEdge`, `hitWallObjectEdgeInRooms`）、リサイズ計算（`computeWallObjectResize`）、オーバーラップ判定（`wouldOverlap`）、ピクセル座標変換（`wallObjectToPixelRect`）、壁セグメント分割（`getWallSegments`）。ドアはヒンジ点から弧を描くビジュアルで、扇形エリア全体がヒット対象
- **context-menu.ts** / **ContextMenu.tsx** — 壁の右クリックコンテキストメニュー（窓・ドアの追加・削除・開き方向切替）。ReactコンポーネントとしてCanvas上にオーバーレイ表示
- **adjacency.ts** — 隣接部屋の壁オブジェクト自動同期。壁面の対面取得（`getOppositeSide`）、隣接部屋検索（`findAdjacentRoomsOnWall`）、offset座標変換（`convertOffset`）、ペア開口の同期（`syncPairedOpening`）・削除（`removePairedOpening`）・全再構築（`syncAllPairedOpenings`）、自動生成開口の判定（`isAutoGeneratedOpening`）
- **link.ts** — 部屋の連結機能。隣接判定（`areAdjacent`）、選択のグループ拡張（`expandWithLinked`）、連結/解除（`linkRooms`, `unlinkRooms`）、孤立グループのクリーンアップ（`cleanupSingletonGroups`）、連結グループインジケーター描画（`drawLinkGroupIndicators`）・色生成（`linkGroupColor`）
- **lookup.ts** — ID検索ヘルパー（`findRoomById`, `findRoomIndexById`, `findFreeTextById`, `findFreeStrokeById`, `findWallObjectById`, `findInteriorObjectById`）。editor/外のモジュールからも利用される共通ユーティリティ
- **z-order.ts** — 部屋の重なり順序操作（`bringToFront`, `sendToBack`, `bringForward`, `sendBackward`）。rooms配列のインデックスをin-placeで変更する純粋関数群
- **selection.ts** — `Set<string>` ベースの選択状態管理
- **history.ts** — Undo/Redoスタック（JSON snapshot方式、各最大50件）。`saveUndoPoint()` でUndoへのpushとRedoクリアを一括実行
- **grid.ts** — グリッド定数（`GRID=20px`）とビューポート対応のグリッド描画
- **project-store.ts** — マルチプロジェクト対応のlocalStorageストレージ層。プロジェクトindex・プロジェクトデータ・タブ状態のCRUD、旧形式からの自動マイグレーション、デフォルト名生成（`deduplicateName`）、プロジェクト複製（`duplicateProject`）。開発モード時はREST API経由でファイルストレージへの自動同期機能を提供
- **persistence.ts** — データバリデーション（`parseStorageData`）、JSON/PNGエクスポート、ファイルインポート

### サーバーサイド（開発時のみ）

- **server/api-plugin.ts** — Viteプラグイン。`configureServer` フックでREST APIミドルウェアを登録。`GET/POST/PUT/DELETE /api/projects` エンドポイントを提供
- **server/project-store-fs.ts** — ファイルベースのプロジェクトストレージ。`data/index.json`（メタデータ）と `data/projects/{id}.json`（プロジェクトデータ）をatomic write（一時ファイル→rename）で読み書き。`persistence.ts` のバリデーション関数を再利用

### CLIツール

- **cli/describe.ts** — プロジェクトJSONを読み取り、部屋一覧・壁オブジェクト・隣接関係・インテリアオブジェクト・フリーテキスト・矢印などを人間/AI可読な形式で出力。`adjacency.ts` の隣接判定ロジックを再利用
- **cli/validate.ts** — プロジェクトJSONの整合性チェック。部屋サイズの正値検証、壁オブジェクトのoffset範囲検証、pairedWith参照の相互整合性、部屋の重なり検出

## モジュール依存関係

```
main.ts
  ├─ App.tsx
  │   ├─ editor/index.ts (initEditor)
  │   │   ├─ editor/context.ts (EditorContext, EditorCallbacks, EditorAPI)
  │   │   ├─ editor/render.ts → room.ts, polygon.ts, wall-object.ts, camera.ts, free-text.ts, free-stroke.ts, snap.ts, grid.ts, lookup.ts
  │   │   ├─ editor/project.ts → history.ts, selection.ts, room.ts, adjacency.ts, free-stroke.ts
  │   │   ├─ editor/gesture.ts → viewport.ts, history.ts, editor/context-menu-handler.ts
  │   │   ├─ editor/mouse-down.ts → room.ts, polygon.ts, wall-object.ts, interior-object.ts, camera.ts, free-text.ts, free-stroke.ts, link.ts, lookup.ts
  │   │   ├─ editor/mouse-move.ts → room.ts, wall-object.ts, interior-object.ts, camera.ts, free-text.ts, free-stroke.ts, adjacency.ts, snap.ts, lookup.ts
  │   │   ├─ editor/mouse-up.ts → room.ts, wall-object.ts, free-text.ts, free-stroke.ts, adjacency.ts, lookup.ts
  │   │   ├─ editor/context-menu-handler.ts → room.ts, wall-object.ts, interior-object.ts, camera.ts, free-text.ts, free-stroke.ts, z-order.ts, link.ts, adjacency.ts, lookup.ts
  │   │   ├─ editor/clipboard.ts → adjacency.ts, wall-object.ts, editor/project.ts
  │   │   ├─ editor/keyboard.ts → z-order.ts, link.ts, adjacency.ts, viewport.ts, editor/clipboard.ts
  │   │   ├─ editor/wheel.ts → viewport.ts
  │   │   ├─ editor/dblclick.ts → room.ts, interior-object.ts, free-text.ts, editor/marker-edit.ts
  │   │   └─ editor/utils.ts → grid.ts, viewport.ts
  │   ├─ project-store.ts → persistence.ts (parseStorageData), viewport.ts
  │   ├─ TabBar.tsx → @mui/material (Tabs, Tab, IconButton), ContextMenu.tsx, context-menu.ts
  │   ├─ ProjectListModal.tsx
  │   ├─ RoomDialog.tsx, MarkerDialog.tsx, FreeTextDialog.tsx → LabelFontSizeDialog.tsx
  │   ├─ ContextMenu.tsx → context-menu.ts
  │   ├─ ShortcutHelpDialog.tsx → platform.ts
  │   └─ persistence.ts
  └─ style.css

server/api-plugin.ts (Viteプラグイン)
  └─ server/project-store-fs.ts → persistence.ts, viewport.ts

cli/describe.ts → persistence.ts, adjacency.ts
cli/validate.ts → persistence.ts
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

`EditorState` が単一の状態オブジェクトとしてアプリケーション全体の状態を保持する。各イベントハンドラは `EditorContext` オブジェクトを通じて状態・viewport・コールバック・描画関数にアクセスする。クラスではなく関数型スタイルを維持するため、コンテキストオブジェクトパターンを採用している。

- `rooms: Room[]` — 全部屋データ
- `freeTexts: FreeText[]` — 自由配置テキストデータ
- `freeStrokes: FreeStroke[]` — フリーペイントストロークデータ
- `selection: Set<string>` — 選択中の部屋/FreeText/FreeStrokeのID
- `history: string[]` — Undoスナップショット（JSON文字列）
- `drag: DragState` — ドラッグ操作の状態（discriminated union: `create | areaSelect | move | resize | groupResize | moveVertex | moveWallObject | resizeWallObject | moveInteriorObject | resizeInteriorObject | moveFreeText | resizeFreeText | rotateCameraAngle | adjustCameraFovAngle | adjustCameraFovRange | paint | moveStroke | pan | null`）
- `mouse: MouseCoord` — 現在のマウス座標
- `paintMode: boolean` — ペイントモードON/OFF
- `paintColor: string` / `paintLineWidth: number` / `paintOpacity: number` — 現在の描画設定

状態変更は `commitChange()` を通じて行い、Undo履歴の保存・Canvas再描画・`onAutoSave` コールバック呼び出しをまとめて実行する。

## マルチプロジェクト管理

アプリケーションは複数プロジェクトをlocalStorageで管理する。

**localStorageキー:**
| キー | 内容 |
|------|------|
| `yakata_project_index` | `ProjectMeta[]` — 全プロジェクトのメタデータ（ID・名前・作成日・更新日） |
| `yakata_project_{id}` | `ProjectData` — プロジェクトごとのデータ（rooms, freeTexts, viewport, history） |
| `yakata_tab_state` | `TabState` — 開いているタブの状態（openTabs, activeTabId） |

**データフロー:**
- エディタの `onAutoSave` / `onViewportChange` コールバック → App.tsx の `saveCurrentProject()` → `project-store.ts` の `saveProjectData()`
- タブ切り替え時: 現在のプロジェクトを保存 → 新プロジェクトをロード → `EditorAPI.loadProjectState()` でエディタの全状態を置換
- `updatedAt` の更新はdebounce付き（2秒）で、高頻度の保存イベントでindex読み書きが毎回走るのを防止

**マイグレーション:** 初回アクセス時に旧 `madori_data` / `madori_viewport` キーから新形式に自動移行し、旧キーは削除される。

## AI/CLIアクセス（開発時のみ）

開発サーバー起動時、ViteプラグインがREST APIを提供し、ブラウザのlocalStorageと同期してファイルストレージにプロジェクトデータを保存する。

**ファイルストレージ:**
| パス | 内容 |
|------|------|
| `data/index.json` | `ProjectMeta[]` — 全プロジェクトのメタデータ |
| `data/projects/{id}.json` | `ProjectData` — 個別プロジェクトデータ |

**REST API:**
| メソッド | パス | 動作 |
|---------|------|------|
| `GET` | `/api/projects` | プロジェクト一覧（`ProjectMeta[]`） |
| `POST` | `/api/projects` | 新規プロジェクト作成（body: `{ name?: string }`） |
| `PUT` | `/api/projects` | プロジェクトindex全体保存（body: `ProjectMeta[]`） |
| `GET` | `/api/projects/:id` | プロジェクトデータ取得（`{ meta, data }`） |
| `PUT` | `/api/projects/:id` | プロジェクトデータ保存（body: `ProjectData`） |
| `DELETE` | `/api/projects/:id` | プロジェクト削除 |

**同期フロー:**
- ブラウザ起動時: `syncAllToServer()` で全localStorageプロジェクトをサーバーに送信
- 保存時: `saveProjectData()` / `saveProjectIndex()` がlocalStorage保存と同時にAPI呼び出し（fire-and-forget）

**CLIツール:**
- `npx tsx src/cli/describe.ts [id|path]` — 間取り構造の可読出力
- `npx tsx src/cli/validate.ts [id|path]` — データ整合性チェック
