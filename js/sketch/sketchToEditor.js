(function(global){
  function convertPlanToEditorObjects(plan){
    const normalized = global.VOLCAN_SKETCH.normalizePlan(plan || {});
    return {
      walls: (normalized.walls || []).map((wall, index) => ({
        id: wall.id || `editor_wall_${index + 1}`,
        start: wall.start,
        end: wall.end,
        thickness: wall.thickness,
        orientation: wall.orientation,
        wallType: wall.wallType,
        evidence: wall.evidence,
        confidence: wall.confidence
      })),
      doors: (normalized.doors || []).map((door, index) => ({
        id: door.id || `editor_door_${index + 1}`,
        wallId: door.wallId,
        position: door.position,
        width: door.width,
        swing: door.swing,
        confidence: door.confidence
      })),
      windows: (normalized.windows || []).map((windowItem, index) => ({
        id: windowItem.id || `editor_window_${index + 1}`,
        wallId: windowItem.wallId,
        position: windowItem.position,
        width: windowItem.width,
        evidence: windowItem.evidence,
        confidence: windowItem.confidence
      })),
      rooms: (normalized.rooms || []).map((room, index) => ({
        id: room.id || `editor_room_${index + 1}`,
        name: room.name,
        type: room.type,
        polygon: room.polygon,
        wallIds: room.wallIds,
        doors: room.doors,
        windows: room.windows,
        textEvidence: room.textEvidence,
        confidence: room.confidence
      }))
    };
  }

  global.VOLCAN_SKETCH = Object.assign(global.VOLCAN_SKETCH || {}, {
    convertPlanToEditorObjects
  });
})(window);
