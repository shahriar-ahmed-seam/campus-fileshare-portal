/**
 * useFileShare — a small React hook that integrates the published
 * `p2p-portal-drop` SDK into the portal.
 *
 * It owns a single FileShareClient, wires the SDK's typed lifecycle events into
 * React state, and exposes host/join/send/accept/reject/leave actions. The
 * portal UI renders purely from the returned state.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createFileShareClient,
  createTokenCredentials,
  generateSigningKeyPair,
  createPairingCode,
  claimPairingCode,
  detectMissingCapabilities,
  getDefaultCapabilityEnvironment,
} from 'p2p-portal-drop';
import type {
  FileShareClient,
  ClientInfo,
  ClientInfoWithoutId,
  FileInput,
  HandshakeCredentials,
  SessionHandle,
} from 'p2p-portal-drop';
import {
  buildQrPayload,
  decodeQrPayload,
  encodeQrPayload,
  type QrPayload,
} from '../pairing';

export type StatusKind = 'idle' | 'info' | 'ok' | 'warn' | 'err';

export interface Status {
  message: string;
  kind: StatusKind;
}

export interface IncomingRequest {
  transferId: string;
  fileCount: number;
  totalBytes: number;
}

export interface ActiveTransfer {
  id: string;
  pct: number;
  bytesTransferred: number;
  totalBytes: number;
  state: 'active' | 'completed' | 'failed';
  reason?: string;
}

export interface FileShareState {
  supported: boolean;
  missing: string[];
  status: Status;
  connected: boolean;
  hosting: boolean;
  peers: ClientInfo[];
  /** The encoded pairing payload (for the QR) when hosting. */
  hostPayload: string | null;
  /** The short pairing code when hosting (null while generating / unavailable). */
  pairingCode: string | null;
  incoming: IncomingRequest[];
  transfer: ActiveTransfer | null;
  log: string[];
}

export interface FileShareActions {
  host: (signalingUrl: string, alias: string) => Promise<void>;
  joinByCode: (signalingUrl: string, code: string, alias: string) => Promise<void>;
  send: (files: File[]) => Promise<void>;
  accept: (transferId: string) => Promise<void>;
  reject: (transferId: string) => Promise<void>;
  leave: () => void;
}

const now = (): string => new Date().toLocaleTimeString();

