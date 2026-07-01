/**
 * QR / pairing payload helpers.
 *
 * The payload the host shows (as a QR code or short code) mirrors the format the
 * native WrapDrive apps scan:
 *   { v, sessionId, token, signaling: { url, tls } }
 * The `token` carries >=128 bits of CSPRNG entropy; the server only ever sees a
 * derived one-way validator, never this raw token.
 */

export interface QrPayload {
  v: number;
  sessionId: string;
  token: string;
  signaling: { url: string; tls: boolean };
}

const PAYLOAD_VERSION = 1;
const TOKEN_BYTES = 16; // 128 bits

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function generatePairingToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export function buildQrPayload(signalingUrl: string): QrPayload {
  return {
    v: PAYLOAD_VERSION,
    sessionId: generateSessionId(),
    token: generatePairingToken(),
    signaling: { url: signalingUrl, tls: signalingUrl.startsWith('wss://') },
  };
}

export function encodeQrPayload(payload: QrPayload): string {
  return JSON.stringify(payload);
}

export function decodeQrPayload(text: string): QrPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Pairing payload is not valid JSON.');
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Pairing payload must be a JSON object.');
  }
  const obj = raw as Record<string, unknown>;
  const signaling = obj['signaling'] as Record<string, unknown> | undefined;
  if (
    typeof obj['sessionId'] !== 'string' ||
    typeof obj['token'] !== 'string' ||
    !signaling ||
    typeof signaling['url'] !== 'string'
  ) {
    throw new Error('Pairing payload is missing required fields.');
  }
  const url = signaling['url'];
  return {
    v: typeof obj['v'] === 'number' ? obj['v'] : PAYLOAD_VERSION,
    sessionId: obj['sessionId'],
    token: obj['token'],
    signaling: { url, tls: url.startsWith('wss://') },
  };
}
