# 🎮 Steam Wishlist Ranker

Steamのウィッシュリストを1対1で比較して、購入優先ランキングを作れる無料Webアプリです。

## 🌐 公開URL
https://steam-wishlist-ranker.vercel.app

## 📖 概要
Steamのウィッシュリストに登録したゲームを1対1で対決させて購入優先順位を決められます。
対決形式で直感的に選ぶだけで自分だけのランキングが完成し、最終的にSteamのウィッシュリストへ順番を反映することもできます。

## ✨ 機能
- 1対1の対決形式でランキング作成
- ELOレーティングによるスコアリング
- ラウンド制（精度を上げながら何周でも）
- 一つ戻るボタン
- どっちも欲しい / よく知らない オプション
- 下位ゲームのまとめて仕分け機能
- Steamウィッシュリストへの反映機能
- リザルト画面のXシェア機能（画像付き）
- 6言語対応（日本語 / English / 简体中文 / Русский / Português / Deutsch）
- 所持済みゲームの自動除外
- 前回の続きから再開可能（LocalStorage）
- 完全無料・登録不要

## 🛠 技術構成

| 項目 | 内容 |
|------|------|
| フロントエンド | HTML / CSS / JavaScript（単一ファイル） |
| ホスティング | Vercel |
| API中継 | Cloudflare Workers |
| データ取得 | Steam Web API / Steam Store API |
| 画像生成 | html2canvas |
| データ保存 | LocalStorage（サーバー保存なし） |

## 🔧 セットアップ（ローカル開発）

### 必要なもの
- Steam Web APIキー（[こちらで取得](https://steamcommunity.com/dev/apikey)）
- SteamID64（ウィッシュリストのURLの数字部分）

### Cloudflare Workersの設定
1. [Cloudflare](https://cloudflare.com/)でアカウント作成
2. Workers & Pages → Create Worker
3. `workers/worker.js` のコードをデプロイ
4. `index.html` の `WORKER_URL` を発行されたURLに変更

### Vercelへのデプロイ
1. このリポジトリをフォーク
2. [Vercel](https://vercel.com/)でGitHubと連携
3. リポジトリを選択してDeploy

## 📁 ファイル構成
steam-wishlist-ranker/
├── index.html # メインアプリ（全機能含む）
├── privacy.html # プライバシーポリシー
├── ads.txt # AdSense用
├── sitemap.xml # SEO用サイトマップ
├── ogp.png # OGP画像
└── google[...].html # Google Search Console確認用

## 🔒 プライバシー
- APIキーとSteamIDはブラウザのLocalStorageにのみ保存
- ウィッシュリスト取得時のみCloudflare Workers経由でSteam APIに送信
- サーバーへの個人情報の保存・記録なし
- Cloudflare WorkersのログはOFFに設定済み

## 📊 使用API
- [Steam IWishlistService/GetWishlist](https://partner.steamgames.com/doc/webapi)
- [Steam IPlayerService/GetOwnedGames](https://partner.steamgames.com/doc/webapi)
- [Steam Store API appdetails](https://store.steampowered.com/api/appdetails)

## 💰 収益化
- Google AdSense（審査中）
- Ko-fi（任意の寄付）

## 📝 ライセンス
MIT License

## 🙏 クレジット
- [html2canvas](https://html2canvas.hertzen.com/)
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Vercel](https://vercel.com/)