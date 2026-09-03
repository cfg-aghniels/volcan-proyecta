(function(global){
  function renderWallPreview(target, walls, options = {}){
    if (!target) return;
    target.innerHTML = '';
    walls.forEach((wall, index) => {
      const el = document.createElement('div');
      const x = Math.min(95, Math.max(0, (wall.start.x || 0) * 100));
      const y = Math.min(95, Math.max(0, (wall.start.y || 0) * 100));
      const dx = ((wall.end.x || wall.start.x) - (wall.start.x || 0)) * 100;
      const dy = ((wall.end.y || wall.start.y) - (wall.start.y || 0)) * 100;
      const length = Math.max(Math.abs(dx), Math.abs(dy));
      const isVertical = Math.abs(dy) > Math.abs(dx);

      el.className = options.className || 'detected-preview-wall';
      el.dataset.wallId = wall.id || index;
      el.style.left = `${x}%`;
      el.style.top = `${y}%`;
      el.style.width = `${isVertical ? 12 : Math.max(length, 10)}%`;
      el.style.height = `${isVertical ? Math.max(length, 10) : 12}%`;
      if (isVertical) {
        el.style.left = `${x}%`;
        el.style.top = `${y}%`;
      }
      target.appendChild(el);
    });
  }

  function renderSketchReview(plan, target){
    if (!target) return;
    target.innerHTML = '';
    const walls = Array.isArray(plan.walls) ? plan.walls : [];
    walls.forEach((wall, index) => {
      const wallEl = document.createElement('div');
      wallEl.className = 'detected-editor-wall';
      wallEl.dataset.wallId = wall.id || index;
      const startX = (wall.start.x || 0) * 100;
      const startY = (wall.start.y || 0) * 100;
      const endX = (wall.end.x || wall.start.x) * 100;
      const endY = (wall.end.y || wall.start.y) * 100;
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);
      const horizontal = width >= height;
      wallEl.style.left = `${Math.min(startX, endX)}%`;
      wallEl.style.top = `${Math.min(startY, endY)}%`;
      wallEl.style.width = `${horizontal ? Math.max(width, 6) : 4}%`;
      wallEl.style.height = `${horizontal ? 4 : Math.max(height, 6)}%`;
      wallEl.style.borderRadius = '2px';
      target.appendChild(wallEl);
    });

    const wallById = new Map(walls.map((wall) => [wall.id, wall]));
    (plan.rooms || []).forEach((room) => {
      if (!Array.isArray(room.polygon) || !room.polygon.length) return;
      const center = room.polygon.reduce((point, current) => ({ x: point.x + current.x, y: point.y + current.y }), { x: 0, y: 0 });
      center.x /= room.polygon.length;
      center.y /= room.polygon.length;
      const label = document.createElement('span');
      label.className = 'sketch-room-label';
      label.textContent = room.name || 'Recinto';
      label.style.left = `${center.x * 100}%`;
      label.style.top = `${center.y * 100}%`;
      target.appendChild(label);
    });

    [...(plan.doors || []), ...(plan.windows || [])].forEach((opening) => {
      const wall = wallById.get(opening.wallId);
      if (!wall || !wall.start || !wall.end) return;
      const position = Number.isFinite(opening.position) ? opening.position : 0.5;
      const point = { x: wall.start.x + (wall.end.x - wall.start.x) * position, y: wall.start.y + (wall.end.y - wall.start.y) * position };
      const openingEl = document.createElement('i');
      openingEl.className = `sketch-opening ${opening.type}`;
      openingEl.style.left = `${point.x * 100}%`;
      openingEl.style.top = `${point.y * 100}%`;
      target.appendChild(openingEl);
    });

    if (global.VOLCAN_SKETCH?.DEBUG_SKETCH === true && plan.debugGeometry) {
      const appendDebugSegment = (segment, className) => {
        const debugEl = document.createElement('div');
        const horizontal = Math.abs(segment.end.x - segment.start.x) >= Math.abs(segment.end.y - segment.start.y);
        debugEl.className = `sketch-debug-segment ${className}`;
        debugEl.style.left = `${Math.min(segment.start.x, segment.end.x) * 100}%`;
        debugEl.style.top = `${Math.min(segment.start.y, segment.end.y) * 100}%`;
        debugEl.style.width = `${horizontal ? Math.max(Math.abs(segment.end.x - segment.start.x) * 100, 1) : 0.8}%`;
        debugEl.style.height = `${horizontal ? 0.8 : Math.max(Math.abs(segment.end.y - segment.start.y) * 100, 1)}%`;
        target.appendChild(debugEl);
      };
      plan.debugGeometry.rawSegments.forEach((segment) => appendDebugSegment(segment, 'raw'));
      plan.debugGeometry.discardedSegments.forEach((segment) => appendDebugSegment(segment, 'discarded'));
      plan.debugGeometry.normalizedWalls.forEach((segment) => appendDebugSegment(segment, 'normalized'));
      plan.debugGeometry.intersections.forEach((point) => {
        const node = document.createElement('i');
        node.className = 'sketch-debug-node';
        node.style.left = `${point.x * 100}%`;
        node.style.top = `${point.y * 100}%`;
        target.appendChild(node);
      });
    }
  }

  global.VOLCAN_SKETCH = Object.assign(global.VOLCAN_SKETCH || {}, {
    renderWallPreview,
    renderSketchReview
  });
})(window);
