# Campus File Share — University Portal

A realistic single-page **university student portal** with built-in
**peer-to-peer file sharing**. Students and staff share files **directly between
their devices over the campus network** — nothing is uploaded to or stored on a
server.

This repository is a **reference integration**: it shows, with real working
code, how to embed the [`p2p-portal-drop`](https://www.npmjs.com/package/p2p-portal-drop)
file-sharing SDK into a production-style web app.

Built with **Vite + React + TypeScript**.

---

## About the `p2p-portal-drop` SDK

`p2p-portal-drop` is a framework-agnostic, LAN-only peer-to-peer file-sharing SDK
that **we built and published to npm**. A web app pairs two devices (via a QR
code or a short code) and streams files directly between them using the
browser's native WebRTC — file bytes never touch a server.

This portal is the reference showing how a real product integrates it. The SDK
is consumed like any other dependency:

```bash
npm install p2p-portal-drop
```

**Where the integration lives in this repo:**

| File | Role |
| --- | --- |
| [`src/fileshare/useFileShare.ts`](src/fileshare/useFileShare.ts) | A React hook that owns one `FileShareClient`, maps the SDK's typed lifecycle events to state, and exposes `host` / `joinByCode` / `send` / `accept` / `reject` / `leave`. |
| [`src/fileshare/FileSharePanel.tsx`](src/fileshare/FileSharePanel.tsx) | The file-sharing UI: share via QR + short code, join by code, live peer list, file picker, progress, and incoming-file prompts. |
| [`src/pairing.ts`](src/pairing.ts) | Builds the QR / pairing payload the SDK understands. |
| [`src/components/QrImage.tsx`](src/components/QrImage.tsx) | Renders the pairing QR (via the `qrcode` package). |

Everything else (`App.tsx`, `styles.css`) is ordinary portal chrome around it.

---

## Architecture

```
   Student device A                 Signaling server                Student device B
   (this portal, browser)          (pairing broker only)           (browser or mobile app)
          │                               │                               │
          │──── pair (QR / short code) ──►│◄──── pair ────────────────────│
          │                               │                               │
          │========= WebRTC data channel (peer-to-peer, on the LAN) =======│
          │              files stream directly, device to device          │
          ▼                                                               ▼
                    the signaling server never sees a single file byte
```

Two pieces are involved:

1. **This portal** — the frontend your institution deploys, embedding the SDK.
2. **A signaling server** — a tiny pairing broker your institution runs on its
   own infrastructure (provided as a Docker image; see below). It only relays
   pairing and connection-setup messages, never files.

---

## Run it locally

**1. Start the signaling server** (Docker):

```bash
docker compose up -d          # → ws://localhost:8080/v1/ws  (also on your LAN IP)
```

**2. Start the portal:**

```bash
npm install
npm run dev                   # → http://localhost:5180  (also exposed on your LAN IP)
```

**3. Share a file (two devices on the same network):**

1. Open the portal on device A at `http://<your-lan-ip>:5180`.
2. In **Campus File Share**, the signaling field auto-fills to
   `ws://<your-lan-ip>:8080/v1/ws`.
3. Choose **Share files → Start a session**. A QR code and a short code appear.
4. On device B, open the same portal and choose **Join by code** (enter the
   code), or scan the QR with a compatible mobile app.
5. Pick files, hit **Send**, and accept on the receiver. Bytes stream directly
   between the two devices.

> Because transfers are LAN peer-to-peer, both devices must be on the same network.

---

## Deploy

**Frontend** — it's a static site; build and host anywhere (Vercel, Netlify,
GitHub Pages, or your campus web hosting):

```bash
npm run build                 # → dist/
```

**Signaling server** — run the provided image on your infrastructure. For a
portal served over **HTTPS**, the server must be reachable over **`wss://`**
(browsers block `ws://` from an `https://` page), so put it behind a
TLS-terminating reverse proxy and point the portal's signaling field at
`wss://<your-domain>/v1/ws`.

> The signaling image is published at
> `ghcr.io/shahriar-ahmed-seam/p2p-portal-drop-signaling`. If your `docker pull`
> needs authentication, either sign in with `docker login ghcr.io`, or make the
> package public once in its GitHub **Package settings**.

---

## License

MIT.
