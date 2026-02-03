# Clash Chrome Extension - Requirements

## Project Overview
A Chrome extension to view and control your Clash proxy configuration via API.

## Description
"A Chrome extension to view and control your Clash proxy configuration via API."

## Tech Stack
- **Framework**: Svelte 5
- **Build Tool**: Vite 6
- **Language**: TypeScript 5
- **Manifest**: Chrome Extension V3
- **Styling**: Tailwind CSS 4

## Features

### 1. Clash API Configuration
- Configure Clash API endpoint
  - IP Address (default: 127.0.0.1)
  - Port (default: 9090)
  - Secret/Token (optional, for authenticated instances)
- Save configuration to Chrome storage
- Test connection to verify API availability
- **Blocking**: All features disabled until API is configured

### 2. Proxy Toggle
- Master toggle button to enable/disable Clash as Chrome's proxy
- When enabled:
  1. Call Clash API (`GET /configs`) to get proxy settings
  2. Extract proxy address and port from config (`mixed-port`, `port`, or `socks-port`)
  3. Set Chrome proxy settings using retrieved configuration
- When disabled: Reset Chrome proxy to system/direct mode
- Visual indicator showing current state (enabled/disabled)
- Persist toggle state across browser sessions
- Handle errors if Clash is not running or API is unreachable

### 3. Popup UI - Clash Version
- Display current Clash version in popup
- API: `GET /version`
- Show version number prominently (e.g., "v1.18.0")
- Indicate Premium/Core variant if available
- Display error state if API is unreachable
