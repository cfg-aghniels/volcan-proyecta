(function(global){
  const MAX_FILE_SIZE = 12 * 1024 * 1024;
  const MAX_PROCESS_SIDE = 1600;
  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  function validateSketchFile(file){
    if (!file) return { valid: false, error: 'No se seleccionó ningún archivo.' };
    const type = file.type.toLowerCase();
    const isAccepted = ACCEPTED_TYPES.includes(type) || /\.(jpg|jpeg|png|webp)$/i.test(file.name);
    if (!isAccepted) return { valid: false, error: 'Formato no soportado. Sube JPG, JPEG, PNG o WEBP.' };
    if (file.size <= 0) return { valid: false, error: 'El archivo está vacío.' };
    if (file.size > MAX_FILE_SIZE) return { valid: false, error: 'La imagen supera el tamaño recomendado. Usa una imagen menor a 12 MB.' };
    return { valid: true };
  }

  function readImageFromFile(file){
    return new Promise((resolve, reject) => {
      const validation = validateSketchFile(file);
      if (!validation.valid) return reject(new Error(validation.error));

      const startedAt = performance.now();
      console.log('[Sketch] image:read:start', { fileName: file.name, size: file.size });

      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          console.log('[Sketch] image:loaded', { ms: (performance.now() - startedAt).toFixed(0) });
          resolve({ file, src: reader.result, image });
        };
        image.onerror = () => {
          console.error('[Sketch] image:load-error');
          reject(new Error('No se pudo decodificar la imagen.'));
        };
        image.src = reader.result;
      };
      reader.onerror = () => {
        console.error('[Sketch] image:read-error');
        reject(new Error('No se pudo leer el archivo.'));
      };
      reader.readAsDataURL(file);
    });
  }

  function prepareSketchImage(image, options = {}){
    const maxSide = options.maxSide || MAX_PROCESS_SIDE;
    const naturalWidth = Number(image.naturalWidth || 0);
    const naturalHeight = Number(image.naturalHeight || 0);

    if (!naturalWidth || !naturalHeight) {
      throw new Error('La imagen no tiene dimensiones válidas.');
    }

    const scale = Math.min(maxSide / naturalWidth, maxSide / naturalHeight, 1);
    const width = Math.max(400, Math.round(naturalWidth * scale));
    const height = Math.max(400, Math.round(naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const processed = normalizeImageData(imageData, options);
    ctx.putImageData(processed, 0, 0);

    const processedImage = canvas.toDataURL('image/jpeg', 0.9);
    return { width, height, canvas, processedImage };
  }

  function normalizeImageData(imageData, options = {}){
    const { contrast = 1.25, threshold = 170 } = options;
    const data = imageData.data;
    const output = new ImageData(new Uint8ClampedArray(data), imageData.width, imageData.height);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
      let adjusted = luminance * contrast;
      adjusted = Math.max(0, Math.min(255, adjusted));
      const value = adjusted < threshold ? 0 : 255;

      output.data[i] = value;
      output.data[i + 1] = value;
      output.data[i + 2] = value;
      output.data[i + 3] = 255;
    }

    return output;
  }

  function buildSketchAsset(file){
    const startedAt = performance.now();
    console.log('[Sketch] preprocessing:start', { fileName: file.name });

    return readImageFromFile(file).then(({ image, src }) => {
      const prepared = prepareSketchImage(image, { maxSide: MAX_PROCESS_SIDE, threshold: 180 });
      const elapsed = (performance.now() - startedAt).toFixed(0);
      console.log('[Sketch] preprocessing:done', { ms: elapsed, width: prepared.width, height: prepared.height });

      return {
        fileName: file.name,
        sourceType: file.type,
        width: image.naturalWidth,
        height: image.naturalHeight,
        originalImage: src,
        processedImage: prepared.processedImage,
        processedCanvas: prepared.canvas,
        previewUrl: src
      };
    });
  }

  global.VOLCAN_SKETCH = Object.assign(global.VOLCAN_SKETCH || {}, {
    MAX_PROCESS_SIDE,
    ACCEPTED_TYPES,
    MAX_FILE_SIZE,
    validateSketchFile,
    readImageFromFile,
    prepareSketchImage,
    buildSketchAsset
  });
})(window);
