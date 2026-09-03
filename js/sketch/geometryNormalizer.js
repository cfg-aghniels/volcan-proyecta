(function(global){
  function snapAngle(degrees){
    const normalized = Math.abs((degrees % 180 + 180) % 180);
    if (normalized <= 3 || normalized >= 177) return 0;
    if (Math.abs(normalized - 90) <= 3) return 90;
    return degrees;
  }

  function normalizeWallGeometry(wall){
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const snapped = snapAngle(angle);
    const orientation = Math.abs(snapped) === 90 ? 'vertical' : Math.abs(snapped) <= 3 ? 'horizontal' : wall.orientation;

    if (orientation === 'horizontal') {
      return {
        ...wall,
        start: { x: wall.start.x, y: wall.start.y },
        end: { x: wall.end.x, y: wall.end.y },
        orientation,
        confidence: Math.min(0.99, Number((wall.confidence || 0.75) + 0.08))
      };
    }

    return {
      ...wall,
      start: { x: wall.start.x, y: wall.start.y },
      end: { x: wall.end.x, y: wall.end.y },
      orientation,
      confidence: Math.min(0.99, Number((wall.confidence || 0.75) + 0.08))
    };
  }

  function normalizePlan(plan){
    const normalized = JSON.parse(JSON.stringify(plan));
    normalized.walls = (normalized.walls || []).map(normalizeWallGeometry);
    normalized.doors = (normalized.doors || []).map((door) => ({ ...door, width: Math.max(0.4, Math.min(1.3, door.width || 0.8)) }));
    normalized.windows = (normalized.windows || []).map((windowItem) => ({ ...windowItem, width: Math.max(0.35, Math.min(1.4, windowItem.width || 0.8)) }));
    return normalized;
  }

  global.VOLCAN_SKETCH = Object.assign(global.VOLCAN_SKETCH || {}, {
    snapAngle,
    normalizeWallGeometry,
    normalizePlan
  });
})(window);
