<p align="center">
  <img src="assets/branding/hera-hero.png" alt="夜景を背景にターミナルを紹介する、オフィススーツ姿のオリジナルアニメキャラクター Hera" width="960">
</p>

<h1 align="center">Hera</h1>
<p align="center"><strong>ターミナルで一緒に働く、あなたのコーディングパートナー。</strong></p>
<p align="center"><a href="README.md">English</a> · <a href="README.ko.md">한국어</a> · <strong>日本語</strong></p>
<p align="center"><a href="https://github.com/NotNull92/heraAgent/actions/workflows/ci.yml"><img src="https://github.com/NotNull92/heraAgent/actions/workflows/ci.yml/badge.svg" alt="Windows・macOS CI"></a></p>

Hera は **Windows と macOS** で動作するローカル CLI/TUI コーディングエージェントです。
変更したい内容を伝えると、プロジェクトの読み取り、ファイル編集、検証、結果の報告までを
同じ会話の中で進めます。ツール、セッション、協調作業には **Codex App Server** を使い、
GPT と OpenCode Go の役割を明示的に選択できます。

**開発プレビュー · 0.1.0-alpha.1 · 固定 Codex API ランタイム 0.161.0。**
ソースは公開されていますが、npm パッケージや GitHub Release はまだ公開していません。
以下の手順でソースから起動してください。Hera 自体はローカルで動作しますが、モデルの
推論には利用者自身のプロバイダーアカウントを使います。オフラインのモデル実行環境ではありません。

## Hera でできること

- **編集と検証をひとつの作業で：** 別途 `/apply` を実行する必要はありません。
- **編集前に計画：** `/plan` は読み取り専用、`/diff` は実際の Git 差分を表示します。
- **モデルの役割を選択：** GPT のみ、GPT と Go ワーカー、DeepSeek と GPT の推論支援。
- **公開 Web の調査：** 有料検索 API を使わず、ローカルの Playwright/Chromium で検索・ページ取得。
- **会話を再開：** ネイティブセッションを利用し、Hera 独自の会話データベースは追加しません。
- **ターミナル操作：** スラッシュコマンド候補、モデル・推論強度メニュー、韓国語入力、韓国語・英語表示。

## クイックスタート

**Git**、**npm を含む Node.js 24.x**、ターミナル、公式ログインで利用する OpenAI
アカウント、OpenCode Go キーが必要です。**現在の TUI は GPT のみのモードでも両方の
プロバイダー設定を確認します。** 認証情報は同梱していません。自分のアカウントを使用してください。
利用できるモデルはアカウントによって異なります。

CI 対象は Windows x64 と Apple Silicon macOS です。Intel macOS は未検証です。
画面の対応言語は韓国語と英語です。この日本語 README は文書の翻訳であり、日本語 UI の提供ではありません。

### 1. クローンしてビルド

**Windows — ネイティブ PowerShell：**

```powershell
git clone https://github.com/NotNull92/heraAgent.git
if ($LASTEXITCODE -ne 0) { throw 'Clone failed' }
Set-Location heraAgent
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Install failed' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
node bin/hera.mjs --version
```

**macOS — ターミナル：**

```sh
git clone https://github.com/NotNull92/heraAgent.git
cd heraAgent
npm ci
npm run build
node bin/hera.mjs --version
```

別のツールが `hera` コマンドを使っていても、明示的な起動パスなら衝突を避けられます。
プロジェクト専用ランタイムは、グローバルにインストールされた Codex を置き換えません。

### 2. ログインしてモデルを選択

クローンしたディレクトリで実行します。両 OS で共通です。

```text
node bin/hera.mjs auth login openai
node bin/hera.mjs auth login go
node bin/hera.mjs init --list-models
node bin/hera.mjs init --model "YOUR_MODEL_ID" --language en
```

`YOUR_MODEL_ID` をカタログに表示された正確な ID に置き換えてください。
GPT ワーカーを設定する場合は `--worker-model "YOUR_WORKER_MODEL_ID"` も指定します。
推論強度は選択モデルが対応する値を使います。カタログへの掲載は利用権限の証明ではありません。
OpenAI ログインは `--device` にも対応します。Go キーはマスク入力し、OS キーリングに保存します。

**Windows のみ：** Hera の分離されたプロファイルに公式サンドボックスを設定します。

```text
node bin/hera.mjs sandbox setup
```

### 3. 状態を確認して起動

```text
node bin/hera.mjs doctor --json
node bin/hera.mjs --cwd "PATH_TO_YOUR_PROJECT" --single-agent
```

