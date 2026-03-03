# agent-web

**AI Agent 的統一網頁工具** — 一個 CLI/MCP，搞定內容抓取 + 瀏覽器操作。

[![npm version](https://img.shields.io/npm/v/agent-web)](https://www.npmjs.com/package/agent-web)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## 為什麼需要 agent-web？

| 現有工具 | 問題 |
|---------|------|
| agent-browser | 只能「操作」，不能「閱讀」 |
| agent-reach | 只能「閱讀」，不能「操作」 |
| Playwright MCP | 25+ 工具，token 爆炸 |

**agent-web = 閱讀 + 操作，統一介面，6 個精簡工具，token 省 90%。**

## 快速開始

```bash
# 一行安裝
npx agent-web doctor

# 抓取任意網頁內容
npx agent-web fetch https://example.com

# 抓取 YouTube 影片資訊 + 字幕
npx agent-web fetch https://youtube.com/watch?v=dQw4w9WgXcQ

# 抓取 GitHub repo
npx agent-web fetch https://github.com/vercel/next.js
```

## 核心功能

### 1. 智慧抓取（自動選最佳策略）

```bash
agent-web fetch <url>              # 自動偵測平台
agent-web fetch <url> --json       # JSON 輸出
agent-web fetch <url> --adapter youtube  # 強制指定 adapter
```

支援平台：

| 平台 | Adapter | 依賴 |
|------|---------|------|
| YouTube | yt-dlp | `brew install yt-dlp` |
| Twitter/X | xreach | `npm i -g xreach` |
| GitHub | gh CLI | `brew install gh` |
| Reddit | JSON API | 無 |
| Bilibili | yt-dlp | `brew install yt-dlp` |
| RSS/Atom | 內建 | 無 |
| 小紅書 | Cookie | 需設定 |
| 任意網頁 | Jina Reader | 無 |

### 2. 瀏覽器操作（snapshot + @ref）

```bash
# 開啟頁面，取得元素快照
agent-web open https://example.com

# 輸出：
# [@e1] textbox "Email"
# [@e2] textbox "Password"
# [@e3] button "Sign In"

# 用 @ref 操作元素
agent-web click @e3
agent-web fill @e1 "user@example.com"
agent-web fill @e2 "password"
agent-web screenshot
agent-web close
```

AI 只看到精簡的 `[@e1] button "Sign In"`，不用解析整頁 HTML，token 省 90%+。

### 3. 自我診斷

```bash
agent-web doctor

# 輸出：
# ✅ jina         ready
# ✅ youtube      yt-dlp 2024.12.06
# ⚠️  twitter      xreach not found
#    → Install: npm install -g xreach
# ❌ xiaohongshu  not configured
#    → agent-web config set platforms.xiaohongshu.cookies "..."
```

## MCP Server 整合

### Claude Code / Cursor

```json
{
  "mcpServers": {
    "agent-web": {
      "command": "npx",
      "args": ["-y", "agent-web", "serve"]
    }
  }
}
```

### 6 個精簡工具

| 工具 | 用途 | 唯讀 |
|------|------|------|
| `web_fetch` | 智慧抓取任意 URL | ✅ |
| `web_open` | 開啟瀏覽器 + snapshot | ❌ |
| `web_snapshot` | 重新取得 @ref 元素樹 | ✅ |
| `web_action` | 點擊/填表/選擇/滾動 | ❌ |
| `web_screenshot` | 截圖 | ✅ |
| `web_doctor` | 診斷 adapter 狀態 | ✅ |

> 為什麼只有 6 個？研究顯示：工具越少 = AI 表現越好（快 3.5x，成功率 80% → 100%）。

## 設定

設定檔位於 `~/.agent-web/config.yaml`：

```bash
# 設定 Twitter Cookie
agent-web config set platforms.twitter.cookies "your_cookies"

# 設定代理
agent-web config set proxy.http "http://user:pass@ip:port"

# 查看設定
agent-web config get platforms
agent-web config path
```

## 架構

```
URL 進來
    │
    ▼
┌─────────┐     ┌──────────┐
│ 智慧路由  │────▶│ Adapter  │──── YouTube (yt-dlp)
│ Router   │     │ Registry │──── Twitter (xreach)
└─────────┘     │          │──── GitHub (gh)
    │           │          │──── Reddit (JSON)
    │           │          │──── Jina (通用)
    │           └──────────┘
    │ 失敗？
    ▼
┌──────────┐
│ Playwright│ ← 終極後備
│ 瀏覽器    │
└──────────┘
```

## 社群 Adapter 插件

任何人都可以建立第三方 adapter：

```bash
npm install agent-web-adapter-notion
# agent-web 自動發現，無需設定
```

建立方式請參考 [Adapter 開發指南](docs/adapters.md)。

## 安全

- Cookie 存放在 `~/.agent-web/sessions/`，權限 0600
- 支援 Domain 白名單（環境變數 `AGENT_WEB_ALLOWED_DOMAINS`）
- 內容邊界標記防止 prompt injection（`AGENT_WEB_CONTENT_BOUNDARIES=1`）

## 授權

[MIT](LICENSE)
