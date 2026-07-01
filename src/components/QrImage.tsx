import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Renders `value` as a QR code image. A compatible mobile app can scan it to join. */
export function QrImage({ value, size = 220 }: { value: string; size?: number }): JSX.Element {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (error) return <div className="qr-error">QR error: {error}</div>;
  if (!dataUrl) return <div className="qr-skeleton" style={{ width: size, height: size }} />;
  return <img className="qr-img" src={dataUrl} width={size} height={size} alt="Session pairing QR code" />;
}
