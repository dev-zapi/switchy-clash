<div align="center">

# Switchy Clash

**A modern Chrome extension for controlling your Clash proxy — right from the toolbar.**

[![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![Svelte 5](https://img.shields.io/badge/Svelte_5-Runes-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript_5-Strict-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vite](https://img.shields.io/badge/Vite_6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev)
[![Zero Dependencies](https://img.shields.io/badge/Runtime_Deps-0-brightgreen)](#tech-stack)
[![License](https://img.shields.io/badge/License-MIT-yellow?logo=opensourceinitiative&logoColor=white)](#license)

</div>

---

## Why Switchy Clash?

你的 [Clash](https://github.com/MetaCubeX/mihomo) (mihomo) 跑在旁路由、主路由或远程服务器上？或者你只是在本地用 mihomo 内核，不想装 Electron 客户端或其他图形界面浪费内存和磁盘？

**Switchy Clash** 让你直接在 Chrome 工具栏完成一切 — 切换节点、测延迟、查看当前页面命中了哪条规则 — 两次点击，不需要打开任何 Dashboard 页面，不需要安装任何桌面客户端。

### Who is this for?

- **旁路由 / 主路由 / 远程服务器用户** — Clash 跑在网关或 VPS 上，需要一个轻量的远程控制面板
- **拒绝臃肿客户端的人** — 只用 mihomo 内核，不想装 Clash Verge / Clash for Windows 等 Electron 应用，省下几百 MB 内存和磁盘
- **多实例管理者** — 家里、办公室、VPS 各一套 Clash，需要在它们之间快速切换
- **追求效率的人** — 不想离开浏览器，不想开额外的 Tab 或窗口，只想用最少的操作控制代理

---

## Highlights

- **One-click proxy toggle** — route all browser traffic through Clash or revert to system settings instantly
- **Multi-config management** — save multiple Clash API endpoints, auto-switch between them on startup
- **Proxy group control** — browse all groups (Selector / URLTest / Fallback / LoadBalance / Relay), switch nodes, test latency
- **Rule match display** — see which Clash rule matched the current tab's domain and its proxy chain
- **Dynamic emoji icons** — each config gets its own emoji rendered as the toolbar icon via `OffscreenCanvas`
- **Light / Dark / System themes** — seamless theme sync across popup and options pages
- **8 font choices** — MiSans, Inter, JetBrains Mono, and more, with a live preview panel
- **Config import / export** — share configurations as JSON with merge or replace options

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- A running [Clash](https://github.com/MetaCubeX/mihomo) or mihomo instance with the External Controller API enabled

### Install & Build

```bash
git clone https://github.com/user/switchy-clash.git
cd switchy-clash
npm install
npm run build
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `dist/` folder
4. Click the Switchy Clash icon in the toolbar to get started

---

## Usage

### Popup

| Area | Description |
|------|-------------|
| **Header** | Active config (emoji + name), host:port, Clash version, proxy toggle |
| **Rule Match** | Current tab's domain, matched rule + payload, proxy chain, latency |
| **Proxy Groups** | 2-column compact cards — group name, type, node count, active node + latency, speed test |

Click a **Selector** group card to open a modal where you can browse nodes, test individual latency, or switch the active node. Nodes are sorted: selected first, then by latency ascending.

### Options Page

- **Configurations** — add / edit / delete Clash API endpoints, each with name, emoji, host, port, secret, and bypass list
- **Health check** — test all saved configs at once
- **Import / Export** — backup and share configs as JSON
- **Proxy Bypass List** — global bypass patterns (one per line)
- **Font Settings** — choose from 8 font families with a live preview (Latin, code, and Chinese samples)

---

## Tech Stack

| Layer | Tech |
|-------|------|
| UI | [Svelte 5](https://svelte.dev) (runes mode) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| Language | [TypeScript 5](https://typescriptlang.org) |
| Build | [Vite 6](https://vitejs.dev) |
| Testing | [Playwright](https://playwright.dev) |
| Runtime deps | **0** |

---

## Project Structure

```
src/
├── background/index.ts        # MV3 service worker — proxy toggle, auto-switch, emoji icons
├── popup/                     # Toolbar popup UI
│   ├── App.svelte             # Main popup (groups, rule match, config selector)
│   └── main.ts
├── options/                   # Full-tab settings page
│   ├── App.svelte             # Config management, fonts, bypass list
│   └── main.ts
└── lib/
    ├── components/            # Button, Toggle, Select, Badge, StatusDot
    ├── services/
    │   ├── clash-api.ts       # Clash REST API client (12 endpoints)
    │   ├── proxy.ts           # chrome.proxy.settings wrapper
    │   ├── storage.ts         # chrome.storage.local wrapper (singleton)
    │   └── permissions.ts     # Dynamic host permission requests
    ├── types/                 # TypeScript interfaces + defaults
    └── utils.ts               # Theme, font, delay formatting helpers
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build extension to `dist/` |
| `npm run check` | TypeScript + Svelte type check |
| `npm run test` | Build + Playwright E2E tests |
| `npm run dev` | Vite dev server (limited use for extensions) |

---

## Architecture

### Chrome Extension (Manifest V3)

- **Permissions:** `proxy`, `storage`, `activeTab`
- **Host permissions:** `127.0.0.1` and `localhost` built-in; remote hosts requested dynamically at runtime
- **Three entry points:** popup, options page, background service worker

### Message Passing

The popup and options pages communicate with the background worker via `chrome.runtime.sendMessage`:

| Message | Action |
|---------|--------|
| `ENABLE_PROXY` | Set Chrome proxy to Clash |
| `DISABLE_PROXY` | Revert to system proxy |
| `TOGGLE_PROXY` | Toggle current state |
| `CHECK_ALL_CONFIGS` | Health check all configs |
| `GET_STATE` | Return full extension state |
| `SWITCH_CONFIG` | Change active config |

### Auto-Switch on Startup

1. Health check the active config (`GET /version`, 3s timeout)
2. If unreachable, try other configs sorted by `lastUsed`
3. If none available and proxy was on, disable it automatically

### State Management

All UI state uses Svelte 5 runes (`$state`, `$derived`, `$effect`). No stores or external state libraries. Persistent state lives in `chrome.storage.local` with cross-page sync via `chrome.storage.onChanged`.

> **Implementation note:** `chrome.storage` uses structured clone which cannot serialize Svelte 5's `$state` Proxy objects. The storage service strips proxies via `JSON.parse(JSON.stringify())` on every write.

---

## Theming

12 CSS custom properties per mode, toggled via `.dark` class on `<html>`:

```
--color-bg, --color-bg-secondary, --color-bg-tertiary
--color-text, --color-text-secondary, --color-text-muted
--color-border, --color-primary
--color-success, --color-warning, --color-danger
```

System mode follows `prefers-color-scheme` and updates in real-time.

---

## Clash API Compatibility

The extension targets [mihomo](https://github.com/MetaCubeX/mihomo) (Clash.Meta) and covers these endpoints:

| Method | Endpoint | Usage |
|--------|----------|-------|
| `GET` | `/version` | Health check |
| `GET` | `/configs` | Read ports & mode |
| `PATCH` | `/configs` | Update config |
| `GET` | `/proxies` | List all groups & nodes |
| `PUT` | `/proxies/{name}` | Switch node |
| `GET` | `/proxies/{name}/delay` | Test node latency |
| `GET` | `/group/{name}/delay` | Test group latency |
| `GET` | `/rules` | Routing rules |
| `GET` | `/connections` | Active connections |
| `DELETE` | `/connections` | Close all |
| `DELETE` | `/connections/{id}` | Close specific |

Port detection priority: `mixed-port` > `port` > `socks-port` > `7890`.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes and ensure `npm run check` passes
4. Run tests with `npm run test`
5. Submit a pull request

---

## License

This project is provided as-is. See the repository for license details.
