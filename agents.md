# Vimozz - Agent Documentation

This file contains the core context, architecture, and constraints of the Vimozz project to quickly onboard future AI agents.

## Project Overview
Vimozz is a Twitch Music Bot that integrates with YouTube for audio playback and includes a built-in anti-censorship bypass (via Xray/VLESS) for restricted regions. 

- **Tech Stack**: Electron, React, TypeScript, Webpack.
- **Key External Tools**: 
  - `xray` (bundled as a sidecar binary for censorship bypass).

## Architecture
- **Main Process (`src/main/`)**:
  - `main.ts`: App lifecycle, window management, and proxy configuration.
  - `bypassService.ts`: Parses VLESS Reality URLs and generates an `xray_config.json`. Spawns the Xray sidecar (`xray` on Linux, `xray.exe` on Windows).
  - `callbackServer.ts`: Hosts a local Express server (port 3001) for Twitch OAuth callbacks AND serves the `proxy.pac` script used by Electron to route traffic through Xray.
- **Renderer Process (`src/renderer/`)**:
  - React frontend using contexts (`QueueContext.tsx`) for state management. Broadcast channels (`vimozz_queue_sync`) are used to synchronize the queue.
  - Uses `react-player` to play YouTube audio via iframes.

## Critical Technical Constraints & "Gotchas"
1. **Network & Proxying**:
   - The Xray tunnel exposes a SOCKS5 inbound (port 10808) and an HTTP inbound (port 10809).
   - Electron's session is configured using a PAC script (`http://localhost:3001/proxy.pac?port=10808`). This allows the embedded Chromium engine (including `react-player` iframes) to automatically route through Xray and bypass DPI.
   - **DO NOT** use `axios` with an HTTP proxy in the Node.js main process to fetch `https://` URLs (like YouTube). Node's `axios` struggles with TLS handshakes over the Xray HTTP proxy (`ECONNRESET`). Instead, `fetch-youtube-title` uses Electron's native `net.request`, which flawlessly shares Chromium's PAC script configuration.

2. **Twitch Auth (Implicit Grant)**:
   - The app uses the Implicit Grant flow (`response_type=token`) instead of Authorization Code. 
   - We do not use `CLIENT_SECRET` in this project to prevent leaking secrets. 
   - A silent auth mechanism is implemented on app load. If silent auth fails (token expired after 60 days), user interaction is required via a warning modal.

3. **Xray / VLESS Parser**:
   - In `bypassService.ts`, when parsing `xhttp` transport, the `host` parameter must be preserved exactly as provided in the VLESS URL (e.g., `host=POST`). Do NOT replace `POST` with the SNI domain, as this will cause the server to reject the connection with an SSL/handshake error.

4. **Cross-Platform Building**:
   - The project uses `electron-builder`.
   - `scripts/download-xray.js` downloads **both** Linux (`xray`) and Windows (`xray.exe`) binaries into `sidecar/xray/` during `postinstall`. This ensures that `electron-builder` packages the correct binary for the target OS regardless of the build environment.

## Release & Build
- Use `npm run build` to compile TypeScript and Webpack.
- Use `npx electron-builder --linux` or `--win` to package the application.
