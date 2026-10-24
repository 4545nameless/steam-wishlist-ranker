# Steam Wishlist Ranker — 作業メモ（Claude 向け）

Steam のウィッシュリストを、ゲーム感覚の選択で「次に買う順」に並べ、ブックマークレットで Steam に反映する無料 Web アプリ。
公開: https://steam-wishlist-ranker.vercel.app（main へ push → Vercel 自動デプロイ）

## 進め方のルール（必ず守る）
- ユーザー（マスター）は日本語・カジュアル。返答も日本語で、結論から短く。
- **仕様が固まるまでは相談だけ**。大きな変更は、案を出して OK をもらってから実装する。
- 実装したら、構文チェックと動作確認をしてから「何を変えたか・何を確認したか・本物でしか確かめられないこと」を伝える。
- **JavaScript は ES5 のみ**（`var` と `function`。アロー関数・テンプレートリテラル・`let`/`const` は使わない。index.html 内の script）。
- index.html は **単一ファイル**（HTML / CSS / JS 全部入り）。外部ライブラリは html2canvas（unpkg）、Sortable.js（jsDelivr）のみ。
- 文言は **6 言語（ja / en / zh / ru / pt / de）すべて**に入れる。日本語だけ足さない。
- コミット・push はユーザーがやる（頼まれたときだけこちらで）。

## ファイル
- `index.html` … アプリ本体（約 350KB）
- `privacy.html` / `privacy-en.html` … プライバシーポリシー（機能を変えて送信先や保存内容が変わったら必ず更新）
- `README.md`、`sitemap.xml`、`ads.txt`（AdSense pub-5922701022521864）、`ogp.png`
- Cloudflare Worker のコードはリポジトリに入っていない（Cloudflare 上で管理）。

## 外部サービス
- Worker: `https://steam-wishlist-api.swranker.workers.dev`
  - `/wishlist?steamid=` … IWishlistService/GetWishlist（APIキー不要）。`items[{appid, priority, date_added}]`
  - `/appdetails?appid=` … Store API（6時間キャッシュ、cc=jp, l=japanese）
  - `/pricelow?appids=` … IsThereAnyDeal の Steam 過去最安値。Worker の秘密変数 `ITAD_KEY` が必要（無いと 501）
  - CORS は本番ドメインと localhost のみ。Cloudflare のログは OFF。
- Vercel Analytics、Google AdSense（審査中）、Ko-fi（https://ko-fi.com/4545nameless）

## 多言語の仕組み
- `LANGS[lang][key]` を `t(key)` / `fmt(key,{x})`、HTML は `data-l="key"`。
- `GUIDE_TEXT[lang][key]` を `gt(key)` / `gf(key,{x})`、HTML は `data-g="key"`（`renderGuideTexts()` で反映）。
- 新しい文言は `var FLOWn_ADD = { ja:{...}, en:{...}, ... }` ブロックを `function gt(key){` の直前に追加し、即時関数で GUIDE_TEXT にマージする方式（現在 FLOW13_ADD まで）。同じキーを後のブロックで上書きできる。

## 全体の流れ（state.flow.phase）
`grid` → `quad` → `duel` → `tour` → `done`（仕上げメニュー）⇄ `elim` → 結果画面
- 保存: localStorage `swr_v14`（state 全体）、`swr_steamid`。古い保存データ（flow 無し・phase `raid`）とも互換を保つこと。
- **grid**（`startGrid` / `finishGrid`）… 気になるゲームをタップ（目安3割）。選択=1650点、それ以外=1350点。選んだものが `f.pool`。
- **quad**（予選。`startQuadRound` / `quadPick` / `quadRoundComplete`）… 4本から最欲しい→最いらないの2タップ。周回後、上位 `topDuelN()` 本の入れ替わり数で「もう1周」か「上位へ」を★おすすめ表示（1周目は必ずもう1周、15%以下で上位へ、3周で上位へ）。
- **duel**（上位1対1。`startTopDuel` / `topDuelComplete`）… 上位 `f.topN` 本だけで `pairUp`（再戦回避 `pairHist`）。**乱入戦**が自動で混ざる（`raidInject`）。上位10の入れ替わり≤1本 or 3ラウンドで決勝を勧める。
  - 乱入戦: キュー要素 `[相手, 挑戦者, {r:段階}]`。挑戦者は常に右。1戦目=上位の下40%、2戦目=中位、3戦目=1位（王座戦・スポットライト）。勝つと倒した相手の直上に入り（`raidAfter`）、次戦をキューの直後に差し込む。負けたら終了。一つ戻るで差し込みも取り消す（history の `ins` / `rj`）。
  - 乱入者の選出（`pickRaiders`）: A=Steam の元の上位（priority）／B=買い時・セール中／C=最近追加（date_added）を 3:3:3、ランダム 1。並びが追加順のまま（`wishlistUnorganized`）なら A の枠は C へ。
