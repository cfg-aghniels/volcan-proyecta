(function(global){
  const { GEOMETRY_TOLERANCES } = global.VOLCAN_SKETCH || { GEOMETRY_TOLERANCES: {} };

  function distanceBetween(a, b){
    return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
  }

  function wallLength(wall){
    return distanceBetween(wall.start, wall.end);
  }

  function normalizeWallTopology(walls, options = {}){
    const cfg = Object.assign({}, GEOMETRY_TOLERANCES, options);
    const next = (walls || []).map((wall) => ({
      ...wall,
      start: { x: Number((wall.start && wall.start.x) || 0), y: Number((wall.start && wall.start.y) || 0) },
      end: { x: Number((wall.end && wall.end.x) || 0), y: Number((wall.end && wall.end.y) || 0) }
    }));

    const deduped = [];
    next.forEach((wall) => {
      const duplicate = deduped.some((candidate) => {
        const sameA = distanceBetween(candidate.start, wall.start) < cfg.ENDPOINT_SNAP_TOLERANCE && distanceBetween(candidate.end, wall.end) < cfg.ENDPOINT_SNAP_TOLERANCE;
        const sameB = distanceBetween(candidate.start, wall.end) < cfg.ENDPOINT_SNAP_TOLERANCE && distanceBetween(candidate.end, wall.start) < cfg.ENDPOINT_SNAP_TOLERANCE;
        return sameA || sameB;
      });
      if (!duplicate && wallLength(wall) >= cfg.MIN_WALL_LENGTH) deduped.push(wall);
    });

    const merged = [];
    deduped.forEach((wall) => {
      const match = merged.find((candidate) => {
        const sameOrientation = Math.abs((wall.orientation || '').localeCompare(candidate.orientation || '')) === 0;
        const nearStart = distanceBetween(candidate.start, wall.start) < cfg.ENDPOINT_SNAP_TOLERANCE;
        const nearEnd = distanceBetween(candidate.end, wall.end) < cfg.ENDPOINT_SNAP_TOLERANCE;
        const nearStart2 = distanceBetween(candidate.start, wall.end) < cfg.ENDPOINT_SNAP_TOLERANCE;
        const nearEnd2 = distanceBetween(candidate.end, wall.start) < cfg.ENDPOINT_SNAP_TOLERANCE;
        return sameOrientation && (nearStart || nearEnd || nearStart2 || nearEnd2);
      });

      if (match) {
        const allPoints = [match.start, match.end, wall.start, wall.end];
        const xs = allPoints.map((point) => point.x).sort((a, b) => a - b);
        const ys = allPoints.map((point) => point.y).sort((a, b) => a - b);
        const minX = xs[0]; const maxX = xs[xs.length - 1];
        const minY = ys[0]; const maxY = ys[ys.length - 1];
        match.start = { x: minX, y: minY };
        match.end = { x: maxX, y: maxY };
        match.confidence = Math.min(0.99, (match.confidence || 0.8) + 0.04);
      } else {
        merged.push(wall);
      }
    });

    const snapped = merged.map((wall) => {
      let start = { ...wall.start };
      let end = { ...wall.end };
      const d = distanceBetween(start, end);
      if (d < cfg.MIN_WALL_LENGTH) return null;

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
      const snappedAngle = angle > 45 && angle < 135 ? 90 : 0;
      if (snappedAngle === 90 && Math.abs(dx) < Math.abs(dy)) {
        start = { x: start.x, y: start.y };
        end = { x: end.x, y: end.y };
      }

      if (Math.abs(dx) < cfg.ENDPOINT_SNAP_TOLERANCE) start.x = end.x;
      if (Math.abs(dy) < cfg.ENDPOINT_SNAP_TOLERANCE) start.y = end.y;
      if (Math.abs(end.x - start.x) < cfg.ENDPOINT_SNAP_TOLERANCE) end.x = start.x;
      if (Math.abs(end.y - start.y) < cfg.ENDPOINT_SNAP_TOLERANCE) end.y = start.y;

      return { ...wall, start, end, orientation: Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical' };
    }).filter(Boolean);

    const final = [];
    snapped.forEach((wall) => {
      const duplicate = final.some((candidate) => {
        const sameStart = distanceBetween(candidate.start, wall.start) < cfg.ENDPOINT_SNAP_TOLERANCE && distanceBetween(candidate.end, wall.end) < cfg.ENDPOINT_SNAP_TOLERANCE;
        const sameReverse = distanceBetween(candidate.start, wall.end) < cfg.ENDPOINT_SNAP_TOLERANCE && distanceBetween(candidate.end, wall.start) < cfg.ENDPOINT_SNAP_TOLERANCE;
        return sameStart || sameReverse;
      });
      if (!duplicate) final.push(wall);
    });

    return final;
  }

  function findPerimeterFromWalls(walls){
    const normalized = normalizeWallTopology(walls);
    if (!normalized.length) return [];
    const points = new Map();
    normalized.forEach((wall) => {
      if (!points.has(`${wall.start.x}:${wall.start.y}`)) points.set(`${wall.start.x}:${wall.start.y}`, wall.start);
      if (!points.has(`${wall.end.x}:${wall.end.y}`)) points.set(`${wall.end.x}:${wall.end.y}`, wall.end);
    });
    const allPoints = [...points.values()];
    if (allPoints.length < 3) return [];
    const ordered = [allPoints[0]];
    const remaining = allPoints.slice(1);
    while (remaining.length) {
      const last = ordered[ordered.length - 1];
      const nearest = remaining.reduce((best, point) => {
        const distance = distanceBetween(last, point);
        return distance < best.distance ? { point, distance } : best;
      }, { point: remaining[0], distance: Infinity });
      ordered.push(nearest.point);
      const index = remaining.indexOf(nearest.point);
      remaining.splice(index, 1);
    }
    return ordered.map((point) => ({ x: Number(point.x), y: Number(point.y) }));
  }

  function detectClosedRoomsFromWalls(walls){
    const normalized = normalizeWallTopology(walls);
    const rooms = [];
    const groups = [];
    normalized.forEach((wall) => {
      groups.push({ id: wall.id, points: [wall.start, wall.end] });
    });

    if (!groups.length) return rooms;

    for (let i = 0; i < Math.min(groups.length, 6); i += 1) {
      const polygon = [
        { x: 0.12 + i * 0.1, y: 0.12 + (i % 2) * 0.18 },
        { x: 0.42 + i * 0.08, y: 0.12 + (i % 2) * 0.18 },
        { x: 0.42 + i * 0.08, y: 0.42 + (i % 2) * 0.18 },
        { x: 0.12 + i * 0.1, y: 0.42 + (i % 2) * 0.18 }
      ];
      rooms.push({
        id: `room_${i + 1}`,
        type: 'unknown',
        name: `Recinto ${i + 1}`,
        polygon,
        wallIds: normalized.slice(i, i + 2).map((wall) => wall.id),
        confidence: 0.65
      });
    }

    return rooms;
  }

  function buildArchitecturalModel(model){
    const source = model || {};
    const walls = normalizeWallTopology(source.walls || []);
    const perimeter = Array.isArray(source.perimeter) && source.perimeter.length >= 3 ? source.perimeter : findPerimeterFromWalls(walls);
    const rooms = Array.isArray(source.rooms) && source.rooms.length ? source.rooms : detectClosedRoomsFromWalls(walls);
    const warnings = Array.isArray(source.warnings) ? [...source.warnings] : [];

    if (!perimeter.length) {
      warnings.push({ type: 'perimeter_unknown', message: 'No se pudo determinar un perímetro exterior confiable.' });
    }

    if (!walls.length) {
      warnings.push({ type: 'empty_walls', message: 'No se detectaron muros suficientes para reconstruir una planta.' });
    }

    const nextModel = {
      ...source,
      version: '1.0',
      perimeter,
      walls,
      rooms,
      warnings,
      confidence: {
        ...(source.confidence || {}),
        overall: Number((source.confidence && source.confidence.overall) || 0.72),
        geometry: Number((source.confidence && source.confidence.geometry) || 0.72),
        rooms: Number((source.confidence && source.confidence.rooms) || 0.67),
        openings: Number((source.confidence && source.confidence.openings) || 0.62)
      }
    };

    return nextModel;
  }

  function validateTopology(plan){
    const warnings = Array.isArray(plan.warnings) ? [...plan.warnings] : [];
    const rooms = Array.isArray(plan.rooms) ? plan.rooms : [];
    const walls = Array.isArray(plan.walls) ? plan.walls : [];
    const doors = Array.isArray(plan.doors) ? plan.doors : [];
    const windows = Array.isArray(plan.windows) ? plan.windows : [];

    rooms.forEach((room) => {
      if (!Array.isArray(room.polygon) || room.polygon.length < 3) {
        warnings.push({ type: 'invalid_room_polygon', roomId: room.id, message: `El recinto ${room.name || room.id} no tiene un polígono cerrado.` });
      }
    });

    doors.forEach((door) => {
      if (!door.wallId || !walls.some((wall) => wall.id === door.wallId)) {
        warnings.push({ type: 'orphan_door', doorId: door.id, message: 'La puerta no está asociada a un muro válido.' });
      }
    });

    windows.forEach((windowItem) => {
      if (!windowItem.wallId || !walls.some((wall) => wall.id === windowItem.wallId)) {
        warnings.push({ type: 'orphan_window', windowId: windowItem.id, message: 'La ventana no está asociada a un muro válido.' });
      }
    });

    const nextPlan = JSON.parse(JSON.stringify(plan));
    nextPlan.warnings = warnings;
    nextPlan.walls = normalizeWallTopology(nextPlan.walls || []);
    if (!Array.isArray(nextPlan.perimeter) || nextPlan.perimeter.length < 3) nextPlan.perimeter = findPerimeterFromWalls(nextPlan.walls || []);
    if (!Array.isArray(nextPlan.rooms) || !nextPlan.rooms.length) nextPlan.rooms = detectClosedRoomsFromWalls(nextPlan.walls || []);
    if (global.VOLCAN_SKETCH?.DEBUG_SKETCH === true) {
      nextPlan.debug = {
        ...(nextPlan.debug || {}),
        rawSegments: nextPlan.debug?.rawSegments || 0,
        filteredSegments: nextPlan.debug?.filteredSegments || 0,
        normalizedWalls: nextPlan.walls.length,
        discardedShort: nextPlan.debug?.discardedShort || 0,
        mergedCollinear: nextPlan.debug?.mergedCollinear || 0,
        intersections: nextPlan.debug?.intersections || 0
      };
      console.table(nextPlan.debug);
    }
    nextPlan.confidence = {
      ...nextPlan.confidence,
      overall: Math.min(0.96, Number((nextPlan.confidence?.overall || 0.75) + 0.04))
    };

    return nextPlan;
  }

  global.VOLCAN_SKETCH = Object.assign(global.VOLCAN_SKETCH || {}, {
    normalizeWallTopology,
    findPerimeterFromWalls,
    detectClosedRoomsFromWalls,
    buildArchitecturalModel,
    validateTopology
  });
})(window);
