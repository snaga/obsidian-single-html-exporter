# テクノロジースタック (tech.md)

## 🛠️ プログラミング言語
- **TypeScript**: 強力な型定義により、Obsidian API との親和性と保守性を確保。

## 🏗️ フレームワーク & ライブラリ
- **Obsidian API**: プラグインのコア機能（レンダリング、ファイルシステムアクセス、テーマ管理）に使用。
- **esbuild**: 高速なビルドおよび TypeScript のトランスパイル。
- **(依存なし)**: Single HTML の生成ロジック（Data URI 置換、CSS 統合）は、ファイルサイズの軽量化と依存関係リスクの低減のため、標準 API と文字列操作で自作。

## 🧪 テストツール
- **Vitest / Jest**: ロジック（Data URI 置換、パス解析）のユニットテストに使用。
- **Obsidian Sample Plugin 構成**: 実機（Obsidian）での動作確認を主軸とする。

## 🔧 開発ツール
- **npm**: パッケージ管理。
- **ESLint / Prettier**: コード品質の維持と整形。
- **TypeScript Plugin テンプレート**: 公式のプラグイン開発テンプレートをベースに構築。

## 📦 インフラ / プラットフォーム
- **Obsidian 実行環境 (Electron)**: デスクトップ版（Windows/macOS/Linux）Obsidian をターゲットとする。
- **Node.js**: ファイル保存やビルドプロセス、およびデスクトップ版固有の API 利用に使用。

## 🔗 外部API / サービス
- **なし**: 完全にローカルで完結するツールとして設計。