- **tour**（決勝。上位16のシード制）→ 優勝後 `showFinMenu()`。
- **done / elim**（仕上げ）… 中位整理（`finMidIds`: プールの残り＋上位入りした乱入者、一番欲しいを選ぶ）と最弱決定戦（`finLowIds`: それ以外全部、一番いらないを選ぶ）。4本ずつ（端数は3・2本、`groupSizes`）の勝ち抜き。途中でやめても `elimApply` で反映。勝ち残り深さで順位をつけ、`reassignPoints` でその集団の点数枠内だけ並べ替える。
- 結果画面: ドラッグ並び替え（Sortable）、上位／中位／下位／最下位のラベル（`resultTiers`）、セール・最安値表示。
- 旧方式（予選スキップ、`f.skipped`）の1対1も残っている。

## 操作・演出
- キー（`handleKey`）: 4択は 1〜4、1対1は ←/1 →/2 ↑/3 ↓/4、Backspace/0 で戻る。テンキー可。
- ラウンド終了などの選択肢（`showFlowOverlay`）: **Enter=一番左（次へ／★おすすめ）、1・2・3=左から2番目以降**。ボタンにキー表示（スマホでは非表示）。
- 演出: 紙吹雪 `fxRain` / `fxBurst`、コンボ、トースト `fxToast`、スポットライト `#spot`、振動。`prefers-reduced-motion` を尊重。

## Steam への反映（重要）
- 方式: **ランキング（appid の並び）を埋め込んだブックマークレットを毎回作る**（`buildBookmarklet`）。結果画面「Steamに反映する」のモーダルで、黄色いボタンをブックマークバーへドラッグ → Steam のウィッシュリストで押す → 即並び替え・自動再読み込み。ブックマーク名に日時が入る。使い終わったら削除してもらう。
- 送信: `POST https://store.steampowered.com/wishlist/action/`、ヘッダ `Content-Type: application/json; charset=utf-8`、`x-valve-request-type: mutationAction`、`X-Requested-With: XMLHttpRequest`、body `{m:'Reorder', mp:[[{appid, priority}...]]}`。store.steampowered.com 上でのみ動く。
- 文字列は `jsEsc()` で非 ASCII をエスケープ。`#` は使わない（`String.fromCharCode(35)`）。
- クリップボード方式・URL ハッシュ方式は過去に試して、ユーザーの環境で入力欄が出たため廃止した。コンソール貼り付け方式も「allow pasting」警告のため不採用。
- ユーザーの希望: ブックマークを押したら即反映。2回目以降は作り直しでよい。

## テストのやり方
- 環境: Windows のローカルフォルダで Claude Code（デスクトップアプリ）から作業。Node.js / Python は未インストール。
- 動作確認は Claude Code のブラウザペインで行う。ただしブラウザペインは `file://` やローカルのサーバーを開けないので、確認できるのは本番 URL（push 後）。push 前に見たいときは、index.html を非公開の Artifact として公開して確認する（Worker の CORS で実データは取れないので「デモで試す」を使う）。
  - 「デモで試す」で始め、JS 実行で `finishGrid` / `quadPick` / `choose` / `elimPick` を直接呼んで通しプレイ。`choose` は 380ms 後に描画するので待つ。ラウンド間の選択肢はボタン文字に「Enter」が入っているものを押せば進む。1 回の JS 実行は 45 秒で打ち切られるので、30 秒程度で区切る。
- 構文: ブラウザペインで読み込んでコンソールにエラーが出ないこと。script 内に `=>`・バッククォート・`let`/`const` が 0 件かを検索で確認。
- スマホ幅（390px）で横スクロールが出ないこと（ブラウザペインの mobile 表示）。
- 本物の Steam への反映（ブックマークレット）はこちらでは試せないので、ユーザーに確認してもらう。

## 未確認・今後の候補
- 本物の Steam でのブックマーク反映は、PC でユーザーが確認済み。
- 実データ（約274本）で乱入者選出の A/C 枠が効くか（取得し直したセッションのみ priority / date_added を持つ）。
- 過去最安値: Worker の `/pricelow` は ITAD_KEY 設定済みで動作確認済み（2026-10-24）。サイト上での表示は実データで未確認。Worker のコードは `E:\ユーザー\Documents\worker.js`。
- ru / pt / de 訳は多少粗くてもよい（優先度低）。
- 予選・上位ラウンドの「やめどき」の基準値（15%、10位以内の入れ替わり1本以下）は仮。実データで調整。
- 好み分析パネル、効果音（デフォルトOFF）などは未実装の候補。
- AdSense 審査中。独自ドメインは検討中。
