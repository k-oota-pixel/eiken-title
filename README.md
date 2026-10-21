# 英検 Reading Lab（Render版）
GitHubのリポジトリ直下に、このフォルダーの中身をアップロードします。
publicフォルダーもそのままアップロードしてください。

Render: New > Web Service > GitHubリポジトリを接続。
Language: Node / Branch: main / Root Directory: 空欄
Build Command: npm install
Start Command: npm start
Health Check Path: /health
Environment: GEMINI_API_KEY = ご自身のキー
任意: GEMINI_MODEL = 利用可能なテキストモデル名（既定 gemini-flash-latest）

APIキーをソースやHTMLに書き込む必要はありません。
APIキーは先生がRenderに設定し、生徒はURLから利用できます。

Renderを無料プランで利用する場合のスリープ等はRenderの最新条件をご確認ください。
参考: https://render.com/docs/deploy-node-express-app
参考: https://ai.google.dev/gemini-api/docs/api-key

ローカル確認: 環境変数GEMINI_API_KEYを設定して npm start。
API未設定でも４択モード（空所補充サイト）は使えます。
17題を収録。2025年度第2・3回のみ公式解答照合済み。他は推定解答です。

サーバーは登録された教材だけを判定し、入力長と同時アクセスを制限します。
本番Geminiの通信確認には有効なキーが必要です。

## 長文演習の要約API

`POST /api/reading/summary` を追加。本文ID・日本語/英語・要約（5〜2,000文字）を受け取り、サーバーの本文と照合してGeminiでフィードバックする。既存のタイトル判定API `/api/grade` は維持。

- 既存 `GEMINI_API_KEY` を使用。新しいキーは不要。
- モデルは `READING_GEMINI_MODEL` → `EIKEN_GEMINI_MODEL` → 既存既定モデルの順。
- `GET /api/reading/status` は教材件数と設定済みかだけを返す。キーは返さない。
- 許可Origin、リクエスト回数・同時実行制限は既存サーバーを共用。
- `reading-training/passages.json` は english-playroom の教材データと同一。
- 検証：`node --test reading-summary.test.js`（実際のAPIキー・有料リクエストは不要）。
