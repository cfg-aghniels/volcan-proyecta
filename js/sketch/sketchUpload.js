(function(global){
  const PIPELINE_TIMEOUT_MS = 15000;
  const STAGES = [
    { key: 'preparing', label: 'Preparando imagen' },
    { key: 'geometry', label: 'Analizando geometría' },
    { key: 'spaces', label: 'Reconociendo espacios' },
    { key: 'openings', label: 'Detectando posibles aberturas' },
    { key: 'reconstructing', label: 'Reconstruyendo plano' }
  ];

  function withSketchTimeout(promise, label){
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`${label} tardó más de ${PIPELINE_TIMEOUT_MS} ms.`));
        }, PIPELINE_TIMEOUT_MS);
      })
    ]);
  }

  function createSketchUploadController(options){
    const fileInput = options.fileInput;
    const dialog = options.dialog;
    const processingStage = options.processingStage || document.getElementById('sketchProcessing');
    const result = options.result || document.getElementById('sketchResult');
    const preview = options.preview || document.getElementById('sketchPreviewImage');
    const previewPlan = options.previewPlan || document.getElementById('detectedPlanPreview');
    const wallCount = options.wallCount || document.getElementById('detectedWallCount');
    const confidence = options.confidence || document.getElementById('detectedConfidence');
    const statusText = options.statusText || document.getElementById('sketchStatus');
    const errorBox = options.errorBox || document.getElementById('sketchError');
    const stageList = options.stageList || document.getElementById('sketchStageList');
    const analyzeBtn = options.analyzeButton || document.getElementById('analyzeSketchBtn');
    const useBtn = options.useButton || document.getElementById('useSketchBtn');
    const methodText = options.methodText || document.getElementById('detectedMethod');
    const openingsText = options.openingsText || document.getElementById('detectedOpenings');
    const roomsText = options.roomsText || document.getElementById('detectedRooms');
    const warningsBox = options.warningsBox || document.getElementById('sketchWarnings');
    const editBtn = options.editButton || document.getElementById('editSketchInterpretationBtn');
    const correctionPanel = options.correctionPanel || document.getElementById('sketchCorrectionPanel');

    let currentFile = null;
    let currentPlan = null;

    function addLocalContract(plan){
      return {
        ...plan,
        analysisMode: 'local',
        dimensions: Array.isArray(plan.dimensions) ? plan.dimensions : [],
        furnitureEvidence: Array.isArray(plan.furnitureEvidence) ? plan.furnitureEvidence : [],
        confidence: { text: 0, ...(plan.confidence || {}) }
      };
    }

    function setStage(stageKey, stageState = 'processing'){
      const stage = STAGES.find((item) => item.key === stageKey) || { label: stageKey };
      const startedAt = performance.now();
      console.log('[Sketch] stage:set', stage.label, stageState, { ms: startedAt.toFixed(0) });
      if (statusText) statusText.textContent = stage.label;
      if (stageList) {
        const items = stageList.querySelectorAll('li');
        items.forEach((li, index) => {
          const currentStage = STAGES[index];
          const currentIndex = STAGES.findIndex((item) => item.key === stageKey);
          const isDone = index < currentIndex || (index === currentIndex && stageState === 'done');
          const isActive = index === currentIndex && stageState === 'processing';
          li.dataset.stage = currentStage?.label || li.dataset.stage;
          const marker = isDone ? (['spaces', 'openings'].includes(currentStage?.key) ? '△' : '✓') : isActive ? '●' : '○';
          li.textContent = `${marker} ${currentStage?.label || li.textContent}`;
          li.classList.toggle('active', isActive);
          li.classList.toggle('done', isDone);
        });
      }
    }

    function showError(message, technicalError){
      console.error('[Sketch] pipeline:error', technicalError || message);
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = message;
      }
      if (processingStage) processingStage.hidden = false;
      if (result) result.hidden = true;
      if (statusText) statusText.textContent = 'Error';
    }

    function hideError(){
      if (errorBox) errorBox.hidden = true;
    }

    function renderCorrectionPanel(){
      if (!correctionPanel || !currentPlan) return;
      const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
      correctionPanel.hidden = false;
      correctionPanel.innerHTML = '<strong>Correcciones de recintos</strong>';
      (currentPlan.rooms || []).forEach((room) => {
        const row = document.createElement('label');
        row.innerHTML = `<span>${escapeHtml(room.id)}</span><input value="${escapeHtml(room.name)}" data-room-name="${escapeHtml(room.id)}"><select data-room-type="${escapeHtml(room.id)}">${['unknown', 'bedroom', 'bathroom', 'kitchen', 'living', 'living_dining', 'terrace', 'hall', 'corridor', 'laundry', 'storage', 'office'].map((type) => `<option value="${type}" ${room.type === type ? 'selected' : ''}>${type}</option>`).join('')}</select><button type="button" data-remove-room="${escapeHtml(room.id)}">Eliminar</button>`;
        correctionPanel.appendChild(row);
      });
      correctionPanel.onchange = applyCorrection;
      correctionPanel.onclick = applyCorrection;
    }

    function applyCorrection(event){
      const roomId = event.target.dataset.roomName || event.target.dataset.roomType || event.target.dataset.removeRoom;
      if (!roomId) return;
      const room = (currentPlan.rooms || []).find((item) => item.id === roomId);
      if (!room) return;
      if (event.target.dataset.roomName) room.name = event.target.value;
      if (event.target.dataset.roomType) room.type = event.target.value;
      if (event.target.dataset.removeRoom) currentPlan.rooms = currentPlan.rooms.filter((item) => item.id !== roomId);
      renderCorrectionPanel();
    }

    function reset(){
      currentFile = null;
      currentPlan = null;
      hideError();
      if (result) result.hidden = true;
      if (processingStage) processingStage.hidden = false;
      if (preview && preview.src) preview.removeAttribute('src');
      if (previewPlan) previewPlan.innerHTML = '';
      if (wallCount) wallCount.textContent = '0';
      if (openingsText) openingsText.textContent = '0 / 0';
      if (roomsText) roomsText.textContent = '0';
      if (warningsBox) { warningsBox.hidden = true; warningsBox.textContent = ''; }
      if (confidence) confidence.textContent = '—';
      setStage('preparing', 'processing');
    }

    async function handleFileSelection(event){
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const startedAt = performance.now();
      console.log('[Sketch] upload:start', { fileName: file.name, size: file.size });

      const validation = global.VOLCAN_SKETCH.validateSketchFile(file);
      if (!validation.valid) {
        showError(validation.error, validation.error);
        return;
      }

      try {
        hideError();
        setStage('preparing', 'processing');
        const asset = await withSketchTimeout(global.VOLCAN_SKETCH.buildSketchAsset(file), 'preprocesamiento');
        currentFile = asset;
        if (preview) preview.src = asset.previewUrl;
        if (processingStage) processingStage.hidden = false;
        if (result) result.hidden = true;
        if (dialog) dialog.showModal();
        if (analyzeBtn) analyzeBtn.disabled = false;
        console.log('[Sketch] upload:done', { ms: (performance.now() - startedAt).toFixed(0) });
        await analyzeCurrentFile();
      } catch (error) {
        console.error('[Sketch] upload:error', error);
        showError('No pudimos completar la preparación del boceto. Intenta nuevamente o utiliza una imagen JPG/PNG con mayor contraste.', error);
      }
    }

    async function analyzeCurrentFile(){
      if (!currentFile) {
        showError('Primero debes cargar una imagen válida.', 'No hay imagen cargada');
        return;
      }

      const startedAt = performance.now();
      console.log('[Sketch] interpretation:start');

      try {
        hideError();
        setStage('geometry', 'processing');
        if (processingStage) processingStage.hidden = false;
        if (result) result.hidden = true;

        let plan;
        let analysisMode = 'local';
        const availability = global.VOLCAN_SKETCH.getAvailability ? await global.VOLCAN_SKETCH.getAvailability() : { available: false };
        if (availability.available && global.VOLCAN_SKETCH.interpretSketchWithAI) {
          try {
            plan = await global.VOLCAN_SKETCH.interpretSketchWithAI(currentFile, options.context || {});
            analysisMode = 'multimodal';
          } catch (aiError) {
            console.warn('[Sketch AI] fallback:local', aiError.message);
          }
        }
        if (!plan) {
          plan = addLocalContract(await withSketchTimeout(global.VOLCAN_SKETCH.interpretSketchImage(currentFile), 'interpretación local'));
          plan.warnings = [...(plan.warnings || []), { type: 'local_fallback', message: 'Usamos interpretación local porque el servicio de IA no estaba disponible.' }];
        }
        plan.analysisMode = analysisMode;
        console.log('[Sketch] interpretation:done', { ms: (performance.now() - startedAt).toFixed(0) });
        setStage('geometry', 'done');
        setStage('spaces', 'done');
        setStage('openings', 'done');

        const normalizationStartedAt = performance.now();
        console.log('[Sketch] normalization:start');
        const normalizedPlan = global.VOLCAN_SKETCH.normalizePlan(plan);
        console.log('[Sketch] normalization:done', { ms: (performance.now() - normalizationStartedAt).toFixed(0) });

        const topologyStartedAt = performance.now();
        console.log('[Sketch] topology:start');
        const architecturalModel = global.VOLCAN_SKETCH.buildArchitecturalModel(normalizedPlan);
        const validatedModel = global.VOLCAN_SKETCH.validateTopology(architecturalModel);
        console.log('[Sketch] topology:done', { ms: (performance.now() - topologyStartedAt).toFixed(0) });
        currentPlan = validatedModel;

        setStage('reconstructing', 'processing');
        const renderStartedAt = performance.now();
        console.log('[Sketch] render:start');
        if (previewPlan) {
          global.VOLCAN_SKETCH.renderSketchReview(currentPlan, previewPlan);
        }
        console.log('[Sketch] render:done', { ms: (performance.now() - renderStartedAt).toFixed(0) });
        setStage('reconstructing', 'done');

        if (wallCount) wallCount.textContent = `${(currentPlan.walls || []).length}`;
        if (openingsText) openingsText.textContent = `${(currentPlan.doors || []).length} / ${(currentPlan.windows || []).length}`;
        if (roomsText) roomsText.textContent = `${(currentPlan.rooms || []).length}`;
        if (warningsBox && currentPlan.warnings?.length) {
          warningsBox.hidden = false;
          warningsBox.textContent = currentPlan.warnings.map((warning) => warning.message).join(' ');
        }
        if (confidence) confidence.textContent = `${Math.round((currentPlan.confidence?.overall || 0.75) * 100)}%`;
        if (methodText) methodText.textContent = analysisMode === 'multimodal' ? 'IA multimodal' : 'Interpretación local';
        if (statusText) statusText.textContent = 'Interpretación lista';
        if (processingStage) processingStage.hidden = true;
        if (result) result.hidden = false;
        if (useBtn) useBtn.disabled = false;
        console.log('[Sketch] pipeline:complete');
      } catch (error) {
        console.error('[Sketch] interpretation:error', error);
        showError('No pudimos completar la interpretación del boceto. Intenta nuevamente o utiliza una imagen JPG/PNG con mayor contraste.', error);
      }
    }

    fileInput?.addEventListener('change', handleFileSelection);
    analyzeBtn?.addEventListener('click', analyzeCurrentFile);
    editBtn?.addEventListener('click', renderCorrectionPanel);

    return {
      reset,
      analyzeCurrentFile,
      getCurrentPlan: () => currentPlan,
      getCurrentFile: () => currentFile,
      setStage
    };
  }

  global.VOLCAN_SKETCH = Object.assign(global.VOLCAN_SKETCH || {}, {
    createSketchUploadController,
    PIPELINE_TIMEOUT_MS
  });
})(window);