export function useFileShare(): FileShareState & FileShareActions {
  const clientRef = useRef<FileShareClient | undefined>(undefined);
  const sessionRef = useRef<SessionHandle | undefined>(undefined);
  const keyPairRef = useRef<CryptoKeyPair | undefined>(undefined);
  // Stable merge identity advertised to peers for this portal tab.
  const mergeTokenRef = useRef<string>(
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join(''),
  );
  const lastProgressRef = useRef<number>(0);

  const [state, setState] = useState<FileShareState>(() => {
    const missing = detectMissingCapabilities(getDefaultCapabilityEnvironment());
    return {
      supported: missing.length === 0,
      missing,
      status: { message: 'Not connected.', kind: 'idle' },
      connected: false,
      hosting: false,
      peers: [],
      hostPayload: null,
      pairingCode: null,
      incoming: [],
      transfer: null,
      log: [],
    };
  });

  const patch = useCallback((p: Partial<FileShareState>): void => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const setStatus = useCallback(
    (message: string, kind: StatusKind = 'info'): void => {
      setState((s) => ({ ...s, status: { message, kind } }));
    },
    [],
  );

  const log = useCallback((message: string): void => {
    setState((s) => ({ ...s, log: [`[${now()}] ${message}`, ...s.log].slice(0, 60) }));
  }, []);

  const clientInfo = useCallback(
    (alias: string): ClientInfoWithoutId => ({
      alias: alias.trim() || 'Portal User',
      version: '2.1',
      deviceModel: 'Browser',
      deviceType: 'WEB',
      token: mergeTokenRef.current,
    }),
    [],
  );

  const resolveCredentials = useCallback(async (): Promise<HandshakeCredentials | undefined> => {
    try {
      keyPairRef.current ??= await generateSigningKeyPair();
      // Real Ed25519 signed token → interoperates with native (phone/desktop) peers.
      return createTokenCredentials({ keyPair: keyPairRef.current });
    } catch {
      // Older browsers without Ed25519 Web Crypto: fall back to the SDK default
      // (browser-to-browser transfers still work).
      return undefined;
    }
  }, []);

  const buildClient = useCallback(
    (credentials?: HandshakeCredentials): FileShareClient => {
      const c = createFileShareClient(
        credentials ? { protocolVersion: '2.1', credentials } : { protocolVersion: '2.1' },
      );
      c.on('request-received', (e) => {
        log(`Incoming request: ${e.request.files.length} file(s), ${e.request.totalBytes} bytes.`);
        setState((s) => ({
          ...s,
          incoming: [
            { transferId: e.transferId, fileCount: e.request.files.length, totalBytes: e.request.totalBytes },
            ...s.incoming.filter((i) => i.transferId !== e.transferId),
          ],
        }));
      });
      c.on('progress', (e) => {
        const t = Date.now();
        const done = e.totalBytes > 0 && e.bytesTransferred >= e.totalBytes;
        if (!done && t - lastProgressRef.current < 200) return;
        lastProgressRef.current = t;
        const pct = e.totalBytes > 0 ? Math.floor((e.bytesTransferred / e.totalBytes) * 100) : 0;
        setState((s) => ({
          ...s,
          transfer: {
            id: e.transferId,
            pct,
            bytesTransferred: e.bytesTransferred,
            totalBytes: e.totalBytes,
            state: 'active',
          },
        }));
      });
      c.on('completed', (e) => {
        log(`Transfer ${e.transferId.slice(0, 8)}… completed.`);
        setState((s) => ({
          ...s,
          transfer: s.transfer && s.transfer.id === e.transferId
            ? { ...s.transfer, pct: 100, state: 'completed' }
            : { id: e.transferId, pct: 100, bytesTransferred: 0, totalBytes: 0, state: 'completed' },
        }));
      });
      c.on('failed', (e) => {
        log(`Transfer failed: ${e.reason}`);
        setState((s) => ({
          ...s,
          transfer: {
            id: e.transferId,
            pct: s.transfer?.id === e.transferId ? s.transfer.pct : 0,
            bytesTransferred: s.transfer?.bytesTransferred ?? 0,
            totalBytes: s.transfer?.totalBytes ?? 0,
            state: 'failed',
            reason: e.reason,
          },
        }));
      });
      c.on('connection-error', (e) => {
        log(`Connection error: ${e.reason}`);
        setStatus(`Connection error: ${e.reason}`, 'err');
      });
      c.on('capability-error', (e) => log(`Capability error: ${e.reason}`));
      return c;
    },
    [log, setStatus],
  );

  const connect = useCallback(
    async (payload: QrPayload, alias: string, create: boolean): Promise<void> => {
      if (sessionRef.current) {
        setStatus('Already connected — leave the current session first.', 'warn');
        return;
      }
      setStatus(`Connecting to ${payload.signaling.url}…`, 'info');
      const credentials = await resolveCredentials();
      const c = buildClient(credentials);
      clientRef.current = c;
      try {
        const session = await c.joinSession({
          signalingUrl: payload.signaling.url,
          sessionId: payload.sessionId,
          pairingToken: payload.token,
          clientInfo: clientInfo(alias),
          connectTimeoutSec: 30,
          create,
          onPeersChanged: (current) => patch({ peers: current }),
        });
        sessionRef.current = session;
        patch({ connected: true });
        setStatus('Connected. Ready to share.', 'ok');
        log(`Connected to session ${payload.sessionId.slice(0, 8)}… at ${payload.signaling.url}.`);
      } catch (err) {
        clientRef.current = undefined;
        const msg = err instanceof Error ? err.message : String(err);
        setStatus(`Connection failed: ${msg}`, 'err');
        log(`Connection failed: ${msg}`);
      }
    },
    [buildClient, clientInfo, log, patch, resolveCredentials, setStatus],
  );

  const host = useCallback(
    async (signalingUrl: string, alias: string): Promise<void> => {
      if (!signalingUrl.trim()) {
        setStatus('Enter the campus signaling server URL first.', 'warn');
        return;
      }
      const payload = buildQrPayload(signalingUrl.trim());
      const encoded = encodeQrPayload(payload);
      patch({ hosting: true, hostPayload: encoded, pairingCode: null });
      log(`Hosting session ${payload.sessionId.slice(0, 8)}… — share the QR or code.`);
      // The host registers (creates) the session so a joiner has a peer.
      await connect(payload, alias, true);
      // Best-effort: publish a short code for camera-free joining.
      try {
        const code = await createPairingCode(signalingUrl.trim(), encoded);
        patch({ pairingCode: code });
      } catch {
        patch({ pairingCode: null });
        log('Short pairing code unavailable (relay unreachable) — QR still works.');
      }
    },
    [connect, log, patch, setStatus],
  );

  const joinByCode = useCallback(
    async (signalingUrl: string, code: string, alias: string): Promise<void> => {
      if (!signalingUrl.trim() || !code.trim()) {
        setStatus('Enter the signaling URL and a pairing code.', 'warn');
        return;
      }
      setStatus('Claiming pairing code…', 'info');
      try {
        const encoded = await claimPairingCode(signalingUrl.trim(), code.trim());
        const payload = decodeQrPayload(encoded);
        await connect(payload, alias, false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus(`Could not join by code: ${msg}`, 'err');
      }
    },
    [connect, setStatus],
  );

  const send = useCallback(
    async (files: File[]): Promise<void> => {
      const c = clientRef.current;
      if (!c || !sessionRef.current) {
        setStatus('Connect to a session before sending.', 'warn');
        return;
      }
      if (files.length === 0) {
        setStatus('Choose at least one file to send.', 'warn');
        return;
      }
      const inputs: FileInput[] = files.map((f) => ({
        fileName: f.name,
        fileType: f.type || 'application/octet-stream',
        data: f,
      }));
      setStatus(`Sending ${inputs.length} file(s)…`, 'info');
      try {
        const handle = await c.sendTransferRequest(inputs);
        log(`Sent request ${handle.transferId.slice(0, 8)}… (${inputs.length} file(s)).`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus(`Send failed: ${msg}`, 'err');
      }
    },
    [log, setStatus],
  );

  const accept = useCallback(
    async (transferId: string): Promise<void> => {
      const c = clientRef.current;
      if (!c) return;
      setState((s) => ({ ...s, incoming: s.incoming.filter((i) => i.transferId !== transferId) }));
      try {
        await c.acceptTransfer(transferId);
        log(`Accepted transfer ${transferId.slice(0, 8)}….`);
      } catch (err) {
        log(`Accept failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [log],
  );

  const reject = useCallback(
    async (transferId: string): Promise<void> => {
      const c = clientRef.current;
      if (!c) return;
      setState((s) => ({ ...s, incoming: s.incoming.filter((i) => i.transferId !== transferId) }));
      try {
        await c.rejectTransfer(transferId);
        log(`Rejected transfer ${transferId.slice(0, 8)}….`);
      } catch (err) {
        log(`Reject failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [log],
  );

  const leave = useCallback((): void => {
    try {
      sessionRef.current?.leave();
    } catch {
      // ignore
    }
    sessionRef.current = undefined;
    clientRef.current = undefined;
    setState((s) => ({
      ...s,
      connected: false,
      hosting: false,
      peers: [],
      hostPayload: null,
      pairingCode: null,
      incoming: [],
      transfer: null,
      status: { message: 'Left the session.', kind: 'idle' },
    }));
  }, []);

  // Tear down the session if the component unmounts.
  useEffect(() => {
    return () => {
      try {
        sessionRef.current?.leave();
      } catch {
        // ignore
      }
    };
  }, []);

  return { ...state, host, joinByCode, send, accept, reject, leave };
}
