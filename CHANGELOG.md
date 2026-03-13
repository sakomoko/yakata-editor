# Changelog

このプロジェクトの注目すべき変更はすべてこのファイルに記録されます。
フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠しています。

## [Unreleased]

## [0.1.0] - 2026-03-13

### Added

- グリッドベースの間取り図エディタの基本機能
  - 部屋の作成（ドラッグで矩形描画）
  - 部屋の選択・複数選択（Shift+クリック）
  - 部屋の移動・リサイズ（8方向ハンドル）
  - 部屋の削除（Delete/Backspace）
  - 部屋名のラベル編集（ダブルクリック）
- Undo機能（⌘Z / Ctrl+Z、最大50件）
- 保存・読み込み機能
  - localStorage自動保存
  - JSONファイルのエクスポート/インポート
  - PNG画像エクスポート
- Vite + TypeScript開発環境
- ESLint + Prettier + Vitestによるコード品質管理
