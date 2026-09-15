import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { AlertCircle, Camera, Loader2 } from 'lucide-react';

interface QrScannerProps {
  onScan: (data: string) => void;
  /** Pause temporairement la lecture (ex: pendant qu'on traite un résultat) */
  paused?: boolean;
}

/**
 * Scanner de QR code via la caméra du téléphone/ordinateur — utilisé pour
 * retrouver un élève instantanément à partir de sa carte, sans recherche manuelle.
 * Nécessite un contexte sécurisé (HTTPS ou localhost) : les navigateurs bloquent
 * l'accès caméra sur du http:// simple (ex: une adresse IP locale en WiFi).
 */
export const QrScanner = ({ onScan, paused = false }: QrScannerProps) => {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number | null>(null);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);

  const [status, setStatus] = useState<'starting' | 'ready' | 'error'>('starting');
  const [error, setError]   = useState('');

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Caméra indisponible : le scan nécessite une connexion sécurisée (HTTPS) ou l\'accès depuis cet ordinateur (localhost).');
        setStatus('error');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('ready');
        tick();
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        const msg = name === 'NotAllowedError'
          ? 'Accès à la caméra refusé — autorisez-la dans les réglages du navigateur.'
          : name === 'NotFoundError'
          ? 'Aucune caméra détectée sur cet appareil.'
          : 'Impossible d\'accéder à la caméra.';
        setError(msg);
        setStatus('error');
      }
    };

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
          if (code?.data) {
            const now = Date.now();
            const last = lastScanRef.current;
            // Anti-doublon : ignore le même code scanné deux fois de suite en moins de 2s
            if (!last || last.value !== code.data || now - last.at > 2000) {
              lastScanRef.current = { value: code.data, at: now };
              onScan(code.data);
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10 px-4 gap-2">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden bg-black aspect-square max-w-xs mx-auto">
      <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      {status === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-xs">Activation de la caméra…</p>
        </div>
      )}

      {status === 'ready' && !paused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-3/4 aspect-square border-2 border-white/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          <Camera className="absolute bottom-3 h-4 w-4 text-white/70" />
        </div>
      )}

      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}
    </div>
  );
};
