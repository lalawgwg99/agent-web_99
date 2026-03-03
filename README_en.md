# agent-web

**Unified web tool for AI Agents** — one CLI/MCP for content fetching + browser automation.

[![npm version](https://img.shields.io/npm/v/agent-web)](https://www.npmjs.com/package/agent-web)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Why agent-web?

| Existing Tools | Problem |
|---------------|---------|
| agent-browser | Can only "act", cannot "read" |
| agent-reach | Can only "read", cannot "act" |
| Playwright MCP | 25+ tools, token explosion |

**agent-web = Read + Act, unified interface, 6 lean tools, 90% token savings.**

## Quick Start

```bash
# One-line install check
npx agent-web doctor

# Fetch any web page content
npx agent-web fetch https://example.com

# Fetch YouTube video info + subtitles
npx agent-web fetch https://youtube.com/watch?v=dQw4w9WgXcQ

# Fetch GitHub repo
npx agent-web fetch https://github.com/vercel/next.js
```

## Core Features

### 1. Smart Fetching (auto-selects best strategy)

```bash
agent-web fetch <url>              # Auto-detect platform
agent-web fetch <url> --json       # JSON output
agent-web fetch <url> --adapter youtube  # Force specific adapter
```

Supported platforms:

| Platform | Adapter | Dependency |
|----------|---------|------------|
| YouTube | yt-dlp | `brew install yt-dlp` |
| Twitter/X | xreach | `npm i -g xreach` |
| GitHub | gh CLI | `brew install gh` |
| Reddit | JSON API | None |
| Bilibili | yt-dlp | `brew install yt-dlp` |
| RSS/Atom | Built-in | None |
| XiaoHongShu | Cookie | Config required |
| Any web page | Jina Reader | None |

### 2. Browser Automation (snapshot + @ref)

```bash
# Open page, get element snapshot
agent-web open https://example.com

# Output:
# [@e1] textbox "Email"
# [@e2] textbox "Password"
# [@e3] button "Sign In"

# Interact using @refs
agent-web click @e3
agent-web fill @e1 "user@example.com"
agent-web fill @e2 "password"
agent-web screenshot
agent-web close
```

AI only sees lean `[@e1] button "Sign In"` instead of full-page HTML — 90%+ token savings.

### 3. Self-Diagnostics

```bash
agent-web doctor

# Output:
# ✅ jina         ready
# ✅ youtube      yt-dlp 2024.12.06
# ⚠️  twitter      xreach not found
#    → Install: npm install -g xreach
# ❌ xiaohongshu  not configured
#    → agent-web config set platforms.xiaohongshu.cookies "..."
```

## MCP Server Integration

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

### 6 Lean Tools

| Tool | Purpose | Read-only |
|------|---------|-----------|
| `web_fetch` | Smart-fetch any URL | Yes |
| `web_open` | Open browser + snapshot | No |
| `web_snapshot` | Refresh @ref element tree | Yes |
| `web_action` | Click/fill/select/scroll | No |
| `web_screenshot` | Take screenshot | Yes |
| `web_doctor` | Diagnose adapter status | Yes |

> Why only 6? Research shows: fewer tools = better AI performance (3.5x faster, success rate 80% → 100%).

## Configuration

Config file at `~/.agent-web/config.yaml`:

```bash
# Set Twitter cookies
agent-web config set platforms.twitter.cookies "your_cookies"

# Set proxy
agent-web config set proxy.http "http://user:pass@ip:port"

# View config
agent-web config get platforms
agent-web config path
```

## Architecture

```
URL input
    │
    ▼
┌─────────┐     ┌──────────┐
│  Smart   │────▶│ Adapter  │──── YouTube (yt-dlp)
│  Router  │     │ Registry │──── Twitter (xreach)
└─────────┘     │          │──── GitHub (gh)
    │           │          │──── Reddit (JSON)
    │           │          │──── Jina (general)
    │           └──────────┘
    │ Failed?
    ▼
┌──────────┐
│Playwright│ ← Ultimate fallback
│ Browser  │
└──────────┘
```

## Community Adapter Plugins

Anyone can create third-party adapters:

```bash
npm install agent-web-adapter-notion
# agent-web auto-discovers it, zero config needed
```

See [Adapter Development Guide](docs/adapters.md) for details.

## Security

- Cookies stored at `~/.agent-web/sessions/` with 0600 permissions
- Domain allowlist support (`AGENT_WEB_ALLOWED_DOMAINS` env var)
- Content boundary markers to prevent prompt injection (`AGENT_WEB_CONTENT_BOUNDARIES=1`)

## License

[MIT](LICENSE)
