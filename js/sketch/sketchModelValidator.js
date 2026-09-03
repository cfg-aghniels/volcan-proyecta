(function(global){
  const ROOM_TYPES = ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'living_dining', 'terrace', 'entrance', 'hall', 'corridor', 'laundry', 'storage', 'office', 'unknown'];

  function isNumber(value){ return typeof value === 'number' && Number.isFinite(value); }
  function validPoint(point){ return point && isNumber(point.x) && isNumber(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1; }
  function validConfidence(value){ return isNumber(value) && value >= 0 && value <= 1; }
  function hasId(value){ return typeof value === 'string' && value.trim().length > 0; }
  function uniqueIds(items, label, errors){
    const ids = new Set();
    (items || []).forEach((item) => {
      if (!hasId(item.id)) errors.push(`${label} sin id.`);
      if (ids.has(item.id)) errors.push(`${label} con id duplicado: ${item.id}.`);
      ids.add(item.id);
    });
  }

  function validateArchitecturalModel(model){
    const errors = [];
    if (!model || typeof model !== 'object') return { valid: false, errors: ['La respuesta no es un objeto JSON.'] };
    if (model.version !== '1.0') errors.push('version debe ser 1.0.');
    if (!model.source || model.source.type !== 'sketch') errors.push('source.type debe ser sketch.');
    if (!['multimodal', 'local'].includes(model.analysisMode || model.mode)) errors.push('analysisMode inválido.');
    ['perimeter', 'walls', 'doors', 'windows', 'rooms', 'labels', 'dimensions', 'furnitureEvidence', 'warnings'].forEach((key) => {
      if (!Array.isArray(model[key])) errors.push(`${key} debe ser un arreglo.`);
    });
    ['overall', 'geometry', 'rooms', 'openings', 'text'].forEach((key) => {
      if (!validConfidence(model.confidence?.[key])) errors.push(`confidence.${key} inválida.`);
    });
    if (model.perimeter.some((point) => !validPoint(point))) errors.push('El perímetro contiene coordenadas inválidas.');
    uniqueIds(model.walls, 'Muro', errors);
    uniqueIds(model.doors, 'Puerta', errors);
    uniqueIds(model.windows, 'Ventana', errors);
    uniqueIds(model.rooms, 'Recinto', errors);
    const wallIds = new Set(model.walls.map((wall) => wall.id));
    const roomIds = new Set(model.rooms.map((room) => room.id));
    model.walls.forEach((wall) => {
      if (!validPoint(wall.start) || !validPoint(wall.end)) errors.push(`Muro ${wall.id} con coordenadas inválidas.`);
      if (!validConfidence(wall.confidence)) errors.push(`Muro ${wall.id} con confidence inválida.`);
    });
    model.doors.forEach((door) => {
      if (door.wallId !== null && !wallIds.has(door.wallId)) errors.push(`Puerta ${door.id} referencia un muro inexistente.`);
      if (!validConfidence(door.confidence)) errors.push(`Puerta ${door.id} con confidence inválida.`);
    });
    model.windows.forEach((windowItem) => {
      if (windowItem.wallId !== null && !wallIds.has(windowItem.wallId)) errors.push(`Ventana ${windowItem.id} referencia un muro inexistente.`);
      if (!validConfidence(windowItem.confidence)) errors.push(`Ventana ${windowItem.id} con confidence inválida.`);
    });
    model.rooms.forEach((room) => {
      if (!ROOM_TYPES.includes(room.type)) errors.push(`Tipo de recinto inválido: ${room.type}.`);
      if (!Array.isArray(room.polygon) || room.polygon.length < 3 || room.polygon.some((point) => !validPoint(point))) errors.push(`Recinto ${room.id} con polígono inválido.`);
      if (!validConfidence(room.confidence)) errors.push(`Recinto ${room.id} con confidence inválida.`);
      (room.wallIds || []).forEach((wallId) => { if (!wallIds.has(wallId)) errors.push(`Recinto ${room.id} referencia un muro inexistente.`); });
      (room.adjacentRoomIds || []).forEach((roomId) => { if (!roomIds.has(roomId)) errors.push(`Recinto ${room.id} referencia un recinto inexistente.`); });
    });
    model.dimensions.forEach((dimension) => {
      if (!isNumber(dimension.value) || !['m', 'cm'].includes(dimension.unit)) errors.push(`Cota ${dimension.id} inválida.`);
      if (dimension.associatedWallId !== null && !wallIds.has(dimension.associatedWallId)) errors.push(`Cota ${dimension.id} referencia un muro inexistente.`);
    });
    return { valid: errors.length === 0, errors };
  }

  global.VOLCAN_SKETCH = Object.assign(global.VOLCAN_SKETCH || {}, { ROOM_TYPES, validateArchitecturalModel });
})(window);
