(function(global){
  const DEBUG_SKETCH = false;
  const DEFAULT_CONFIDENCE = { high: 0.85, medium: 0.65, low: 0.65 };

  const GEOMETRY_TOLERANCES = {
    ANGLE_SNAP_TOLERANCE: 3,
    ENDPOINT_SNAP_TOLERANCE: 0.018,
    MIN_WALL_LENGTH: 0.035,
    COLLINEAR_TOLERANCE: 0.018,
    MAX_WALL_LENGTH: 1,
    MIN_ROOM_POINTS: 3
  };

  function normalizeCoord(value){
    if (typeof value !== 'number' || Number.isNaN(value)) return 0;
    return Math.min(1, Math.max(0, value));
  }

  function buildPoint(x, y){
    return { x: normalizeCoord(x), y: normalizeCoord(y) };
  }

  function createSketchPlan(overrides){
    return Object.assign({
      version: '1.0',
      source: { type: 'sketch', filename: '', imageWidth: 0, imageHeight: 0 },
      scale: { status: 'unknown', metersPerUnit: null, reference: null },
      perimeter: [],
      walls: [],
      doors: [],
      windows: [],
      rooms: [],
      labels: [],
      furniture: [],
      warnings: [],
      confidence: { overall: 0, geometry: 0, rooms: 0, openings: 0 },
      mode: 'local',
      generatedAt: new Date().toISOString()
    }, overrides || {});
  }

  function createArchitecturalModel(overrides){
    return createSketchPlan({
      version: '1.0',
      source: { type: 'sketch', filename: '', imageWidth: 0, imageHeight: 0 },
      scale: { status: 'unknown', metersPerUnit: null, reference: 'Dimensiones aproximadas' },
      perimeter: [],
      walls: [],
      doors: [],
      windows: [],
      rooms: [],
      labels: [],
      furniture: [],
      warnings: [],
      confidence: { overall: 0.7, geometry: 0.7, rooms: 0.65, openings: 0.6 },
      mode: 'local',
      generatedAt: new Date().toISOString(),
      debug: DEBUG_SKETCH
    }, overrides || {});
  }

  function createWallSegment({ start, end, thickness = 0.12, height = 2.6, orientation = 'horizontal', confidence = 0.8, id = null, source = 'local', roomIds = [] }){
    const wall = {
      id: id || `wall_${Math.random().toString(36).slice(2, 9)}`,
      type: 'wall',
      start: buildPoint(start.x, start.y),
      end: buildPoint(end.x, end.y),
      thickness: Math.max(0.04, Math.min(0.22, thickness)),
      height: Number(height || 2.6),
      orientation,
      confidence: Math.max(0, Math.min(1, confidence)),
      roomIds: Array.isArray(roomIds) ? roomIds : [],
      source
    };
    return wall;
  }

  function createRoom({ id, type = 'unknown', name = 'Recinto', polygon = [], wallIds = [], confidence = 0.65 }){
    return {
      id: id || `room_${Math.random().toString(36).slice(2, 9)}`,
      type,
      name,
      polygon: (polygon || []).map((point) => buildPoint(point.x, point.y)),
      wallIds: Array.isArray(wallIds) ? wallIds : [],
      confidence: Math.max(0, Math.min(1, confidence))
    };
  }

  function createDoor({ id, wallId, position = 0.5, width = 0.8, orientation = 'horizontal', confidence = 0.72, source = 'local' }){
    return {
      id: id || `door_${Math.random().toString(36).slice(2, 9)}`,
      type: 'door',
      wallId,
      position: Math.max(0, Math.min(1, position)),
      width: Math.max(0.2, Math.min(1.5, width)),
      orientation,
      confidence: Math.max(0, Math.min(1, confidence)),
      source
    };
  }

  function createWindow({ id, wallId, position = 0.5, width = 0.8, confidence = 0.72, source = 'local' }){
    return {
      id: id || `window_${Math.random().toString(36).slice(2, 9)}`,
      type: 'window',
      wallId,
      position: Math.max(0, Math.min(1, position)),
      width: Math.max(0.2, Math.min(1.5, width)),
      confidence: Math.max(0, Math.min(1, confidence)),
      source
    };
  }

  function createWarning(type, message, extra = {}){
    return Object.assign({ type, message }, extra);
  }

  function labelRoomName(input){
    const text = (input || '').toString().trim().toLowerCase();
    const normalized = text.replace(/[^a-záéíóúüñ]/g, '');

    const aliases = {
      dormitorio: ['dormitorio', 'dorm', 'habitacion', 'hab', 'habitaci\u00f3n'],
      bedroom: ['dormitorio', 'dorm', 'habitacion', 'dormitorio principal', 'room'],
      bathroom: ['ba\u00f1o', 'bano', 'wc', 'bath'],
      kitchen: ['cocina', 'kitchen'],
      living: ['living', 'salon', 'sal\u00f3n', 'sala'],
      dining: ['comedor', 'dining'],
      livingDining: ['living comedor', 'living-comedor', 'salon comedor'],
      hall: ['hall', 'pasillo', 'vestibulo'],
      terrace: ['terraza', 'terrazza'],
      loggia: ['loggia'],
      storage: ['bodega', 'almacen', 'storage'],
      office: ['escritorio', 'office'],
      laundry: ['lavanderia', 'lavander\u00eda', 'laundry']
    };

    for (const [key, values] of Object.entries(aliases)) {
      if (values.some((candidate) => normalized.includes(candidate.replace(/[^a-záéíóúüñ]/g, '')))) {
        return key;
      }
    }

    return 'unknown';
  }

  function estimateConfidenceLabel(confidence){
    if (confidence >= DEFAULT_CONFIDENCE.high) return 'Alta';
    if (confidence >= DEFAULT_CONFIDENCE.medium) return 'Media';
    return 'Baja';
  }

  function validatePlan(plan){
    const errors = [];
    if (!plan || typeof plan !== 'object') return { valid: false, errors: ['El plano no es válido.'] };
    if (!Array.isArray(plan.walls)) errors.push('Faltan muros.');
    if (!Array.isArray(plan.rooms)) errors.push('Faltan recintos.');
    if (plan.doors && !Array.isArray(plan.doors)) errors.push('El arreglo de puertas no es válido.');
    if (plan.windows && !Array.isArray(plan.windows)) errors.push('El arreglo de ventanas no es válido.');

    return {
      valid: errors.length === 0,
      errors
    };
  }

  global.VOLCAN_SKETCH = Object.assign(global.VOLCAN_SKETCH || {}, {
    DEBUG_SKETCH,
    GEOMETRY_TOLERANCES,
    DEFAULT_CONFIDENCE,
    createSketchPlan,
    createArchitecturalModel,
    createWallSegment,
    createRoom,
    createDoor,
    createWindow,
    createWarning,
    normalizeCoord,
    buildPoint,
    labelRoomName,
    estimateConfidenceLabel,
    validatePlan
  });
})(window);