プロジェクトのパスを実在するディレクトリに置き換えてください。まずはワーカーを明示的に
無効にする GPT のシングルエージェント構成で始めます。プロバイダー設定が不足していると
設定メニューが開きます。編集はネイティブのワークスペースサンドボックス内で行い、追加権限は
一度だけ許可するか拒否できます。無制限の実行モードへ自動移行することはありません。

複数行のリクエストや非対話実行：

```text
node bin/hera.mjs --cwd "PATH_TO_YOUR_PROJECT" run --single-agent --prompt-file "request.txt"
```

リクエストファイルが起動ディレクトリの外にある場合は絶対パスを使ってください。
非対話実行では、対話が必要な権限リクエストを拒否します。

## モードを選ぶ

| モード | メインの作業 | 委任する作業 |
| --- | --- | --- |
| `gpt_only` | 選択した GPT モデル | 選択した GPT ワーカー。`--single-agent` ではワーカーなし |
| `external_workers` | 選択した GPT モデル | OpenCode Go · DeepSeek V4.1 Flash |
| `adaptive` | OpenCode Go · DeepSeek V4.1 Flash | 難しい推論・計画・設計を選択した GPT/Astra ロールへ |

`/mode` で切り替えます。**ワーカーにはローカル検証が必要です。** ランタイム、関連コード、
プラットフォーム、モデル、プロバイダー、権限、並列数が検証記録と一致する必要があり、変更すると記録は
無効になります。混合・adaptive モードは、レビュー済みのネイティブランタイムを Hera ホームに
別途インストールする必要があります。キーを保存するだけでは有効にならず、自動的な他プロバイダーへの
フォールバックも行いません。

adaptive の `/model main` と `/effort main` は GPT 推論ロールの設定です。
新しい会話は短い共通指示で始まり、コーディング時に完全なコーディング手引きを、
設計・調査時に専用の手引きを読み込みます。ローカルツールがウェブ接続なしで同梱の
二つの手引きだけを読み込み、同じネイティブ会話の履歴から
再利用します。ツール定義・プロジェクト指示・既存の履歴は引き続き文脈に含まれ、
後で雑談に戻っても読み込み済みの手引きは履歴から削除されません。

開発中のチェックアウトでは `/effort worker` で Go の `low`、`high`、`max` を選べますが、
有効な推論強度の変更では v2 検証が維持されます。GPT の選択肢はモデルカタログに従います。
`/workers` はプロジェクトの制限内で 1–8 の同時実行上限を設定するもので、実行中の数ではありません。
設定は次の入力の新しいネイティブセッションから適用され、Hera の再起動は不要です。
処理中の変更は拒否され、古い v1 検証記録には再検証が必要です。

[ネイティブランタイムの導入・検証](experiments/codex-provider-routing/README.md)と
[互換性](docs/compatibility.md)を参照してください。開発者の検証結果だけで別の PC が有効になる
わけではありません。認証情報や承認記録をコピーして検証を回避しないでください。

## コマンドとキー

`/` を入力すると候補が表示されます。文字入力で絞り込み、上下キーで選択、Tab で補完、
Enter で実行、Escape で閉じます。**コマンドの接頭辞は `/` のみです。**
先頭のバックスラッシュは通常の文字で、貼り付けたコマンドもテキストとして扱います。

| コマンド | 用途 |
| --- | --- |
| `/help` | コマンドヘルプ |
| `/model`、`/effort`、`/workers` | モデル・推論強度・ワーカー上限のメニュー |
| `/mode`、`/providers` | エージェントモードとプロバイダーログイン |
| `/research` | 調査の設定・状態・CAPTCHA 操作 |
| `/plan <リクエスト>` | 読み取り専用の計画 |
| `/diff`、`/resume <ID>` | Git 差分とセッション再開 |
| `/doctor`、`/quit` | 準備状況の確認と終了 |

メニューは上下キー、Enter、Escape で操作します。
`/model main <catalog-id> high`、`/workers 3` のように引数も直接指定できます。

| キー | 動作 |
| --- | --- |
| Enter | 入力を送信 |
| バックスラッシュ + Enter / Ctrl+J | 改行 |
| Shift/Alt + Enter | ターミナルがキーを伝達できる場合に改行 |
| 上 / 下 | 送信済み入力の呼び出し、またはメニュー移動 |
| Escape | 処理を中断。2 回押すと入力を消去 |
| Ctrl+C | 処理を中断。待機中は入力消去・終了待機、もう一度押すと終了 |
| Ctrl+Q | セッションを整理して終了 |

