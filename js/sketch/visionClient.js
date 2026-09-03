(function(global){
  const AI_MODE = 'available';
  const DEFAULT_API_BASE = 'http://localhost:8787';
  const REQUEST_TIMEOUT_MS = 45000;

  function getApiBase(){ return global.VOLCAN_SKETCH_API_BASE || DEFAULT_API_BASE; }
  function withTimeout(promise){
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('El servicio multimodal excedió el tiempo límite.')), REQUEST_TIMEOUT_MS))]);
  }
  async function getAvailability(){
    try {
      const response = await withTimeout(fetch(`${getApiBase()}/api/health`));
      if (!response.ok) return { available: false };
      const health = await response.json();
      return { available: health.aiMode === AI_MODE };
    } catch { return { available: false }; }
  }
  async function interpretSketchWithAI(asset, context = {}){
    console.log('[Sketch AI] request:start');
    const response = await withTimeout(fetch(`${getApiBase()}/api/sketch/interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: asset.processedImage,
        imageWidth: asset.width,
        imageHeight: asset.height,
        optionalProjectType: context.projectType || null,
        optionalKnownArea: context.area || null,
        optionalKnownDimension: context.knownDimension || null
      })
    }));
    if (!response.ok) throw new Error(`Servicio multimodal respondió ${response.status}.`);
    const payload = await response.json();
    console.log('[Sketch AI] request:done');
    console.log('[Sketch AI] validation:start');
    const validation = global.VOLCAN_SKETCH.validateArchitecturalModel(payload.model);
    if (!validation.valid) throw new Error(`JSON multimodal inválido: ${validation.errors.join(' ')}`);
    console.log('[Sketch AI] validation:done');
    return payload.model;
  }
  global.VOLCAN_SKETCH = Object.assign(global.VOLCAN_SKETCH || {}, { AI_MODE, getAvailability, interpretSketchWithAI });
})(window);
