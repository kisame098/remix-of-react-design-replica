import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, X, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// La photo d'un élève : choisie dans les fichiers ou prise avec la caméra,
// réduite avant d'être gardée. Sert à l'inscription ET à la modification
// (Gestion des élèves) — c'est elle qui s'imprime sur la carte scolaire.

// ─── Compression image ───────────────────────────────────────────────────────

const compressImage = (dataUrl: string, maxSize = 320): Promise<string> =>
  new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const ratio  = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = dataUrl;
  });

// ─── Composant PhotoPicker ────────────────────────────────────────────────────

interface PhotoPickerProps {
  value: string;
  onChange: (v: string) => void;
  name?: string;
}

export const PhotoPicker = ({ value, onChange, name }: PhotoPickerProps) => {
  const fileRef   = useRef<HTMLInputElement>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream,     setStream]     = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [camError,   setCamError]   = useState('');
  const [capturing,  setCapturing]  = useState(false);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setCameraOpen(false);
    setCamError('');
  }, [stream]);

  const openCamera = async (facing: 'user' | 'environment' = facingMode) => {
    try {
      stream?.getTracks().forEach(t => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 640 } },
      });
      setStream(s);
      setFacingMode(facing);
      setCamError('');
      setCameraOpen(true);
    } catch {
      setCamError('Caméra non disponible ou accès refusé.');
      setCameraOpen(true);
    }
  };

  const switchCamera = () => openCamera(facingMode === 'user' ? 'environment' : 'user');

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || capturing) return;
    setCapturing(true);
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth  || 320;
    canvas.height = video.videoHeight || 320;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const compressed = await compressImage(canvas.toDataURL('image/jpeg', 0.9));
    onChange(compressed);
    stopCamera();
    setCapturing(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const compressed = await compressImage(ev.target?.result as string);
      onChange(compressed);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const initials = name
    ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '';

  return (
    <>
      <div className="flex flex-col sm:flex-row items-center gap-5">
        {/* Aperçu */}
        <div className={cn(
          'relative w-24 h-24 rounded-full border-2 flex-shrink-0 overflow-hidden bg-muted',
          value ? 'border-primary/50' : 'border-dashed border-muted-foreground/40',
        )}>
          {value ? (
            <img src={value} alt="Photo" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {initials
                ? <span className="text-2xl font-bold text-muted-foreground">{initials}</span>
                : <Camera className="h-8 w-8 text-muted-foreground/40" />
              }
            </div>
          )}
          {value && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-full"
            >
              <Upload className="h-5 w-5 text-white" />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            Photo de profil <span className="text-xs">(optionnelle)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-2 h-8 text-xs"
              onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Choisir une photo
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-2 h-8 text-xs"
              onClick={() => openCamera('user')}>
              <Camera className="h-3.5 w-3.5" /> Prendre en photo
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm"
                className="gap-2 h-8 text-xs text-destructive hover:text-destructive"
                onClick={() => onChange('')}>
                <X className="h-3.5 w-3.5" /> Supprimer
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground/60">JPG, PNG · Max 5 Mo · Redimensionnée automatiquement</p>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <canvas ref={canvasRef} className="hidden" />

      {/* Modal caméra */}
      <Dialog open={cameraOpen} onOpenChange={open => { if (!open) stopCamera(); }}>
        <DialogContent className="max-w-sm p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" /> Prendre une photo
            </DialogTitle>
          </DialogHeader>
          {camError ? (
            <div className="py-8 text-center text-muted-foreground">
              <Camera className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Caméra indisponible</p>
              <p className="text-xs mt-1 text-muted-foreground/70">{camError}</p>
              <Button variant="outline" size="sm" className="mt-4"
                onClick={() => { stopCamera(); fileRef.current?.click(); }}>
                <Upload className="h-4 w-4 mr-2" /> Choisir depuis les fichiers
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-40 h-40 rounded-full border-2 border-white/60" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="icon" onClick={switchCamera} className="h-11 w-11 flex-shrink-0">
                  <SwitchCamera className="h-5 w-5" />
                </Button>
                <Button type="button" className="flex-1 h-11 gap-2" onClick={capturePhoto} disabled={capturing}>
                  <Camera className="h-5 w-5" />
                  {capturing ? 'Capture…' : 'Capturer'}
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={stopCamera} className="h-11 w-11 flex-shrink-0">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

