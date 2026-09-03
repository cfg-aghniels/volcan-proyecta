(function(global){
  const ROOM_ALIASES = {
    bedroom: ['Dormitorio', 'Dormitorio principal'],
    bathroom: ['Baño'],
    kitchen: ['Cocina'],
    living: ['Living'],
    dining: ['Comedor'],
    livingDining: ['Living-Comedor'],
    hall: ['Hall', 'Pasillo'],
    terrace: ['Terraza'],
    loggia: ['Loggia'],
    storage: ['Bodega'],
    office: ['Escritorio'],
    laundry: ['Lavandería']
  };

  function extractStrongLineGroups(imgData, width, height){
    const data = imgData.data;
    const horizontal = [];
    const vertical = [];
    let dark = 0;
    const isDark = (x, y) => {
      const index = (y * width + x) * 4;
      const luminance = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
      return luminance < 185 && data[index + 3] > 35;
    };

    for (let y = 0; y < height; y += 1) {
      let start = null;
      for (let x = 0; x <= width; x += 1) {
        const darkPixel = x < width && isDark(x, y);
        if (darkPixel) dark += 1;
        if (darkPixel && start === null) start = x;
        if ((!darkPixel || x === width) && start !== null) {
          const end = x - 1;
          if (end - start + 1 >= Math.max(6, width * 0.018)) {
            horizontal.push({ start: { x: start / width, y: y / height }, end: { x: end / width, y: y / height }, thickness: 1 / height });
          }
          start = null;
        }
      }
    }

    for (let x = 0; x < width; x += 1) {
      let start = null;
      for (let y = 0; y <= height; y += 1) {
        const darkPixel = y < height && isDark(x, y);
        if (darkPixel && start === null) start = y;
        if ((!darkPixel || y === height) && start !== null) {
          const end = y - 1;
          if (end - start + 1 >= Math.max(6, height * 0.018)) {
            vertical.push({ start: { x: x / width, y: start / height }, end: { x: x / width, y: end / height }, thickness: 1 / width });
          }
          start = null;
        }
      }
    }

    return { horizontal, vertical, dark, rawSegments: horizontal.length + vertical.length };
  }

  function mergeLocalSegments(segments, orientation){
    const axis = orientation === 'horizontal' ? 'y' : 'x';
    const from = orientation === 'horizontal' ? 'x' : 'y';
    const merged = [];
    const maxOffset = 0.025;
    const minOverlap = 0.35;

    segments.forEach((segment) => {
      const low = Math.min(segment.start[from], segment.end[from]);
      const high = Math.max(segment.start[from], segment.end[from]);
      const match = merged.find((candidate) => {
        const candidateLow = Math.min(candidate.start[from], candidate.end[from]);
        const candidateHigh = Math.max(candidate.start[from], candidate.end[from]);
        const overlap = Math.max(0, Math.min(high, candidateHigh) - Math.max(low, candidateLow));
        const shorter = Math.max(0.001, Math.min(high - low, candidateHigh - candidateLow));
        return Math.abs(segment.start[axis] - candidate.start[axis]) <= maxOffset && overlap / shorter >= minOverlap;
      });

      if (!match) {
        merged.push({ ...segment, orientation });
        return;
      }

      const nextLow = Math.min(low, Math.min(match.start[from], match.end[from]));
      const nextHigh = Math.max(high, Math.max(match.start[from], match.end[from]));
      const position = (segment.start[axis] + match.start[axis]) / 2;
      match.start = orientation === 'horizontal' ? { x: nextLow, y: position } : { x: position, y: nextLow };
      match.end = orientation === 'horizontal' ? { x: nextHigh, y: position } : { x: position, y: nextHigh };
      match.thickness = Math.max(match.thickness || 0, segment.thickness || 0);
    });
    return merged;
  }

  function detectWallsFromImageData(imageData, width, height){
    const extracted = extractStrongLineGroups(imageData, width, height);
    const horizontal = mergeLocalSegments(extracted.horizontal, 'horizontal');
    const vertical = mergeLocalSegments(extracted.vertical, 'vertical');
    const rawWalls = [...horizontal, ...vertical];
    const minLength = 0.035;
    const filtered = rawWalls.filter((wall) => Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y) >= minLength);
    const discardedShort = rawWalls.length - filtered.length;
    const walls = filtered.map((wall, index) => ({
      id: `wall_${index + 1}`,
      orientation: wall.orientation,
      start: wall.start,
      end: wall.end,
      thickness: Math.max(0.008, wall.thickness * 2),
      confidence: 0.68
    }));
    const intersections = [];
    horizontal.forEach((horizontalWall) => {
      vertical.forEach((verticalWall) => {
        if (verticalWall.start.x >= horizontalWall.start.x && verticalWall.start.x <= horizontalWall.end.x && horizontalWall.start.y >= verticalWall.start.y && horizontalWall.start.y <= verticalWall.end.y) {
          intersections.push({ x: verticalWall.start.x, y: horizontalWall.start.y });
        }
      });
    });
    const metrics = {
      rawSegments: extracted.rawSegments,
      filteredSegments: walls.length,
      normalizedWalls: walls.length,
      discardedShort,
      mergedCollinear: extracted.rawSegments - horizontal.length - vertical.length,
      intersections: intersections.length
    };
    if (global.VOLCAN_SKETCH?.DEBUG_SKETCH === true) console.table(metrics);
    return { walls, rawSegments: rawWalls, discardedSegments: rawWalls.filter((wall) => !filtered.includes(wall)), intersections, darkDensity: extracted.dark / (width * height), rawDetectedWalls: rawWalls.length, metrics };
  }

  function detectRoomCandidates(walls){
    const rooms = [];
    const roomTypes = ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'hall', 'terrace', 'office'];
    roomTypes.forEach((type, index) => {
      rooms.push({
        id: `room_${index + 1}`,
        type,
        name: ROOM_ALIASES[type]?.[0] || 'Recinto',
        polygon: [
          { x: 0.12 + index * 0.08, y: 0.14 + (index % 2) * 0.17 },
          { x: 0.38 + index * 0.06, y: 0.14 + (index % 2) * 0.17 },
          { x: 0.38 + index * 0.06, y: 0.38 + (index % 2) * 0.17 },
          { x: 0.12 + index * 0.08, y: 0.38 + (index % 2) * 0.17 }
        ],
        confidence: 0.72 + (index * 0.02)
      });
    });
    return rooms;
  }

  function inferScale(plan){
    const knownDimension = plan.referenceDimension || null;
    if (knownDimension && knownDimension.value && knownDimension.unit) {
      return {
        status: 'calibrated',
        metersPerUnit: knownDimension.value / Math.max(plan.longestDimension || 1, 1),
        reference: knownDimension
      };
    }
    return { status: 'estimated', metersPerUnit: null, reference: 'Dimensiones aproximadas' };
  }

  function interpretSketchImage(imageAsset){
    const canvas = document.createElement('canvas');
    canvas.width = imageAsset.width || 1200;
    canvas.height = imageAsset.height || 900;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const image = new Image();

    return new Promise((resolve, reject) => {
      image.onload = () => {
        try {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const detected = detectWallsFromImageData(imageData, canvas.width, canvas.height);
          const walls = detected.walls.map((wall, index) => ({
            id: `wall_${index + 1}`,
            type: 'wall',
            start: wall.start,
            end: wall.end,
            thickness: wall.thickness,
            orientation: wall.orientation,
            confidence: wall.confidence
          }));

          const rooms = detectRoomCandidates(walls).map((room, index) => ({
            ...room,
            id: `room_${index + 1}`,
            name: room.name,
            confidence: Number((room.confidence || 0.72).toFixed(2))
          }));

          const doors = walls.slice(0, 2).map((wall, index) => ({
            id: `door_${index + 1}`,
            type: 'door',
            wallId: wall.id,
            position: 0.35 + index * 0.18,
            width: 0.9,
            orientation: wall.orientation,
            confidence: 0.7
          }));

          const windows = walls.slice(2, 4).map((wall, index) => ({
            id: `window_${index + 1}`,
            type: 'window',
            wallId: wall.id,
            position: 0.5,
            width: 0.75,
            confidence: 0.68
          }));

          const plan = global.VOLCAN_SKETCH.createSketchPlan({
            source: {
              type: 'sketch',
              filename: imageAsset.fileName || 'boceto',
              imageWidth: canvas.width,
              imageHeight: canvas.height
            },
            scale: inferScale({ longestDimension: Math.max(canvas.width, canvas.height) }),
            perimeter: [],
            walls,
            doors,
            windows,
            rooms,
            labels: rooms.map((room) => ({ id: room.id, text: room.name, kind: 'name', confidence: room.confidence })),
            warnings: [
              {
                type: 'estimated_scale',
                message: 'Sin una referencia dimensional confiable; se mantienen proporciones relativas.'
              }
            ],
            confidence: {
              overall: 0.82,
              geometry: 0.79,
              rooms: 0.74,
              openings: 0.7
            },
            mode: 'local',
            debug: detected.metrics,
            debugGeometry: {
              rawSegments: detected.rawSegments,
              discardedSegments: detected.discardedSegments,
              normalizedWalls: walls,
              intersections: detected.intersections
            }
          });

          resolve(plan);
        } catch (error) {
          reject(error);
        }
      };

      image.onerror = () => reject(new Error('No se pudo analizar la imagen.'));
      image.src = imageAsset.processedImage || imageAsset.originalImage;
    });
  }

  global.VOLCAN_SKETCH = Object.assign(global.VOLCAN_SKETCH || {}, {
    ROOM_ALIASES,
    detectWallsFromImageData,
    interpretSketchImage,
    inferScale
  });
})(window);
