# GitHub Pages 發佈說明

這個資料夾目前同時承載：

- 手機版首頁
- 桌機版子路徑
- 相關規格 / 版本文檔

## 目前部署資訊

- Repo：
  - `https://github.com/justO-arch/jol-battle-review`
- 手機網址：
  - `https://justo-arch.github.io/jol-battle-review/`
- 桌機網址：
  - `https://justo-arch.github.io/jol-battle-review/desktop/`
- 文件路徑：
  - `https://justo-arch.github.io/jol-battle-review/docs/`

## 內容

- `index.html`
  - 由 `battle_review_mobile.html` 複製而來
  - 可直接作為 GitHub Pages 首頁
- `desktop/index.html`
  - 由 `battle_review.html` 複製而來
  - 作為桌機版入口
- `docs/`
  - 同步目前的相關 `.md`
  - 方便直接查看規格與版本紀錄

## 更新部署流程

1. 將最新手機版同步到：
   - `github_pages_mobile/index.html`
2. 將最新桌機版同步到：
   - `github_pages_mobile/desktop/index.html`
3. 視需要同步文件到：
   - `github_pages_mobile/docs/`
4. push 到：
   - `justO-arch/jol-battle-review`
5. GitHub Pages 會自動更新

本機同步來源：

- `/home/shen/JusticeOL/battle_review_mobile.html`
- `/home/shen/JusticeOL/battle_review.html`
- `/home/shen/JusticeOL/幫戰覆盤新頁規格.md`
- `/home/shen/JusticeOL/版本內容.md`

同步到 Pages 入口：

- `/home/shen/JusticeOL/github_pages_mobile/index.html`
- `/home/shen/JusticeOL/github_pages_mobile/desktop/index.html`
- `/home/shen/JusticeOL/github_pages_mobile/docs/`

實際部署流程：

1. 先修改：
   - `/home/shen/JusticeOL/battle_review_mobile.html`
2. 視需要修改：
   - `/home/shen/JusticeOL/battle_review.html`
   - `/home/shen/JusticeOL/幫戰覆盤新頁規格.md`
   - `/home/shen/JusticeOL/版本內容.md`
3. 再同步覆蓋：
   - `/home/shen/JusticeOL/github_pages_mobile/index.html`
   - `/home/shen/JusticeOL/github_pages_mobile/desktop/index.html`
   - `/home/shen/JusticeOL/github_pages_mobile/docs/`
4. 進入：
   - `/home/shen/JusticeOL/github_pages_mobile`
5. 執行：
   - `git add index.html`
   - `git add desktop/index.html`
   - `git add docs/*.md`
   - `git commit -m "update mobile page"`
   - `git push`

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

## 這輪手機版排查思路

- 如果出現：
  - 桌機模擬正常
  - 真手機直向異常
  - 真手機橫向正常
  應優先懷疑版型問題，不要先把問題全部歸因到輸入事件

### 玩家搜尋

- 本案實際上要先對照同頁正常區塊：
  - `職業表現` 搜尋區正常
  - `玩家查詢` 搜尋區異常
- 這代表問題更可能是局部區塊排版，而不是所有文字輸入都壞
- 排查時應優先看：
  - 手機單欄 layout
  - `grid-column span` 殘留
  - 是否有遮擋或擠壓

### 能力圖

- 本案實際問題不是圖比例本身，而是圖卡內容在手機上偏右
- 正確修法是：
  - 標題保持左對齊
  - 說明保持左對齊
  - 圖本體也左對齊，放在文字下方
- 不應把整張卡片一起置中或一起右移

### 不該再犯的錯誤

- 使用者說「圖太右邊」時，要先確認是哪一層元素偏掉
- 不能在還沒分清楚：
  - `svg`
  - 卡片容器
  - 標題容器
  之前，就直接改整張卡片的對齊
- 手機版 bug 應優先：
  - 小範圍修正
  - 真機驗證
  - 與正常區塊對照
