# プロジェクト構造 (structure.md)

## 📁 フォルダ構成

```text
Projects/Obsidian_Single_HTML_Exporter/
├── SPECS/              # SDD 仕様書（product, tech, structure, requirements...）
├── src/                # ソースコード
│   ├── main.ts         # プラグインのエントリポイント
│   ├── ui/             # 設定画面、モーダル等の UI コンポーネント
│   ├── exporter/       # エクスポート処理の中核ロジック
│   │   ├── controller.ts   # 全体パイプライン制御
│   │   ├── observer.ts     # レンダリング完了監視 (MutationObserver)
│   │   ├── packer.ts       # Single HTML 構築 (Data URI 置換)
│   │   ├── renderer.ts     # HTML レンダリング (MarkdownRenderer)
│   │   ├── resources.ts    # 画像・リソース解決
│   │   └── styles.ts       # CSS 抽出・結合
│   └── utils/          # 共通ユーティリティ
├── tests/              # テストコード
├── manifest.json       # プラグインの定義ファイル
├── package.json        # 依存関係定義
└── tsconfig.json       # TypeScript 設定
```

## 🏷️ 命名規則
- **ファイル名**: `kebab-case.ts` (例: `main.ts`, `packer.ts`)
- **クラス名**: `PascalCase` (例: `HtmlPacker`)
- **関数・変数名**: `camelCase` (例: `generateHtml`)
- **定数名**: `UPPER_SNAKE_CASE` (例: `DEFAULT_FILENAME`)

## 🏗️ アーキテクチャの方針
- **モジュール化**: 各工程（レンダリング、リソース収集、パッキング）を独立したモジュールとして実装し、単体テストを容易にする。
- **忍者作戦 (DOM接続)**: Mermaid 等の動的要素を確実に描画するため、レンダリング時のみ一時的に DOM に接続し、不可視状態で計算を走らせる。
- **Data URI 統合**: 画像リソースを Base64 文字列に変換し、HTML 文字列内の `src` 属性を Data URI (`data:image/...`) で直接置換することで、単一ファイル化を実現。
- **非同期処理**: ファイル読み込みやレンダリングは非同期 (async/await) で行い、UI をブロッキングしないように設計。

## 🛠️ インポートパターン
- 内部モジュールは相対パスを使用してインポート。
- Obsidian API は `import { ... } from "obsidian"` から一貫して取得。

## 🔗 その他設計の決定事項
- **セキュリティ**: ユーザーのローカルファイルを扱うため、安全なパス解決とファイル読み込みを徹底する。外部画像の取得には Obsidian の `requestUrl` を使用。
- **軽量性**: 外部パッケージへの依存を最小限に抑え、プラグインのサイズを小さく保つ。
