import { useMemo, useRef, useState } from 'react';
import { useFileShare } from './useFileShare';
import { QrImage } from '../components/QrImage';

type Mode = 'share' | 'receive';

function defaultSignalingUrl(): string {
  const host = window.location.hostname || 'localhost';
  const secure = window.location.protocol === 'https:';
  return `${secure ? 'wss' : 'ws'}://${host}:8080/v1/ws`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function FileSharePanel(): JSX.Element {
  const fs = useFileShare();
  const [mode, setMode] = useState<Mode>('share');
  const [signalingUrl, setSignalingUrl] = useState<string>(defaultSignalingUrl);
  const [alias, setAlias] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const statusClass = `status-pill status-${fs.status.kind}`;

  const totalSelected = useMemo(() => files.reduce((n, f) => n + f.size, 0), [files]);

  if (!fs.supported) {
    return (
      <div className="card">
        <h2 className="card-title">Campus File Share</h2>
        <p className="notice notice-err">
          This browser is missing required features ({fs.missing.join(', ')}). File sharing is
          unavailable. Please use an up-to-date Chrome, Edge, Safari, or Firefox.
        </p>
      </div>
    );
  }

  return (
    <section className="fileshare">
      <div className="fileshare-head">
        <div>
          <h2 className="card-title">Campus File Share</h2>
          <p className="card-sub">
            Share files directly with someone on the same campus network — peer to peer, nothing
            stored on a server.
          </p>
        </div>
        <span className={statusClass}>{fs.status.message}</span>
      </div>

      {/* --- Connection config --- */}
      <div className="card">
        <div className="field-grid">
          <label className="field">
            <span className="field-label">Signaling server</span>
            <input
              className="input"
              value={signalingUrl}
              onChange={(e) => setSignalingUrl(e.target.value)}
              disabled={fs.connected}
              spellCheck={false}
              placeholder="ws://<campus-server>:8080/v1/ws"
            />
          </label>
          <label className="field">
            <span className="field-label">Your name</span>
            <input
              className="input"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              disabled={fs.connected}
              placeholder="e.g. Aisha (Library PC)"
            />
          </label>
        </div>

        {!fs.connected && (
          <div className="mode-tabs" role="tablist">
            <button
              className={`tab ${mode === 'share' ? 'tab-active' : ''}`}
              onClick={() => setMode('share')}
              role="tab"
              aria-selected={mode === 'share'}
            >
              Share files
            </button>
            <button
              className={`tab ${mode === 'receive' ? 'tab-active' : ''}`}
              onClick={() => setMode('receive')}
              role="tab"
              aria-selected={mode === 'receive'}
            >
              Join by code
            </button>
          </div>
        )}

        {!fs.connected && mode === 'share' && (
          <div className="mode-body">
            <p className="hint">
              Start a session, then have the other person scan the QR (phone) or type the code.
            </p>
            <button className="btn btn-primary" onClick={() => void fs.host(signalingUrl, alias)}>
              Start a session
            </button>
          </div>
        )}

        {!fs.connected && mode === 'receive' && (
          <div className="mode-body">
            <p className="hint">Enter the code shown on the other person&apos;s screen.</p>
            <div className="row">
              <input
                className="input code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. 8FK3AB"
                spellCheck={false}
              />
              <button
                className="btn btn-primary"
                onClick={() => void fs.joinByCode(signalingUrl, code, alias)}
              >
                Join with code
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- Hosting: QR + code --- */}
      {fs.hosting && fs.hostPayload && (
        <div className="card share-invite">
          <div className="invite-qr">
            <QrImage value={fs.hostPayload} />
            <span className="qr-caption">Scan with the WrapDrive app</span>
          </div>
          <div className="invite-code">
            <span className="field-label">Pairing code</span>
            {fs.pairingCode ? (
              <span className="big-code">{fs.pairingCode}</span>
            ) : (
              <span className="muted">Generating…</span>
            )}
            <p className="hint">
              The other person opens this portal, chooses <strong>Join by code</strong>, and enters
              this code. Valid briefly, single use.
            </p>
          </div>
        </div>
      )}

      {/* --- Connected: peers + send + transfer --- */}
      {fs.connected && (
        <div className="card">
          <div className="row space-between">
            <h3 className="section-title">Connected devices</h3>
            <button className="btn btn-ghost" onClick={fs.leave}>
              Leave session
            </button>
          </div>
          {fs.peers.length === 0 ? (
            <p className="muted">Waiting for the other device to join…</p>
          ) : (
            <ul className="peer-list">
              {fs.peers.map((p) => (
                <li key={p.id} className="peer">
                  <span className="peer-dot" />
                  <div>
                    <div className="peer-name">{p.alias || 'Unknown device'}</div>
                    <div className="peer-meta">
                      {(p.deviceType ?? 'device').toLowerCase()}
                      {p.deviceModel ? ` · ${p.deviceModel}` : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="send-box">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            <button className="btn" onClick={() => fileInputRef.current?.click()}>
              Choose files
            </button>
            <span className="muted">
              {files.length === 0
                ? 'No files chosen'
                : `${files.length} file(s) · ${formatBytes(totalSelected)}`}
            </span>
            <button
              className="btn btn-primary"
              disabled={files.length === 0 || fs.peers.length === 0}
              onClick={() => void fs.send(files)}
            >
              Send
            </button>
          </div>

          {files.length > 0 && (
            <ul className="file-list">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="file-row">
                  <span className="file-name">{f.name}</span>
                  <span className="file-size">{formatBytes(f.size)}</span>
                </li>
              ))}
            </ul>
          )}

          {fs.transfer && (
            <div className={`transfer transfer-${fs.transfer.state}`}>
              <div className="transfer-bar">
                <div className="transfer-fill" style={{ width: `${fs.transfer.pct}%` }} />
              </div>
              <div className="transfer-label">
                {fs.transfer.state === 'completed'
                  ? 'Completed'
                  : fs.transfer.state === 'failed'
                    ? `Failed: ${fs.transfer.reason ?? 'unknown error'}`
                    : `Transferring ${fs.transfer.pct}% (${formatBytes(fs.transfer.bytesTransferred)} / ${formatBytes(fs.transfer.totalBytes)})`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- Incoming requests --- */}
      {fs.incoming.length > 0 && (
        <div className="card">
          <h3 className="section-title">Incoming files</h3>
          {fs.incoming.map((r) => (
            <div key={r.transferId} className="incoming">
              <span>
                {r.fileCount} file(s) · {formatBytes(r.totalBytes)}
              </span>
              <div className="row">
                <button className="btn btn-primary" onClick={() => void fs.accept(r.transferId)}>
                  Accept
                </button>
                <button className="btn btn-ghost" onClick={() => void fs.reject(r.transferId)}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- Activity log --- */}
      {fs.log.length > 0 && (
        <div className="card">
          <h3 className="section-title">Activity</h3>
          <ul className="log">
            {fs.log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
