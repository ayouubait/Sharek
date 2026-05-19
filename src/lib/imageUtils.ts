/**
 * Redimensionne et recadre une image au ratio cible (16:9 par défaut)
 * en la centrant verticalement et horizontalement.
 * Retourne un Blob au format WebP si supporté, sinon JPEG, sinon PNG.
 */
export function resizeAndCropImage(
  file: File,
  targetRatio = 16 / 9,
  maxWidth = 1200,
  quality = 0.85
): Promise<{ blob: Blob; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;

      if (srcW === 0 || srcH === 0) {
        reject(new Error("L'image semble corrompue ou vide (dimensions nulles)."));
        return;
      }

      const srcRatio = srcW / srcH;

      let cropW: number;
      let cropH: number;

      // Détermine les dimensions de recadrage pour respecter le ratio cible
      if (srcRatio > targetRatio) {
        // Image trop large → on coupe les côtés
        cropH = srcH;
        cropW = srcH * targetRatio;
      } else {
        // Image trop haute → on coupe le haut/bas
        cropW = srcW;
        cropH = srcW / targetRatio;
      }

      // Centre le recadrage
      const cropX = (srcW - cropW) / 2;
      const cropY = (srcH - cropH) / 2;

      // Dimensions finales (respecte maxWidth)
      let outW = cropW;
      let outH = cropH;
      if (outW > maxWidth) {
        outW = maxWidth;
        outH = outW / targetRatio;
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(outW));
      canvas.height = Math.max(1, Math.round(outH));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Impossible d\'obtenir le contexte 2D'));
        return;
      }

      // Dessine l'image recadrée et redimensionnée
      ctx.drawImage(
        img,
        cropX,
        cropY,
        cropW,
        cropH,
        0,
        0,
        canvas.width,
        canvas.height
      );

      // Essaie WebP d'abord, fallback JPEG, fallback PNG si le navigateur ne le supporte pas
      const tryExport = (mime: string) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, mimeType: mime });
            } else if (mime === 'image/webp') {
              // Fallback JPEG
              tryExport('image/jpeg');
            } else if (mime === 'image/jpeg') {
              // Dernier recours : PNG (toujours supporté)
              tryExport('image/png');
            } else {
              reject(new Error('Échec de la conversion en blob (WebP, JPEG et PNG ont échoué)'));
            }
          },
          mime,
          mime === 'image/png' ? undefined : quality
        );
      };

      tryExport('image/webp');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Échec du chargement de l\'image'));
    };

    img.src = url;
  });
}