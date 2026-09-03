const ROOM_TYPES = ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'living_dining', 'terrace', 'entrance', 'hall', 'corridor', 'laundry', 'storage', 'office', 'unknown'];

function isNumber(value) { return typeof value === 'number' && Number.isFinite(value); }
function validPoint(point) { return point && isNumber(point.x) && isNumber(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1; }
function validConfidence(value) { return isNumber(value) && value >= 0 && value <= 1; }
function validateArchitecturalModel(model) {
  const errors = [];
  if (!model || typeof model !== 'object') return { valid: false, errors: ['La respuesta no es un objeto JSON.'] };
  if (model.version !== '1.0') errors.push('version inválida.');
  if (!model.source || model.source.type !== 'sketch') errors.push('source.type inválido.');
  if (model.analysisMode !== 'multimodal') errors.push('analysisMode inválido.');
  ['perimeter', 'walls', 'doors', 'windows', 'rooms', 'labels', 'dimensions', 'furnitureEvidence', 'warnings'].forEach((key) => { if (!Array.isArray(model[key])) errors.push(`${key} debe ser un arreglo.`); });
  ['overall', 'geometry', 'rooms', 'openings', 'text'].forEach((key) => { if (!validConfidence(model.confidence?.[key])) errors.push(`confidence.${key} inválida.`); });
  if (Array.isArray(model.perimeter) && model.perimeter.some((point) => !validPoint(point))) errors.push('perimeter inválido.');
  const wallIds = new Set((model.walls || []).map((wall) => wall.id));
  const ids = new Set();
  (model.walls || []).forEach((wall) => { if (!wall.id || ids.has(wall.id)) errors.push('IDs de muros inválidos o duplicados.'); ids.add(wall.id); if (!validPoint(wall.start) || !validPoint(wall.end) || !validConfidence(wall.confidence)) errors.push(`Muro ${wall.id} inválido.`); });
  (model.doors || []).forEach((door) => { if (!door.id || (door.wallId !== null && !wallIds.has(door.wallId)) || !validConfidence(door.confidence)) errors.push(`Puerta ${door.id} inválida.`); });
  (model.windows || []).forEach((item) => { if (!item.id || (item.wallId !== null && !wallIds.has(item.wallId)) || !validConfidence(item.confidence)) errors.push(`Ventana ${item.id} inválida.`); });
  (model.rooms || []).forEach((room) => { if (!room.id || !ROOM_TYPES.includes(room.type) || !Array.isArray(room.polygon) || room.polygon.length < 3 || room.polygon.some((point) => !validPoint(point)) || !validConfidence(room.confidence)) errors.push(`Recinto ${room.id} inválido.`); });
  return { valid: errors.length === 0, errors };
}
module.exports = { validateArchitecturalModel };
