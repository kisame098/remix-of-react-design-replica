// Compresse une image (avatar, logo, capture d'écran de preuve de paiement...)
// côté client avant stockage en base — pas de bucket Supabase Storage dans ce
// projet, les images sont conservées telles quelles en data URL (texte).
// format 'png' garde la transparence (ex: logo d'école) ; 'jpeg' (par défaut)
// compresse mieux pour une photo sans canal alpha.
export const compressImage = (dataUrl: string, maxSize = 320, format: 'jpeg' | 'png' = 'jpeg'): Promise<string> =>
  new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const ratio  = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(format === 'png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = dataUrl;
  });
