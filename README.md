# GitHub Pages 手機版發佈說明

這個資料夾已經整理成可直接拿去 GitHub Pages 發佈的版本。

## 內容

- `index.html`
  - 由 `battle_review_mobile.html` 複製而來
  - 可直接作為 GitHub Pages 首頁

## 最簡流程

1. 在 GitHub 建一個新的 repo
2. 把這個資料夾裡的 `index.html` 上傳到 repo 根目錄
3. 到 GitHub repo 的 `Settings`
4. 進 `Pages`
5. `Source` 選：
   - `Deploy from a branch`
6. `Branch` 選：
   - `main`
   - `/root`
7. 存檔後等待 GitHub 發佈完成
8. 用 GitHub Pages 網址在手機 Safari 開啟

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
