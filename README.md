# 極軸望遠鏡ガイド (Sky-Watcher)

Sky-Watcher 製赤道儀の極軸望遠鏡（0 を上にした 12 時間時計目盛り + 2012 / 2020 / 2028 年の 3 重円）向けに、
北極星（南半球ではσ Oct）の時角とレチクル上の位置を計算・表示する静的 Web ツールです。

## 機能

- 北極星の **時角** と **レチクルの時計位置**（倒立像 / 正立像を切り替え可能）
- 歳差 (IAU 2006)・章動 (IAU 1980 主要項)・年周光行差・固有運動を考慮した視位置
- 3 重円のどこに北極星を置けばよいかの目安と、歳差による極距離の年変化の拡大図
- 南半球ではσ・χ・τ・υ Oct（オクタンス座の台形）を表示
- 現在地の取得、時刻の追従 / 指定、暗視（赤色）モード
- URL パラメータで観測地を指定可能: `?lat=35.68&lon=139.77`

計算はすべてブラウザ内で完結し、外部ライブラリには依存しません。

## ローカルで動かす

```sh
python3 -m http.server -d docs 8000
# http://localhost:8000/ を開く
```

## テスト

astropy で計算した参照値と照合します（Node.js 22 以降）。

```sh
node --test tests/*.test.mjs
```

## GitHub Pages で公開

1. このリポジトリを GitHub に push します。
2. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にします。
3. `main` または `master` ブランチへの push で `.github/workflows/pages.yml` がテスト後に `docs/` をデプロイします。

（Actions を使わない場合は Source を「Deploy from a branch」にして `/docs` フォルダを指定しても動作します。）

## 精度について

- UT1 ≈ UTC、TT − UTC = 69.184 秒として計算しています。時角の誤差は 1 秒未満です。
- 大気差は考慮していません。
