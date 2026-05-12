# 開発者向けの技術的なヒント (DEV_TIPS.md)

このドキュメントは、Single HTML Exporter の内部実装や、開発中に直面した技術的な課題とその解決策をまとめたものです。

## 1. HTML 出力におけるスタイル (CSS) の抽出と適用
- **課題**: Obsidian の `MarkdownRenderer` が出力する HTML を正しく表示するには、膨大な CSS が必要。
- **解決策**: `StyleManager` で現在読み込まれている全ての CSS (`document.styleSheets`) を取得し、それを HTML 内に埋め込む。
- **注意点**: Obsidian の CSS は `.app-container` や `.workspace` などの親要素に依存しているため、単体で表示するとレイアウトが崩れる。
- **対策**: `HtmlPacker` で CSS の一部を上書きする「Layout Override CSS」を注入する。
  ```css
  html, body { overflow: auto !important; height: auto !important; }
  .app-container, .markdown-reading-view, .markdown-preview-view { position: static !important; display: block !important; overflow: visible !important; width: 100% !important; height: auto !important; }
  .markdown-rendered { opacity: 1 !important; visibility: visible !important; height: auto !important; }
  ```

## 2. 外部画像の Data URI 化
- **課題**: 外部 URL の画像（Twitter 等）は `MarkdownRenderer` の出力後に非同期で読み込まれるため、即座に Data URI 化できない場合がある。
- **解決策**: `ResourceManager` で HTML 内の `<img>` タグの `src` をスキャンし、`fetch` を用いて画像をダウンロードしてリソース化する。
- **注意点**: YouTube の埋め込み（iframe）は、サムネイルを別途取得して置換するロジックが必要。

## 3. Mermaid の描画完了待機
- **課題**: Mermaid は非同期で SVG を描画するため、レンダリング直後の HTML を取得しても図が空になる。
- **解決策**: `MutationObserver` を使用して、特定のクラス（`.is-rendered` 等）が付与されるのを監視してから HTML を取得する。また、ユーザーが設定可能な `Rendering delay` を設けて安全性を確保。

## 4. 印刷用スタイルの調整
- **課題**: ブラウザの印刷機能（PDF 出力等）を使用すると、レイアウトが崩れたりコンテンツが欠けたりする。
- **解決策**: `@media print` を用いて、印刷時に不要な UI 要素を非表示にし、`height: auto` などを強制する。

## 5. 文字エンコーディング (UTF-8)
- **課題**: Windows 環境などで PowerShell を通じてファイルを読み書きすると、Shift-JIS との競合で文字化けが発生しやすい。
- **解決策**: 常に明示的に UTF-8 を指定してファイルを保存し、ドキュメントの整合性を保つ。

## 6. スタック文脈（Stacking Context）の罠
- **課題**: `position: fixed` を使ったオーバーレイ（Lightboxなど）が、スクロールすると位置がずれたり、ページ最上部に固定されたりする。
- **原因**: 親要素（`.app-container` など）に `transform`, `contain`, `filter` などが設定されていると、そこが基準点（Stacking Context）となり、`position: fixed` がビューポート（画面）基準で動かなくなる。
- **対策**: 
    1.  親要素の当該プロパティを `none !important` でリセットする。
    2.  それでも制御が難しい場合は、`target="_blank"` で別タブに逃がすなど、より堅牢な方式（ブラウザ標準機能の活用）に切り替える。
