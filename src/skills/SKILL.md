---
name: agent-web
description: >
  Unified web content fetching and browser automation for AI agents.
  Use when: fetching web page content, reading YouTube/Twitter/GitHub,
  automating browser interactions (click, fill, screenshot), or diagnosing
  web tool availability.
allowed-tools:
  - Bash(npx agent-web:*)
  - Bash(agent-web:*)
---

# agent-web

Unified CLI for web content fetching + browser automation.

## Content Fetching (most common)

```bash
# Smart fetch — auto-detects platform
agent-web fetch <url>
agent-web fetch <url> --json
agent-web fetch <url> --adapter youtube

# Supported platforms: YouTube, Twitter/X, GitHub, Reddit, Bilibili, RSS, any web page
```

## Browser Automation

```bash
# Open page → get snapshot with @refs
agent-web open <url>

# Get fresh element tree
agent-web snapshot

# Interact using @refs from snapshot
agent-web click @e1
agent-web fill @e2 "search text"
agent-web select @e3 "option"
agent-web scroll down
agent-web press Enter
agent-web screenshot

# Close browser
agent-web close
```

## Workflow Pattern

1. `agent-web open <url>` → get snapshot with @refs
2. Read the snapshot to find target elements
3. `agent-web click @eN` / `agent-web fill @eN "text"` → interact
4. `agent-web snapshot` → refresh refs after page changes
5. Repeat until task is done

## Diagnostics

```bash
agent-web doctor    # Check all adapters
agent-web config set platforms.twitter.cookies "..."
```

## MCP Server

```bash
agent-web serve     # Start STDIO MCP server
```
