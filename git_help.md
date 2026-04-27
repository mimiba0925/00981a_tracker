# Git 與 GitHub 自動化同步設定指南

為了讓自動化腳本能「無阻礙地」將資料推送到 GitHub，**強烈建議使用「SSH 金鑰」**來認證。這樣腳本在執行時，就不會跳出詢問帳號密碼的視窗。

以下是一次性的準備動作（設定一次即可）：

## 第一步：設定本地端的 Git 身分
打開終端機 (Terminal)，告訴 Git 您是誰（這會顯示在每次的更新紀錄上）：
```bash
git config --global user.name "您的名字或暱稱"
git config --global user.email "您的信箱@example.com"
```

## 第二步：產生 SSH 金鑰 (為了讓腳本免密碼登入)
在終端機輸入以下指令產生金鑰（一路按 Enter 到底即可，**不要設定密碼 (passphrase)**，這樣腳本才能自動執行）：
```bash
ssh-keygen -t ed25519 -C "您的信箱@example.com"
```

接著，把這把剛剛產生的「公鑰」複製起來。您可以直接在終端機輸入這行指令，它會自動幫您複製到剪貼簿：
```bash
pbcopy < ~/.ssh/id_ed25519.pub
```

## 第三步：把公鑰貼到 GitHub
1. 登入您的 GitHub 帳號。
2. 點擊右上角的頭像 -> **Settings** -> 左側選單的 **SSH and GPG keys**。
3. 點擊綠色的 **New SSH key**。
4. Title 隨便取（例如：`Mac Auto Script`），然後把剛剛複製的內容貼到 **Key** 欄位裡面，按下 **Add SSH key**。

## 第四步：在 GitHub 建立專案並上傳網頁
1. 在 GitHub 首頁點擊 **New repository** 建立一個新專案（例如命名為 `00981a_tracker`）。請設為 **Public**，這樣才能使用免費的 GitHub Pages 架站。
2. 建立後，GitHub 會給您一串指令。請選擇 **SSH** 的網址。
3. 回到您的終端機，進到我們剛剛寫好網頁的資料夾執行：

```bash
# 進入專案資料夾
cd /Users/ryanyang/.gemini/antigravity/scratch/qlib_workspace/00981a_tracker

# 初始化 Git
git init
git add .
git commit -m "Initial commit - 00981a Tracker"
git branch -M main

# 連結遠端 GitHub 專案 (注意：請換成您自己專案的 SSH 網址)
git remote add origin git@github.com:您的帳號/00981a_tracker.git

# 推送代碼上雲端
git push -u origin main
```

完成這些步驟後，您的網頁和 CSV 就通通在 GitHub 上了！未來您的自動化腳本只要跑 `git add .`、`git commit` 跟 `git push`，就能暢通無阻地更新資料。
