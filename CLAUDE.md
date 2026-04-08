# CLAUDE.md

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

### Key Design Decisions

- 座標系は2種類: ピクセル座標(px, py)とグリッド座標(gx, gy)。マウス座標は通常グリッドにスナップ（Shift押下時はサブグリッド＝浮動小数点を許容）
- DragStateはdiscriminated union (`create | move | resize | null`)
- 部屋のヒット判定はz-order考慮(後に追加された部屋が優先)
- キャンバスは無限（固定境界なし）。グリッドは可視範囲のみ描画
- editor/ は `EditorContext` オブジェクトパターンで共有状態を管理。クラスではなく関数型スタイルを維持

## Testing

テストファイルは `src/` 内に `*.test.ts` として配置。Vitestを使用。
DOMに依存しないロジック層（history, selection, room計算）がテスト対象。

## コミット前チェック

コミット前に `npm run typecheck` と `npm run lint` を実行し、エラーがないことを確認する。エラーがある場合はコミットせず、先に修正する。

## GitHub CLI (`gh`) 利用ルール

- `gh pr create` でPR本文を渡すときは **`Write` ツールで `.pr-body.md` を作成** → `--body-file .pr-body.md` → 完了後 `rm .pr-body.md`。Bashでのヒアドキュメント・`$()`・`/tmp` 書き込みは権限チェックでブロックされるため禁止
- `gh issue create` では `--body "..."` で直接渡す。ただし `#` 見出しを含む場合は上記の `--body-file` 方式を使う
