---
paths:
  - "src/types.ts"
  - "src/persistence.ts"
  - "src/history.ts"
  - "src/editor/**"
  - "src/App.tsx"
  - "src/project-store.ts"
  - "src/server/**"
---

# エンティティ・型拡張時のデータパイプライン同期

## WallObject など discriminated union への型追加

`persistence.ts` の以下を必ず更新すること:

1. **バリデーション定数** — `VALID_WALL_OBJECT_TYPES` に新しい type 値を追加
2. **復元ロジック** — `ensureWallObjectIds` で新しい型固有のプロパティ（例: `WallDoor.swing`）を復元する分岐を追加

これを怠るとシリアライズは成功するがロード時にフィルタで除外され、リロードでデータが消失する。

## 新しいトップレベルエンティティ追加時

`EntitySnapshot` に新しい配列フィールド（例: `stickyNotes`）を追加した場合、**以下の全箇所**にフィールドを追加しないとリロードでデータが消失する:

1. **型定義** (`types.ts`) — `EntitySnapshot`, `EditorState`, `Project`, `ProjectData` の4つ
2. **永続化** (`persistence.ts`) — `ensureXxxIds()` バリデーション関数の追加、`parseStorageData` への組み込み
3. **履歴** (`history.ts`) — `popSnapshot` の復元オブジェクト
4. **エディタ** — `editor/utils.ts` (`getEntitySnapshot`), `editor/index.ts` (state初期化・`getState()`・`loadProjectState`), `editor/project.ts` (`applySnapshot`・`deleteSelectedEntities`・`newProject`・`loadProjectData`・`exportAsPng`)
5. **クリップボード** (`editor/clipboard.ts`) — `computeBoundingBox`, `copySelection`, `regenerateIds`, `applyMirrorHorizontal/Vertical`, `applyOffset`, `pasteClipboard`
6. **App.tsx** — `saveCurrentProject` のデストラクチャリングと保存オブジェクト、`loadProjectIntoEditor` のフォールバック
7. **localStorage ストア** (`project-store.ts`) — `loadProjectData` の `parseStorageData` 呼び出しと返却オブジェクト、`createNewProject` のデフォルトデータ
8. **サーバーAPI** (`server/api-plugin.ts`) — PUT ハンドラの `parseStorageData` 呼び出しと保存データ構築
9. **サーバーFS ストア** (`server/project-store-fs.ts`) — `loadProjectData` の `parseStorageData` 呼び出しと返却オブジェクト、`createNewProject`

特に **6〜9 は見落としやすい**。`ProjectData` の型で optional (`?`) にしていると TypeScript がエラーを出さないため、コンパイルは通るがランタイムでデータが消える。
