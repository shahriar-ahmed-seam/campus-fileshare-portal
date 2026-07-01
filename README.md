# Campus File Share — University Portal

A realistic single-page **university student portal** that embeds the
[`p2p-portal-drop`](https://www.npmjs.com/package/p2p-portal-drop) SDK to let
students and staff share files **directly, peer-to-peer, over the campus
network** — no cloud, no uploads, nothing stored on a server.

This is a reference integration: it installs the SDK from npm and wires it into
a normal React app, exactly how a real portal would.

![stack](https://img.shields.io/badge/Vite-React-blue) ![sdk](https://img.shields.io/badge/p2p--portal--drop-embedded-0b3d2e)

## How the SDK is integrated

```
npm install p2p-portal-drop
```

- `src/fileshare/useFileShare.ts` — a React hook that owns one `FileShareClient`,
  wires the SDK's typed lifecycle events into state, and exposes
  host / joinByCode / send / accept / reject / leave.
- `src/fileshare/FileSharePanel.tsx` — the UI (share via QR + code, join by code,
  peer list, file picker, live progress, incoming-file prompts).
- `src/pairing.ts` — builds the QR/pairing payload the WrapDrive apps understand.

The rest (`App.tsx`, `styles.css`) is just the portal chrome around it.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5180  (also exposed on your LAN IP)
```

You also need the **signaling server** running (from the WrapDrive repo):

```bash
cd ../localsend/server && cargo run     # ws://0.0.0.0:8080
```

### Try a transfer (two devices on the same network)

1. Open the portal on device A (e.g. `http://<your-lan-ip>:5180`).
2. In **Campus File Share**, set the signaling server to `ws://<your-lan-ip>:8080/v1/ws`
   (it auto-fills from the page host).
3. Choose **Share files → Start a session**. A QR and a short code appear.
4. On device B (phone with the WrapDrive app, or another browser opening the same
   portal), scan the QR or choose **Join by code** and enter the code.
5. Pick files and **Send**. Accept the prompt on the receiver. Bytes stream
   directly between the two devices.

> The transfer is LAN peer-to-peer, so both devices must be on the same network.

## Deploy

The portal is a static site — build and host anywhere:

```bash
npm run build      # → dist/
npm run preview
```

Deploy `dist/` to Vercel, Netlify, GitHub Pages, or campus web hosting. For a
site served over **HTTPS**, the signaling server must be reachable over **`wss://`**
(browsers block `ws://` from an `https://` page). Deploy the signaling server with
TLS — the WrapDrive `server/` includes a Caddy + Let's Encrypt compose file for
automatic HTTPS — and point the portal's signaling field at `wss://<domain>/v1/ws`.

## Credits

Built on [`p2p-portal-drop`](https://www.npmjs.com/package/p2p-portal-drop), part of
the WrapDrive project (which builds on [LocalSend](https://github.com/localsend/localsend)).