## 公開 Web の調査

`node bin/hera.mjs research setup` を一度実行して Chromium を導入するか、`/research` を
使用します。検索は DuckDuckGo、ページ取得は指定された公開サイトにアクセスします。
検索 API キーや有料検索への代替経路はありません。モデル利用はプロバイダーの利用枠を消費します。
リクエストは制限付きキューと 10 分間のキャッシュを共有します。

CAPTCHA は `/research open` から自分で解決し、`/research resume` の後で元のリクエストを
再送してください。個人のブラウザープロファイルは取り込みません。
公開検索に秘密情報や非公開プロジェクトの内容を含めないでください。

設計・調査では、相互に補完する調査、公開根拠の収集、結果の統合を行う DRD 指針を使います。
ワーカー上限や Web・委任を禁止する指示に従い、シングルエージェントはワーカーなしで対応します。
これはモデルへの指針であり、調査品質の保証ではありません。
[仕組みと制限](docs/web-research.md)。

## 更新とトラブルシューティング

Hera を終了し、ローカル変更を保護してからソースを更新します。

```text
git pull --ff-only
npm ci
npm run build
```

Windows では `npm.cmd` を使用してください。**`hera update` コマンドはまだありません。**
`codex update` が更新するのは別のグローバル CLI であり、Hera の固定ランタイムではありません。
混合ランタイムと検証記録も新しいバージョンに合わせる必要があります。レビュー済み `.tgz` の
インストールとロールバックは [Windows](docs/install-windows.md) / [macOS](docs/install-macos.md) を
参照してください。CI アーティファクトは公開リリースではありません。

| 状況 | 対処 |
| --- | --- |
| ログイン・キーが不足 | `/providers` または `auth login openai` / `auth login go` |
| ワーカーがブロックされる | `doctor` を確認。必要に応じて GPT の `--single-agent` を使用 |
| Windows サンドボックス未設定 | `sandbox setup` の後に `doctor --json` |
| 既存の `hera` と衝突 | ローカル起動パス、または独立したインストール先を使用 |
| 中断・結果不明の書き込み | Git 差分とネイティブ履歴を確認。無条件の再実行やロック削除を避ける |

設定とネイティブセッションは分離された Hera ホーム（既定：`~/.hera`）を使います。
`HERA_HOME` はプロジェクト外に置いてください。OpenAI は分離されたネイティブログイン、
Go は Windows 資格情報マネージャーまたは macOS キーチェーンを使用します。
`HERA_OPENCODE_GO_API_KEY` は、そのプロセスでは保存済み Go キーより優先されます。
`auth status go` は有無・保存元のみ表示し、`auth logout go` は保存済み項目を削除しますが
環境変数は削除しません。[セキュリティ](SECURITY.md)。

## 検証と開発

[公開 CI の記録](docs/public-transition-2026-10-08.md)には Windows x64・macOS arm64 それぞれ
86 件のオフラインテストと、同じパッケージの両 OS への導入結果があります。
記載されたコミットの結果であり、その後の未コミット変更は対象外です。
Windows の実モデル検証は別に記録されています。**macOS の実端末・実モデル検証は未実施です。**

開発時の検証：`npm run typecheck`、`npm test`、`npm run build`。
実モデル検証は明示的に選択して実行し、プロバイダーの利用枠を消費することがあります。
[進捗記録](docs/status.md)と[実装仕様](docs/implementation-spec.md)を参照してください。

## Hera ファミリー

このプロジェクトはターミナルのコーディングエージェントです。関連プロジェクトは実際の
エディターを操作するツールを提供しています。

- [hera-agent-unity](https://github.com/NotNull92/hera-agent-unity) — Unity エディター操作。
- [hera-agent-godot](https://github.com/NotNull92/hera-agent-godot) — Godot エディター操作。
- [hebe-agent-unity](https://github.com/NotNull92/hebe-agent-unity) — 軽量な Unity 実行ツール。

バナーの Hera は、新しくデザインした成人女性のオフィスウェア姿のキャラクターです。
ファミリー共通の金色の星をモチーフにしつつ、独自の外見を持たせています。
[アートワークについて](docs/branding.md)。

## ライセンス

現在は **UNLICENSED** です。リポジトリの公開はオープンソースライセンスの付与ではありません。
依存ソフトウェアの条件は[サードパーティー通知](THIRD_PARTY_NOTICES.md)を参照してください。
