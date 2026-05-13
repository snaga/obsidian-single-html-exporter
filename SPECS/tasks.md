# 実装タスク (tasks.md)

## フェーズ 1: 基盤整備 (MHTML 時代からの継承)
- [x] Task 1-1: プロジェクトの初期化とマニフェスト作成
- [x] Task 1-2: エントリポイントと設定クラスの作成

## フェーズ 2: コアロジック (Single HTML 向けに改修済み)
- [x] Task 2-1: `MarkdownHtmlRenderer` と `RenderingObserver` の実装
- [x] Task 2-2: `StyleManager` の実装 (ランタイム CSS 抽出)
  - 変更内容:
    - `StyleManager`: 現在のドキュメントから全スタイルシートを収集。
    - **強化**: CSS 内の `url()` 参照（画像、フォント）を抽出し、Data URI に置換する機能を追加。
- [x] Task 2-3: `ResourceManager` の実装 (リンク解決とバイナリ収集)
  - ※Data URI 化のロジックはここで完結。
  - **強化**: CSS 内の `url()` からのリソース収集に対応。フォント形式 (WOFF, TTF 等) の MIME タイプを追加。
- [x] Task 2-4: `HtmlPacker` の実装 (MHTML からの転換)
  - 変更内容:
    - `MhtmlPacker` を `HtmlPacker` にリネーム。
    - RFC 2557 (MIME) 構築ロジックを削除。
    - HTML 文字列内の `src` を Data URI で置換するロジックを実装。
  - テスト戦略: デトロイト派
    - 生成された HTML 内に `data:image/...` が正しく埋め込まれていることを検証。

## フェーズ 3: 統合と名称変更 (Single HTML 移行)
- [x] Task 3-1: プラグイン名称と識別子の更新
  - 変更内容:
    - `manifest.json`: 名前を "Obsidian Single HTML Exporter"、ID を "obsidian-single-html-exporter" (必要なら) に更新。
    - `package.json`: 名称と説明を更新。
    - `src/main.ts`: コマンド名を "Export to Single HTML" に変更。
- [x] Task 3-2: `ExportController` と保存ダイアログの調整
  - 変更内容:
    - `src/exporter/controller.ts`: `HtmlPacker` への移行。
    - `src/utils/file-system.ts`: デフォルト拡張子を `.html` に変更。
- [x] Task 3-3: 既存テストの修正とリファクタリング
  - 変更内容:
    - `tests/packer.test.ts`: Single HTML 形式の検証に書き換え。
    - `tests/controller.test.ts`: クラス名変更に伴う修正。
- [x] Task 3-4: 旧 MHTML 関連資産の整理
  - 変更内容:
    - `tools/` 内の `pack_mhtml.py`, `unpack_mhtml.py` 等, 不要になったスクリプトを `tools/archive_mhtml/` 等へ移動または削除する。
    - `README.md` や `DEV_TIPS.md` 内の MHTML に関する記述を Single HTML に合わせて更新する。

## フェーズ 4: 機能拡充と最終調整
- [x] Task 4-1: 数式 (MathJax) と図解 (Mermaid) の再現性確認
- [x] Task 4-2: 外部画像の自動ダウンロードとパッキング機能の実装
- [x] Task 4-3: ノートタイトルの表示と自動ブラウザ起動の実装
- [x] Task 4-4: 画像のオリジナルサイズ表示（別タブで開く）の実装
  - 変更内容:
    - 以前の CSS-only Lightbox 方式は Obsidian の複雑な CSS レイアウト下で位置がずれる問題があったため廃止。
    - 代わりに画像を `<a>` タグでラップし、クリックすると `_blank`（別タブ）で画像単体（Data URI）を開く方式に変更。
    - これにより、ブラウザの標準的なズーム・保存機能がそのまま使え、確実な表示が保証されるようになった。
  - テスト戦略: デトロイト派
    - 生成された HTML 内に画像をラップする `<a>` タグと `image-link` クラスが注入されていることを検証。
- [x] Task 4-5: YouTube 埋め込みのサムネイル置換実装
  - 変更内容:
    - `ResourceManager`: YouTube の `<iframe>` タグから動画 ID を抽出し、サムネイル画像をダウンロードしてリソース化するロジックを追加。
    - `HtmlPacker`: `<iframe>` タグを、サムネイル画像（Data URI）と YouTube へのリンク (`<a>`) を含む構造に置換する処理を追加。
    - **不具合修正**: `saved_resource.html` 等の中間ファイルを介した埋め込みにも対応（`v=` パラメータからの ID 抽出）。
    - **UI改善**: YouTube 公式風の再生ボタンオーバーレイを CSS で実装。
  - テスト戦略: ロンドン派
    - YouTube の埋め込みコードや中間ファイル経由のリンクが、正しくサムネイルリンク構造に変換されることを検証。
- [x] Task 4-6: 完全オフライン対応の強化
  - 変更内容:
    - `ExportController`: HTML だけでなく CSS からのリソースも収集するようにパイプラインを調整。
    - `HtmlPacker`: CSS 文字列内の URL を Data URI に置換するロジックを実装。
    - これにより、外部フォントや CSS 背景画像も 100% 埋め込まれるようになった。
- [x] Task 4-7: モダンブラウザの Data URI 遷移制限の回避 (Security Bypass)
  - 変更内容:
    - `HtmlPacker`: `injectDataUriBypassScript` を実装し、HTML の末尾に JS を注入。
    - `getAttribute('href')` を用いて Data URI を取得し、`window.open` + `document.write` で表示するロジックにより、`about:blank` になる不具合を修正。
  - テスト戦略: 実機確認（ブラウザでの動作検証）。

## フェーズ 5: パフォーマンス最適化
- [ ] Task 5-1: PurgeCSS による CSS 最適化の実装 (実験的) [保留]
