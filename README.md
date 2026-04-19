# GitHub Pages 手機版發佈說明

這個資料夾已經整理成 GitHub Pages 用的手機版發佈內容。

## 目前部署資訊

- Repo：
  - `https://github.com/justO-arch/jol-battle-review`
- 手機網址：
  - `https://justo-arch.github.io/jol-battle-review/`

## 內容

- `index.html`
  - 由 `battle_review_mobile.html` 複製而來
  - 可直接作為 GitHub Pages 首頁

## 更新部署流程

1. 將最新手機版同步到：
   - `github_pages_mobile/index.html`
2. push 到：
   - `justO-arch/jol-battle-review`
3. GitHub Pages 會自動更新

本機同步來源：

- `/home/shen/JusticeOL/battle_review_mobile.html`

同步到 Pages 入口：

- `/home/shen/JusticeOL/github_pages_mobile/index.html`

## 使用方式

頁面上線後：

1. 用手機 Safari 打開網址
2. 按 `批量匯入目前所有資料`
3. 選擇覆盤資料 `json`

## 注意

- 這個頁面是前端工具
- 網址公開不代表資料公開
- 每個人仍需自行匯入 `json`
- 頁面資料主要存在各自裝置的 `localStorage`
- 匯入檔案必須使用：
  - `battle_review_export_*.json`
- 不可直接使用：
  - `jol_backup_*.json`
