# 🎮 Steam Wishlist Ranker

Steamのウィッシュリストを、ゲーム感覚で選んでいくだけで「次に買う順」に並べ替え、そのままSteamに反映できる無料Webアプリです。

## 🌐 公開URL
https://steam-wishlist-ranker.pages.dev

## 📖 遊び方の流れ
1. SteamID64を入れてウィッシュリストを読み込む（APIキー不要・ウィッシュリストは公開設定）
2. 気になるゲームをタップ（全体の3割くらいが目安）
3. 4枚バトル（予選）：4本から「一番欲しい」と「一番いらない」を選ぶ
4. 上位だけの1対1 ＋ 乱入戦（選ばなかったゲームが自動で挑戦、3連勝で王座戦）
5. 決勝トーナメント（上位16本）
6. 仕上げ（任意）：中位整理 / 最弱決定戦
7. 結果画面で確認・ドラッグで微調整（上位／中位／下位／最下位の表示）
8. ランキング入りのブックマークでSteamのウィッシュリストに反映

## ✨ 機能
- グリッド選択 → 4枚バトル → 上位1対1 → 決勝トーナメントの段階式ランキング（Eloレーティング）
- 乱入戦・中位整理・最弱決定戦で、選ばなかったゲームも取りこぼさず整理
- 周回ごとに「もう1周」か「次へ進む」かをおすすめ表示
- セール中・割引率・Steam過去最安値（IsThereAnyDeal）・買い時バッジ
- キーボード操作（数字キー・テンキー・矢印キー・Enter・Backspace）
- 一つ戻る、途中保存（前回の続きから）
- 結果画面のドラッグ並び替え、Xシェア（画像付き）
- ブックマークレットでSteamのウィッシュリストへ反映
- 6言語対応（日本語 / English / 简体中文 / Русский / Português / Deutsch）
- 完全無料・登録不要

## 🛠 技術構成

| 項目 | 内容 |
|------|------|
| フロントエンド | HTML / CSS / JavaScript（単一ファイル・ES5） |
| ホスティング | Cloudflare Pages（Cloudflare Web Analytics） |
| API中継 | Cloudflare Workers |
| データ取得 | Steam IWishlistService / Steam Store API / IsThereAnyDeal API |
| ライブラリ | html2canvas、Sortable.js |
| データ保存 | LocalStorage（サーバー保存なし） |

## 🔧 セットアップ

### Cloudflare Workers
1. Workers & Pages → Create Worker で Worker を作成し、`worker.js` をデプロイ
2. 過去最安値を表示する場合は、Settings → Variables and Secrets に `ITAD_KEY`（IsThereAnyDeal のAPIキー）を追加
3. `index.html` の `WORKER_URL` を発行されたURLに変更

### Cloudflare Pages
1. Workers & Pages → Pages でこのリポジトリと連携して Deploy（ビルドなし・出力はルート）
2. main ブランチへの push で自動デプロイ

## 📁 ファイル構成
```
steam-wishlist-ranker/
├── index.html        # メインアプリ（全機能含む）
├── privacy.html      # プライバシーポリシー（日本語）
├── privacy-en.html   # プライバシーポリシー（英語）
├── ads.txt           # AdSense用
├── sitemap.xml       # サイトマップ
├── ogp.png           # OGP画像
└── google[...].html  # Google Search Console確認用
```

## 🔒 プライバシー
- SteamID64・進行状況・設定はブラウザのLocalStorageにのみ保存
- ウィッシュリスト取得時のみ、Cloudflare Workers経由でSteamに送信（ログはOFF）
- 過去最安値の表示のため、ゲームのApp IDのみIsThereAnyDealに送信
- Steamへの反映はブラウザ内のブックマークレットで行い、運営者のサーバーには何も送らない

## 💰 収益化
- Google AdSense（審査中）
- Ko-fi（任意の寄付）

## 📝 ライセンス
MIT License

## 🙏 クレジット
- [html2canvas](https://html2canvas.hertzen.com/)
- [Sortable.js](https://sortablejs.github.io/Sortable/)
- [IsThereAnyDeal](https://isthereanydeal.com/)
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Cloudflare Pages](https://pages.cloudflare.com/)
