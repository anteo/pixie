  (() => {
    const MAX_W = 256, MAX_H = 192;
    const { tr, applyLocale } = window.PIXIE_I18N;
    applyLocale();
    const { download, fileStem, askName, askFileName, decodeReference, readReference, canWriteProject } =
      window.PIXIE_FILES.create(tr);
    let W = MAX_W, H = MAX_H;
    const { offset, attrIndex, emptyLayer, extraKey, layerBit, layerOpaque, layerAttr,
      writeLayerBit, writeLayerAttr, cloneLayer } = window.PIXIE_LAYER;
    let layers = [emptyLayer(tr('Layer {number}', { number: 1 }))];
    let activeLayer = 0;
    let references = [], selectedReference = -1;
    let traceSettings = { ...window.PIXIE_TRACE.defaults }, tracePreview = null, traceDrag = null;
    let projectFileName = 'screen.pixie', exportFileName = 'screen.scr', projectHandle = null;
    let savedProjectText = null;
    let projectDocumentId = 0, nextProjectDocumentId = 1;
    const screen = document.querySelector('#screen');
    let navigatorUi = null;
    const referenceLayer = document.querySelector('#reference-layer');
    const referenceFrame = document.querySelector('#reference-frame');
    const referenceList = document.querySelector('#reference-list');
    const traceButton = document.querySelector('#reference-trace');
    const traceSettingsPanel = document.querySelector('#trace-settings');
    const transparencyCanvas = document.querySelector('#transparency');
    const transparencyContext = transparencyCanvas.getContext('2d');
    const pixelGrid = document.querySelector('#pixel-grid'), cellGrid = document.querySelector('#cell-grid');
    const selectionOutline = document.querySelector('#selection-outline');
    const ctx = screen.getContext('2d');
    const textEntry = document.querySelector('#text-entry');
    const textPreview = document.querySelector('#text-preview').getContext('2d');
    const textSettingsPanel = document.querySelector('#text-settings');
    const textFont = document.querySelector('#text-font');
    const textFontList = document.querySelector('#text-font-list');
    const textLocalFonts = document.querySelector('#text-local-fonts');
    const textSize = document.querySelector('#text-size');
    const textBold = document.querySelector('#text-bold');
    const textItalic = document.querySelector('#text-italic');
    const stage = document.querySelector('#stage'), viewport = document.querySelector('#viewport'), status = document.querySelector('#status');
    const inkSwatches = document.querySelector('#ink-swatches'), paperSwatches = document.querySelector('#paper-swatches');
    const brightControl = document.querySelector('#bright'), gridControl = document.querySelector('#grid');
    const zxPreviewControl = document.querySelector('#zx-preview');
    const colors = ['Black', 'Blue', 'Red', 'Magenta', 'Green', 'Cyan', 'Yellow', 'White'].map(name => tr(name));
    const normal = ['#000000', '#0000d7', '#d70000', '#d700d7', '#00d700', '#00d7d7', '#d7d700', '#d7d7d7'];
    const bright = ['#000000', '#0000ff', '#ff0000', '#ff00ff', '#00ff00', '#00ffff', '#ffff00', '#ffffff'];
    const paletteRgb = [...normal, ...bright].map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
    const colorDistance = paletteRgb.map(a => paletteRgb.map(b =>
      (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2));
    const cursorCoords = document.querySelector('#cursor-coords');
    const cursorInfo = document.querySelector('#cursor-info');
    const cursorInk = document.querySelector('#cursor-ink'), cursorPaper = document.querySelector('#cursor-paper');
    const strokeIndicator = document.querySelector('#stroke-indicator');
    const strokeIndicatorSlot = document.querySelector('#stroke-indicator-slot');
    let cursorPoint = null, displayedScr = null, displayedCoverage = null, displayedSoloLayers = [];
    let ink = 7, paper = 0, inkTransparent = false, paperTransparent = true;
    let brightEnabled = true, gridEnabled = false, zxPreview = true, backgroundCode = 0;
    const backgroundSwatches = document.querySelector('#background-swatches');
    const { updateBackgroundSwatches, updateSwatches } = window.PIXIE_PALETTE.bind({
      backgroundSwatches, inkSwatches, paperSwatches, referenceLayer, strokeIndicator, strokeIndicatorSlot,
      normal, bright, colors, tr,
      getState: () => ({ ink, paper, inkTransparent, paperTransparent, brightEnabled, backgroundCode }),
      chooseColor: (kind, index) => chooseColor(kind, index),
      chooseBackground: index => {
        const next = index === 8 ? -1 : brightEnabled && index ? index + 8 : index;
        if (next === backgroundCode) return;
        remember(); backgroundCode = next; updateBackgroundSwatches();
        if (tracePreview) updateFloatingTrace(); else render();
      },
    });
    function chooseColor(kind, index) {
      if (kind === 'ink') { inkTransparent = index === 8; if (index < 8) ink = index; }
      else { paperTransparent = index === 8; if (index < 8) paper = index; }
      updateSwatches();
      if (selection && !tracePreview) recolorSelection(kind, index);
      previewText();
      refreshPolyline(); refreshRectangle();
    }
    let tool = 'draw', attrMode = false, zoom = 6, selection = null, drag = null, clipboard = null;
    let lineSession = null, rectangleSession = null, shapePress = null;
    let pendingMove = null;
    const attrModeButton = document.querySelector('#attr-mode');
    attrModeButton.onclick = () => {
      attrMode = !attrMode;
      attrModeButton.classList.toggle('active', attrMode);
      attrModeButton.setAttribute('aria-pressed', String(attrMode));
      refreshPolyline(); refreshRectangle();
      note(tr(attrMode ? 'Drawing 8×8 cell attributes.' : 'Drawing pixels.'));
    };
    const strokeSizes = [1, 2, 3, 4, 5, 6, 7, 8];
    const strokeSettingsPanel = document.querySelector('#stroke-settings');
    const strokePresets = document.querySelector('#stroke-presets');
    const strokeCurrent = document.querySelector('#stroke-current');
    const strokeDimensions = document.querySelector('#stroke-dimensions');
    let strokeWidth = 1;
    function setStrokeWidth(width) {
      strokeWidth = width;
      strokeDimensions.textContent = `${width}×${width} px`;
      strokeIndicator.style.setProperty('--square-size', `${width * 2 + 2}px`);
      strokeCurrent.title = tr('Brush size: {width}×{width} pixels', { width });
      for (const button of strokePresets.children) {
        const selected = Number(button.dataset.size) === width;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
      }
      refreshPolyline(); refreshRectangle();
    }
    strokeSizes.forEach((size, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'icon-button stroke-size';
      button.dataset.size = String(size);
      const unit = tr(size === 1 ? 'pixel' : 'pixels', { count: size });
      button.title = tr('Brush size {size} {unit} (Alt+Shift+{key})', { size, unit, key: index + 1 });
      button.setAttribute('aria-label', tr('Brush size: {size} {unit}', { size, unit }));
      button.style.setProperty('--square-size', `${size * 2 + 2}px`);
      button.innerHTML = '<span class="stroke-square" aria-hidden="true"></span>';
      button.onclick = () => setStrokeWidth(size);
      strokePresets.appendChild(button);
    });
    setStrokeWidth(1);
    const drawingTools = new Set(['draw', 'line', 'rect', 'fill-rect', 'ellipse', 'fill']);
    const sizedDrawingTools = new Set(['draw', 'line', 'rect', 'fill-rect', 'ellipse']);
    const undo = [], redo = [];
    const note = message => { status.textContent = message; status.title = message; };
    const inside = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
    let editingLayer = null;
    const active = () => editingLayer || layers[activeLayer];
    function bit(x, y) {
      const sx = x - active().x, sy = y - active().y;
      return layerBit(active(), sx, sy);
    }
    function setBit(x, y, on, opaque = on ? !inkTransparent : !paperTransparent) {
      const sx = x - active().x, sy = y - active().y;
      writeLayerBit(active(), sx, sy, on, opaque);
    }
    function getAttr(x, y) {
      const sx = x - active().x, sy = y - active().y;
      return layerAttr(active(), sx, sy, activeAttr());
    }
    function setAttr(x, y, value) {
      const sx = x - active().x, sy = y - active().y;
      writeLayerAttr(active(), sx, sy, value);
    }
    function drawingAttr(x, y) {
      if (!paperTransparent) return activeAttr();
      const previous = getAttr(x, y);
      const brightBit = (previous & 0x38) ? (previous & 0x40) : (brightEnabled ? 0x40 : 0);
      return (previous & 0x38) | ink | brightBit;
    }
    function paintAttrCell(x, y, updateMask = true) {
      const sx = x - active().x, sy = y - active().y;
      const x0 = sx & ~7, y0 = sy & ~7;
      writeLayerAttr(active(), sx, sy, drawingAttr(x, y));
      if (!updateMask) return;
      for (let py = y0; py < y0 + 8; py++) {
        for (let px = x0; px < x0 + 8; px++) {
          const on = layerBit(active(), px, py);
          if (on) writeLayerBit(active(), px, py, on, !inkTransparent);
          else if (!paperTransparent) writeLayerBit(active(), px, py, on, true);
        }
      }
    }
    function recolorSelection(kind, index) {
      if (pendingMove) {
        remember();
        recolorPixels(pendingMove.data, kind, index);
        if (pendingMove.scaleSource) recolorPixels(pendingMove.scaleSource, kind, index);
        render();
        note(tr('{kind} of floating selection changed.', { kind: kind.toUpperCase() }));
        return;
      }
      const x0 = Math.max(0, selection.x) - active().x;
      const y0 = Math.max(0, selection.y) - active().y;
      const x1 = Math.min(W, selection.x + selection.w) - active().x;
      const y1 = Math.min(H, selection.y + selection.h) - active().y;
      if (x0 >= x1 || y0 >= y1) return;
      remember();
      for (let cy = Math.floor(y0 / 8); cy <= Math.floor((y1 - 1) / 8); cy++) {
        for (let cx = Math.floor(x0 / 8); cx <= Math.floor((x1 - 1) / 8); cx++) {
          if (index === 8) continue;
          const x = cx * 8, y = cy * 8, before = layerAttr(active(), x, y);
          writeLayerAttr(active(), x, y, kind === 'ink' ? (before & ~7) | index
            : (before & ~0x38) | (index << 3));
        }
      }
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const isInk = layerBit(active(), x, y);
          if (isInk !== (kind === 'ink')) continue;
          writeLayerBit(active(), x, y, isInk, index !== 8);
        }
      }
      render();
      note(tr('{kind} of selection changed; each affected 8×8 cell shares its attributes across its pixels.',
        { kind: kind.toUpperCase() }));
    }
    const activeAttr = () => (ink | (paper << 3) | (brightEnabled ? 64 : 0));
    function recolorPixels(data, kind, index) {
      for (let i = 0; i < data.colors.length; i++) {
        if (index < 8) data.colors[i] = kind === 'ink'
          ? (data.colors[i] & ~7) | index : (data.colors[i] & ~0x38) | (index << 3);
        if (!!data.bits[i] === (kind === 'ink')) data.opacity[i] = index === 8 ? 0 : 1;
      }
    }
    const { copyPixels, copyMove } = window.PIXIE_SELECTION;
    function snapshot() {
      const tracing = tracePreview?.move === pendingMove;
      return { activeLayer, projectFileName, exportFileName, projectHandle, projectDocumentId,
        backgroundCode, width: W, height: H,
        references: references.map(reference => ({ ...reference })), selectedReference,
        selection: tracing ? (tracePreview.previousSelection ? { ...tracePreview.previousSelection } : null)
          : selection ? { ...selection } : null,
        pendingMove: tracing ? null : copyMove(pendingMove), layers: layers.map(cloneLayer) };
    }
    function remember(previousSelection = tracePreview ? tracePreview.previousSelection : selection) {
      const saved = snapshot();
      saved.selection = previousSelection ? { ...previousSelection } : null;
      undo.push(saved);
      if (undo.length > 50) undo.shift();
      redo.length = 0;
    }
    function restore(from, to) {
      if (!from.length) return;
      stopLineSession(); stopRectangleSession();
      to.push(snapshot());
      traceControlsUI.clearTimer();
      tracePreview = null; traceDrag = null; traceSettingsPanel.hidden = true;
      const saved = from.pop(); layers = saved.layers; activeLayer = saved.activeLayer;
      projectFileName = saved.projectFileName; exportFileName = saved.exportFileName;
      projectHandle = saved.projectHandle; projectDocumentId = saved.projectDocumentId;
      backgroundCode = saved.backgroundCode;
      references = saved.references.map(reference => ({ ...reference }));
      selectedReference = saved.selectedReference;
      setDocumentSize(saved.width, saved.height);
      selection = saved.selection ? { ...saved.selection } : null;
      pendingMove = copyMove(saved.pendingMove);
      updateBackgroundSwatches(); renderLayerList(); renderReferenceList(); renderReferences(); render(); updateCanvasCursor();
    }
    const layerForPreview = (index, previews, sourceLayers = layers) =>
      window.PIXIE_COMPOSITE.layerForPreview(index, previews, sourceLayers);
    function compositePixels(previews = pendingMove ? pendingPreviewLayers() : null,
      sourceLayers = layers, background = backgroundCode) {
      return window.PIXIE_COMPOSITE.compositePixels(previews, sourceLayers, background, W, H);
    }
    function flatten(previews = pendingMove ? pendingPreviewLayers() : null,
      sourceLayers = layers, background = backgroundCode, ignoreTransparency = false) {
      return window.PIXIE_COMPOSITE.flatten(previews, sourceLayers, background,
        ignoreTransparency, W, H, colorDistance);
    }
    function render(composite = null, outline = null, previews = null) {
      if (!previews && pendingMove) previews = pendingPreviewLayers();
      const referenceCoverage = references.some(reference => reference.visible && reference.opacity > 0)
        ? compositePixels(previews, layers, -1).coverage : null;
      const soloLayers = layers.map((layer, index) => layerForPreview(index, previews))
        .filter(layer => layer.visible && layer.solo);
      if (soloLayers.length) {
        renderSolo(soloLayers, outline, previews, referenceCoverage);
        return;
      }
      cursorInfo.title = tr('INK and PAPER after SCR encoding');
      cursorInfo.setAttribute('aria-label', tr('SCR attributes under cursor'));
      if (!composite) composite = flatten(previews);
      displayedScr = composite;
      displayedSoloLayers = [];
      const raw = !zxPreview || backgroundCode === -1 ? compositePixels(previews) : null;
      displayedCoverage = referenceCoverage || (backgroundCode === -1 ? raw.coverage : null);
      const image = window.PIXIE_DISPLAY.renderNormal(ctx, W, H, composite, raw,
        displayedCoverage, zxPreview, paletteRgb);
      ctx.putImageData(image, 0, 0); drawOverlay(outline); paintCursor();
      navigatorUi?.drawNavigator();
    }
    const topSoloPixel = window.PIXIE_DISPLAY.topSoloPixel;
    function renderSolo(soloLayers, outline, previews, referenceCoverage) {
      cursorInfo.title = tr(zxPreview
        ? 'Solo layers use their own attributes; dimmed pixels show ZX rendering'
        : 'Solo layers use their own attributes; dimmed pixels show raw compositing');
      cursorInfo.setAttribute('aria-label', tr('Attributes under cursor in solo preview'));
      const scr = flatten(previews);
      const raw = !zxPreview || backgroundCode === -1 ? compositePixels(previews) : null;
      const coverage = referenceCoverage || (backgroundCode === -1 ? raw.coverage : null);
      displayedScr = scr;
      displayedCoverage = coverage;
      displayedSoloLayers = soloLayers;
      const image = window.PIXIE_DISPLAY.renderSolo(ctx, W, H, scr, raw, coverage,
        soloLayers, zxPreview, paletteRgb);
      ctx.putImageData(image, 0, 0); drawOverlay(outline); paintCursor();
      navigatorUi?.drawNavigator();
    }
    function setZxPreview(enabled) {
      zxPreview = enabled;
      zxPreviewControl.classList.toggle('active', enabled);
      zxPreviewControl.setAttribute('aria-pressed', String(enabled));
      if (lineSession) refreshPolyline();
      else if (rectangleSession) refreshRectangle();
      else render();
    }
    function paintCursor() {
      if (!cursorPoint || !displayedScr) {
        cursorCoords.textContent = 'x: — · y: —';
        cursorInk.classList.remove('transparent'); cursorPaper.classList.remove('transparent');
        cursorInk.style.backgroundColor = 'transparent';
        cursorPaper.style.backgroundColor = 'transparent';
        cursorInk.title = cursorPaper.title = '';
        return;
      }
      const { x, y } = cursorPoint;
      cursorCoords.textContent = `x: ${x} · y: ${y}`;
      if (displayedCoverage && !displayedCoverage[y * W + x]) {
        cursorInk.style.backgroundColor = cursorPaper.style.backgroundColor = '';
        cursorInk.classList.add('transparent'); cursorPaper.classList.add('transparent');
        cursorInk.title = cursorPaper.title = tr('Transparent');
        return;
      }
      cursorInk.classList.remove('transparent'); cursorPaper.classList.remove('transparent');
      let attr = displayedScr[6144 + attrIndex(x, y)];
      const soloPixel = topSoloPixel(displayedSoloLayers, x, y);
      if (soloPixel) attr = soloPixel.attr;
      const palette = attr & 64 ? bright : normal;
      const inkIndex = attr & 7, paperIndex = (attr >> 3) & 7;
      cursorInk.style.backgroundColor = palette[inkIndex];
      cursorPaper.style.backgroundColor = palette[paperIndex];
      cursorInk.title = `INK: ${colors[inkIndex]}`;
      cursorPaper.title = `PAPER: ${colors[paperIndex]}`;
    }
    function canMergeDown() {
      return activeLayer > 0 && active().visible && layers[activeLayer - 1].visible;
    }
    const layerList = document.querySelector('#layer-list');
    function reorderLayer(sourceLayer, targetLayer, before) {
      const source = layers.indexOf(sourceLayer), target = layers.indexOf(targetLayer);
      if (source < 0 || target < 0) return;
      let insertion = before ? target + 1 : target;
      if (source < insertion) insertion--;
      if (insertion === source) return;
      const selectedLayer = active();
      const moveSource = pendingMove?.sourceLayer != null ? layers[pendingMove.sourceLayer] : null;
      const moveTarget = pendingMove ? layers[pendingMove.targetLayer] : null;
      remember();
      const [moved] = layers.splice(source, 1);
      layers.splice(insertion, 0, moved);
      activeLayer = layers.indexOf(selectedLayer);
      if (pendingMove) {
        pendingMove.sourceLayer = moveSource ? layers.indexOf(moveSource) : null;
        pendingMove.targetLayer = layers.indexOf(moveTarget);
      }
      renderLayerList(); render(); note(tr('Layer order changed.'));
    }
    const layerSort = window.PIXIE_SORTABLE.bind(layerList, {
      rowSelector: '.layer-row', blockedSelector: 'button',
      itemAt: index => layers[index], reorder: reorderLayer,
    });
    function cycleLayerVisibility(layer) {
      remember();
      if (layer.solo) layer.solo = false;
      else if (layer.visible) layer.visible = false;
      else {
        layer.visible = true; layer.solo = true;
      }
      renderLayerList(); render();
    }
    function renderLayerList() {
      const list = layerList;
      const hasSolo = layers.some(layer => layer.visible && layer.solo);
      list.replaceChildren();
      for (let index = layers.length - 1; index >= 0; index--) {
        const layer = layers[index];
        const row = window.PIXIE_PANEL_ROWS.layer({
          layer, index, active: index === activeLayer, muted: hasSolo && !layer.solo,
          canDelete: layers.length > 1, tr,
          select: () => {
            if (layerSort.suppressClick || activeLayer === index) return;
            stopLineSession(); stopRectangleSession();
            if (selection || pendingMove) remember();
            if (pendingMove && !tracePreview) finishPendingMove();
            activeLayer = index;
            if (tracePreview && pendingMove) pendingMove.targetLayer = index;
            for (const item of list.children) item.classList.toggle('active', Number(item.dataset.index) === index);
            document.querySelector('#layer-up').disabled = activeLayer === layers.length - 1;
            document.querySelector('#layer-down').disabled = activeLayer === 0;
            document.querySelector('#layer-merge').disabled = !canMergeDown();
            if (tracePreview) updateFloatingTrace(); else render();
          },
          toggle: () => cycleLayerVisibility(layer),
          rename: async () => {
            const next = await askName(tr('Layer name'), layer.name, tr('Rename'));
            if (next !== null && next !== layer.name) {
              remember(); layer.name = next; renderLayerList();
            }
          },
          remove: () => deleteLayer(index),
        });
        list.appendChild(row);
      }
      document.querySelector('#layer-up').disabled = activeLayer === layers.length - 1;
      document.querySelector('#layer-down').disabled = activeLayer === 0;
      document.querySelector('#layer-merge').disabled = !canMergeDown();
    }
    function updateActiveLayerCoords() {
      const coords = document.querySelector('#layer-list .layer-row.active .layer-coords');
      if (!coords) return;
      coords.textContent = `${active().x}:${active().y}`;
      coords.title = tr('Layer offset: x {x}, y {y}', { x: active().x, y: active().y });
    }
    const updateReferenceFrame = () => window.PIXIE_REFERENCES.updateFrame(
      referenceFrame, references, selectedReference, tracePreview, pendingMove, zoom);
    const renderReferences = () => {
      window.PIXIE_REFERENCES.render(referenceLayer, referenceFrame, references,
        selectedReference, tracePreview, pendingMove, zoom);
      navigatorUi?.drawNavigator();
    };
    function reorderReference(sourceReference, targetReference, before) {
      const source = references.indexOf(sourceReference), target = references.indexOf(targetReference);
      if (source < 0 || target < 0) return;
      let insertion = before ? target + 1 : target;
      if (source < insertion) insertion--;
      if (insertion === source) return;
      const selected = references[selectedReference];
      remember();
      const [moved] = references.splice(source, 1);
      references.splice(insertion, 0, moved);
      selectedReference = selected ? references.indexOf(selected) : -1;
      renderReferences(); renderReferenceList();
      note(tr('Reference order changed.'));
    }
    function renderReferenceList() {
      referenceList.replaceChildren();
      for (let index = references.length - 1; index >= 0; index--) {
        const reference = references[index];
        if (tracePreview && reference !== tracePreview.reference) continue;
        const row = window.PIXIE_PANEL_ROWS.reference({
          reference, index, active: index === selectedReference, tr,
          select: () => {
            if (referenceSort.suppressClick) return;
            if (tracePreview) {
              if (tracePreview.reference === reference) return;
              cancelTrace(false);
            }
            selectedReference = index === selectedReference ? -1 : index;
            renderReferenceList(); updateReferenceFrame();
          },
          toggle: () => {
            remember(); reference.visible = !reference.visible;
            renderReferences(); renderReferenceList(); render();
          },
          remove: () => {
            remember(); references.splice(index, 1);
            if (tracePreview?.reference === reference) cancelTrace(false);
            if (selectedReference === index) selectedReference = -1;
            else if (selectedReference > index) selectedReference--;
            renderReferences(); renderReferenceList(); render();
          },
          opacityChange: (value, firstChange) => {
            if (firstChange) remember();
            reference.opacity = value;
            renderReferences(); render();
          },
        });
        referenceList.appendChild(row);
      }
      traceButton.disabled = !tracePreview && !references[selectedReference];
      traceButton.classList.toggle('active', !!tracePreview);
      traceButton.setAttribute('aria-pressed', String(!!tracePreview));
      updateReferenceFrame();
    }
    const referenceSort = window.PIXIE_SORTABLE.bind(referenceList, {
      rowSelector: '.reference-row', blockedSelector: 'button, .reference-opacity',
      itemAt: index => references[index], reorder: reorderReference,
    });
    document.querySelector('#reference-add').onclick = () => document.querySelector('#reference-file').click();
    document.querySelector('#reference-file').onchange = async event => {
      let added = false;
      for (const file of event.target.files) {
        try {
          const dataUrl = await readReference(file);
          const image = await decodeReference(dataUrl);
          if (!image.naturalWidth || !image.naturalHeight) throw new Error(tr('Could not load reference image.'));
          if (!added) { remember(); added = true; }
          const scale = Math.min(1, W / image.naturalWidth, H / image.naturalHeight);
          const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
          references.push({ name: file.name, visible: true, opacity: 0.5,
            x: (W - width) / 2, y: (H - height) / 2, width, height, dataUrl, image });
          selectedReference = references.length - 1;
        } catch (error) { note(error.message); }
      }
      event.target.value = '';
      if (added) { renderReferences(); renderReferenceList(); render(); }
    };
    const traceHistory = window.PIXIE_TRACE_HISTORY.bind({
      getPreview: () => tracePreview, getDrag: () => traceDrag, setDrag: value => { traceDrag = value; },
      getMove: () => pendingMove, getSettings: () => traceSettings,
      setSettings: value => { traceSettings = value; }, getControls: () => traceControlsUI,
      changeArea: changeTraceArea, updateCursor: updateCanvasCursor,
      sameSelection: window.PIXIE_GEOMETRY.sameSelection, note, tr,
    });
    const traceState = traceHistory.state;
    const recordTraceChange = traceHistory.record;
    const undoTrace = traceHistory.undo;
    const redoTrace = traceHistory.redo;
    const traceControlsUI = window.PIXIE_TRACE_CONTROLS.bind({
      getSettings: () => traceSettings, setSettings: value => { traceSettings = value; },
      getPreview: () => tracePreview, traceState, recordTraceChange, updateFloatingTrace,
    });
    const syncTraceControls = traceControlsUI.sync;
    function traceReference() {
      return references[selectedReference] || null;
    }
    const sampleReference = reference => window.PIXIE_REFERENCES.sample(reference, W, H);
    const referenceArea = reference => window.PIXIE_REFERENCES.area(reference, W, H);
    function changeTraceArea(area, target = area) {
      if (!tracePreview || !area || area.w < 1 || area.h < 1) return;
      const color = paletteRgb[backgroundCode < 0 ? 0 : backgroundCode];
      const data = window.PIXIE_TRACE.convert(tracePreview.source, area,
        layers[activeLayer], traceSettings, paletteRgb, color);
      pendingMove = { source: null, data, target: { ...target }, sourceLayer: null, targetLayer: activeLayer };
      tracePreview.area = { ...area };
      tracePreview.move = pendingMove;
      selection = { ...target };
      render();
    }
    function cancelTrace(announce = true) {
      if (!tracePreview) return;
      traceControlsUI.clearTimer();
      const previousSelection = tracePreview.previousSelection;
      tracePreview = null; traceDrag = null;
      traceControlsUI.clearHistory();
      pendingMove = null; selection = previousSelection ? { ...previousSelection } : null;
      traceSettingsPanel.hidden = true;
      renderReferences(); renderReferenceList(); render();
      if (announce) note(tr('Tracing cancelled.'));
    }
    function applyTrace() {
      if (!tracePreview) return;
      traceControlsUI.clearTimer();
      if (traceDrag?.nextArea) changeTraceArea(traceDrag.nextArea, traceDrag.nextTarget);
      else updateFloatingTrace();
      remember();
      tracePreview = null; traceDrag = null;
      traceControlsUI.clearHistory();
      finishPendingMove(); selection = null;
      traceSettingsPanel.hidden = true;
      renderReferences(); renderReferenceList(); render();
      note(tr('Tracing applied.'));
    }
    function activateTrace() {
      if (tracePreview) { cancelTrace(); return; }
      const reference = traceReference();
      if (!reference) { note(tr('Select a reference to trace.')); return; }
      commitText();
      let previousSelection = selection ? { ...selection } : null;
      if (pendingMove) {
        remember(); finishPendingMove(); selection = null; previousSelection = null;
      }
      const area = previousSelection || referenceArea(reference);
      if (!area) { note(tr('No reference pixels in the selected area.')); return; }
      setTool('select');
      tracePreview = { reference, source: sampleReference(reference), area: null,
        previousSelection, move: null, history: [], future: [] };
      traceControlsUI.clearHistory();
      traceSettingsPanel.hidden = false;
      changeTraceArea(area);
      renderReferences(); renderReferenceList();
      traceSettingsPanel.scrollIntoView({ block: 'start', behavior: 'smooth' });
      note(tr('Trace ready. Enter applies; Escape cancels.'));
    }
    traceButton.onclick = activateTrace;
    document.querySelector('#trace-apply').onclick = applyTrace;
    document.querySelector('#trace-cancel').onclick = () => cancelTrace();
    function updateFloatingTrace() {
      if (tracePreview?.move !== pendingMove) return;
      changeTraceArea(tracePreview.area, pendingMove.target);
    }
    window.PIXIE_REFERENCE_FRAME.bind(referenceFrame, {
      selected: () => selectedReference, getReferences: () => references, getZoom: () => zoom,
      remember, render: renderReferences,
    });
    function addLayer() {
      stopLineSession(); stopRectangleSession();
      remember();
      if (pendingMove && !tracePreview) finishPendingMove();
      const number = layers.length + 1;
      layers.push(emptyLayer(tr('Layer {number}', { number })));
      activeLayer = layers.length - 1;
      if (tracePreview && pendingMove) pendingMove.targetLayer = activeLayer;
      renderLayerList(); if (tracePreview) updateFloatingTrace(); else render();
    }
    function moveLayerStack(step) {
      const next = activeLayer + step;
      if (next < 0 || next >= layers.length) return;
      const moveSource = pendingMove?.sourceLayer != null ? layers[pendingMove.sourceLayer] : null;
      const moveTarget = pendingMove ? layers[pendingMove.targetLayer] : null;
      remember();
      [layers[activeLayer], layers[next]] = [layers[next], layers[activeLayer]];
      activeLayer = next;
      if (pendingMove) {
        pendingMove.sourceLayer = moveSource ? layers.indexOf(moveSource) : null;
        pendingMove.targetLayer = layers.indexOf(moveTarget);
      }
      renderLayerList(); render();
    }
    function deleteLayer(index = activeLayer) {
      if (layers.length === 1) return;
      stopLineSession(); stopRectangleSession();
      const removed = layers[index];
      if (!removed) return;
      const selected = active();
      const moveSource = pendingMove?.sourceLayer != null ? layers[pendingMove.sourceLayer] : null;
      const moveTarget = pendingMove ? layers[pendingMove.targetLayer] : null;
      remember();
      if (removed === selected && pendingMove && !tracePreview) finishPendingMove();
      layers.splice(index, 1);
      activeLayer = removed === selected ? Math.min(index, layers.length - 1) : layers.indexOf(selected);
      if (pendingMove) {
        const sourceIndex = moveSource && moveSource !== removed ? layers.indexOf(moveSource) : -1;
        pendingMove.sourceLayer = sourceIndex >= 0 ? sourceIndex : null;
        if (pendingMove.sourceLayer == null) pendingMove.source = null;
        pendingMove.targetLayer = moveTarget && moveTarget !== removed ? layers.indexOf(moveTarget) : activeLayer;
      }
      renderLayerList(); if (tracePreview) updateFloatingTrace(); else render();
    }
    const mergeOffscreenPixels = (merged, pair) =>
      window.PIXIE_COMPOSITE.mergeOffscreenPixels(merged, pair, W, H, colorDistance);
    function mergeDown() {
      if (!canMergeDown()) return;
      stopLineSession(); stopRectangleSession(); commitText();
      remember(); finishPendingMove(); selection = null;
      const lowerIndex = activeLayer - 1;
      const pair = [layers[lowerIndex], layers[activeLayer]];
      const coverage = compositePixels(null, pair, -1).coverage;
      const encoded = flatten(null, pair, -1, true);
      const mergedMask = new Uint8Array(6144);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (coverage[y * W + x]) mergedMask[offset(x, y)] |= 128 >> (x & 7);
      }
      const merged = { name: pair[0].name, visible: true, solo: pair.some(layer => layer.solo), x: 0, y: 0,
        bitmap: encoded.slice(0, 6144), attrs: encoded.slice(6144), mask: mergedMask, extra: new Map() };
      mergeOffscreenPixels(merged, pair);
      layers[lowerIndex] = merged;
      layers.splice(activeLayer, 1);
      activeLayer = lowerIndex;
      renderLayerList(); render(); note(tr('Merged with layer below.'));
    }
    function setDocumentSize(width, height, resetScroll = false) {
      W = width; H = height;
      screen.width = width; screen.height = height;
      renderReferences();
      transparencyCanvas.width = width * 2; transparencyCanvas.height = height * 2;
      drawTransparency();
      const preview = document.querySelector('#text-preview');
      preview.width = width; preview.height = height;
      previewText();
      document.querySelector('#pixel-overlay').setAttribute('viewBox', `0 0 ${width} ${height}`);
      document.querySelector('#overlay').setAttribute('viewBox', `0 0 ${width} ${height}`);
      document.querySelector('#document-size').textContent = `${width}×${height}`;
      const fullScreen = width === MAX_W && height === MAX_H;
      const scrExport = document.querySelector('#save');
      scrExport.disabled = !fullScreen;
      scrExport.title = tr(fullScreen ? 'Export SCR (⌘⇧S)' : 'SCR export requires a full 256×192 screen');
      stage.style.width = width * zoom + 'px';
      stage.style.height = height * zoom + 'px';
      if (resetScroll) { viewport.scrollLeft = 0; viewport.scrollTop = 0; }
      updateGrid();
    }
    function resetDocument(width = MAX_W, height = MAX_H) {
      stopLineSession(); stopRectangleSession(); cancelText(); remember();
      traceControlsUI.clearTimer();
      pendingMove = null; tracePreview = null; traceDrag = null;
      traceSettingsPanel.hidden = true;
      layers = [emptyLayer(tr('Layer {number}', { number: 1 }))]; activeLayer = 0; backgroundCode = 0;
      references = []; selectedReference = -1;
      traceSettings = { ...window.PIXIE_TRACE.defaults }; syncTraceControls();
      zxPreview = true; zxPreviewControl.classList.add('active'); zxPreviewControl.setAttribute('aria-pressed', 'true');
      attrMode = false; attrModeButton.classList.remove('active'); attrModeButton.setAttribute('aria-pressed', 'false');
      paperTransparent = true; updateSwatches();
      projectFileName = 'screen.pixie'; exportFileName = 'screen.scr'; projectHandle = null;
      projectDocumentId = nextProjectDocumentId++;
      setDocumentSize(width, height, true);
      selection = null; setTool('draw');
      updateBackgroundSwatches(); renderLayerList(); renderReferenceList(); render(); fitZoom();
      savedProjectText = projectText();
      note(tr('New blank document.'));
    }
    function newDocument() {
      const dialog = document.querySelector('#new-dialog');
      if (dialog.open) return;
      const dirty = hasUnsavedChanges();
      document.querySelector('#new-dialog > p').hidden = !dirty;
      document.querySelector('#new-save').hidden = !dirty;
      document.querySelector('#new-discard').textContent = tr(dirty ? "Don't save" : 'Create');
      document.querySelector('input[name="new-size"][value="screen"]').checked = true;
      document.querySelector('#new-size-error').textContent = '';
      dialog.showModal();
    }
    function mark(name, coordinates, color) {
      const ns = 'http://www.w3.org/2000/svg';
      const element = document.createElementNS(ns, name);
      for (const [key, value] of Object.entries(coordinates)) element.setAttribute(key, value);
      element.setAttribute('fill', 'none');
      element.setAttribute('stroke', color);
      element.setAttribute('stroke-width', '1');
      element.setAttribute('vector-effect', 'non-scaling-stroke');
      element.setAttribute('shape-rendering', 'crispEdges');
      return element;
    }
    function drawTransparency() {
      const unit = zoom >= 8 ? 1 : 8;
      const image = transparencyContext.createImageData(W * 2, H * 2);
      const pixels = image.data;
      const shades = [[80, 84, 91], [48, 52, 60]];
      for (let y = 0; y < H * 2; y++) {
        for (let x = 0; x < W * 2; x++) {
          const shade = shades[((x / unit | 0) + (y / unit | 0)) & 1];
          const i = (y * W * 2 + x) * 4;
          pixels[i] = shade[0]; pixels[i + 1] = shade[1]; pixels[i + 2] = shade[2]; pixels[i + 3] = 255;
        }
      }
      transparencyContext.putImageData(image, 0, 0);
    }
    function updateGrid() {
      const pixels = document.createDocumentFragment(), cells = document.createDocumentFragment();
      if (gridEnabled) {
        if (zoom >= 8) {
          for (let x = 1; x < W; x++) if (x % 8) pixels.appendChild(mark('line', { x1: x, y1: 0, x2: x, y2: H }, '#222222'));
          for (let y = 1; y < H; y++) if (y % 8) pixels.appendChild(mark('line', { x1: 0, y1: y, x2: W, y2: y }, '#222222'));
        }
        for (let x = 8; x < W; x += 8) cells.appendChild(mark('line', { x1: x, y1: 0, x2: x, y2: H }, '#888888'));
        for (let y = 8; y < H; y += 8) cells.appendChild(mark('line', { x1: 0, y1: y, x2: W, y2: y }, '#888888'));
      }
      pixelGrid.replaceChildren(pixels);
      cellGrid.replaceChildren(cells);
    }
    function drawOverlay(preview = null) {
      const s = preview || selection;
      if (!s) { selectionOutline.replaceChildren(); return; }
      const outline = mark('rect', { x: s.x, y: s.y, width: s.w, height: s.h }, '#ff40ff');
      outline.setAttribute('stroke-dasharray', '4 3');
      if (!tracePreview && (tool !== 'select' || drag?.action === 'select')) {
        selectionOutline.replaceChildren(outline); return;
      }
      const size = 7 / zoom;
      const handles = [[s.x, s.y], [s.x + s.w / 2, s.y], [s.x + s.w, s.y],
        [s.x, s.y + s.h / 2], [s.x + s.w, s.y + s.h / 2],
        [s.x, s.y + s.h], [s.x + s.w / 2, s.y + s.h], [s.x + s.w, s.y + s.h]];
      selectionOutline.replaceChildren(outline, ...handles.map(([x, y]) => {
        const handle = mark('rect', { x: x - size / 2, y: y - size / 2, width: size, height: size }, '#ffffff');
        handle.setAttribute('fill', '#ff40ff');
        return handle;
      }));
    }
    function traceHit(clientX, clientY) {
      if (!selection || !tracePreview) return 'new';
      const rect = screen.getBoundingClientRect();
      const scaleX = rect.width / W, scaleY = rect.height / H;
      const left = rect.left + selection.x * scaleX, right = left + selection.w * scaleX;
      const top = rect.top + selection.y * scaleY, bottom = top + selection.h * scaleY;
      const handles = [['nw', left, top], ['n', (left + right) / 2, top], ['ne', right, top],
        ['w', left, (top + bottom) / 2], ['e', right, (top + bottom) / 2],
        ['sw', left, bottom], ['s', (left + right) / 2, bottom], ['se', right, bottom]];
      const hit = handles.find(([, x, y]) => Math.abs(clientX - x) <= 7 && Math.abs(clientY - y) <= 7);
      if (hit) return hit[0];
      const nearHorizontalEdge = clientX >= left && clientX <= right &&
        (Math.abs(clientY - top) <= 6 || Math.abs(clientY - bottom) <= 6);
      const nearVerticalEdge = clientY >= top && clientY <= bottom &&
        (Math.abs(clientX - left) <= 6 || Math.abs(clientX - right) <= 6);
      return nearHorizontalEdge || nearVerticalEdge ? 'move' : 'new';
    }
    function selectionResizeHit(clientX, clientY) {
      if (!selection || tool !== 'select' || tracePreview) return null;
      const rect = screen.getBoundingClientRect();
      const left = rect.left + selection.x * rect.width / W;
      const right = rect.left + (selection.x + selection.w) * rect.width / W;
      const top = rect.top + selection.y * rect.height / H;
      const bottom = rect.top + (selection.y + selection.h) * rect.height / H;
      if (clientX < left - 7 || clientX > right + 7 || clientY < top - 7 || clientY > bottom + 7) return null;
      const west = Math.abs(clientX - left), east = Math.abs(clientX - right);
      const north = Math.abs(clientY - top), south = Math.abs(clientY - bottom);
      const horizontal = Math.min(west, east) <= 7 ? (west <= east ? 'w' : 'e') : '';
      const vertical = Math.min(north, south) <= 7 ? (north <= south ? 'n' : 's') : '';
      return vertical + horizontal || null;
    }
    function resizeTraceArea(area, handle, dx, dy, snap) {
      let left = area.x, top = area.y, right = area.x + area.w - 1, bottom = area.y + area.h - 1;
      if (handle.includes('w')) left = Math.max(0, Math.min(right, left + dx));
      if (handle.includes('e')) right = Math.min(W - 1, Math.max(left, right + dx));
      if (handle.includes('n')) top = Math.max(0, Math.min(bottom, top + dy));
      if (handle.includes('s')) bottom = Math.min(H - 1, Math.max(top, bottom + dy));
      const result = { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
      return snap ? selectionRectangle({ x: left, y: top }, { x: right, y: bottom }, true) : result;
    }
    function queueTraceArea(area, target, immediate = false) {
      traceControlsUI.clearTimer();
      if (immediate) { changeTraceArea(area, target); return; }
      drawOverlay(target);
      traceControlsUI.schedule(() => changeTraceArea(area, target), 50);
    }
    function updateCanvasCursor(p = cursorPoint, clientX = null, clientY = null) {
      if (tracePreview) {
        const rect = screen.getBoundingClientRect();
        const hit = traceDrag?.kind || (p && traceHit(rect.left + (p.x + 0.5) * rect.width / W,
          rect.top + (p.y + 0.5) * rect.height / H));
        const resize = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
          nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize' };
        screen.style.cursor = hit === 'move' ? (traceDrag ? 'grabbing' : 'grab') : resize[hit] || 'crosshair';
        return;
      }
      const resize = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
        nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize' };
      const handle = drag?.action === 'resize' ? drag.handle
        : clientX != null && clientY != null ? selectionResizeHit(clientX, clientY) : null;
      screen.style.cursor = resize[handle] || (drag?.action === 'move' || drag?.action === 'move-layer' ? 'grabbing'
        : tool === 'move-layer' || (tool === 'select' && contains(selection, p)) ? 'grab'
        : tool === 'text' ? 'text' : 'crosshair');
    }
    function setTool(name) {
      if (tool === 'line' && name !== 'line') stopLineSession();
      if (rectangleSession && name !== rectangleSession.action) stopRectangleSession();
      if (name !== 'select' && tracePreview) cancelTrace(false);
      tool = name;
      textSettingsPanel.hidden = name !== 'text';
      strokeSettingsPanel.hidden = !sizedDrawingTools.has(name);
      document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === name));
      updateCanvasCursor();
      const tips = {
        draw: 'Click to draw or erase; drag to continue.',
        line: 'Click for segments, drag one; Shift locks direction.',
        rect: 'Outline rectangle: click twice or drag.',
        'fill-rect': 'Filled rectangle: click twice or drag.',
        ellipse: 'Ellipse: click twice or drag; Shift makes a circle.',
        fill: 'Fill a connected area.',
        select: 'Select, move, or resize; Shift snaps to 8×8 cells.',
        'move-layer': 'Drag to move; Shift+arrows snap to cells.',
        text: 'Click to type; Shift snaps, Enter floats text.',
      };
      note(tr(tips[name]));
    }
    const point = event => {
      const r = screen.getBoundingClientRect();
      return { x: Math.floor((event.clientX - r.left) * W / r.width), y: Math.floor((event.clientY - r.top) * H / r.height) };
    };
    const clamp = (value, max) => Math.max(0, Math.min(max, value));
    const { rectangle, cellPoint, connectedArea, walkLine, ellipseOutline, contains, sameSelection,
      scaleSelection, nudgeCoordinate } = window.PIXIE_GEOMETRY;
    function selectionRectangle(a, b, snap) {
      return window.PIXIE_GEOMETRY.selectionRectangle(a, b, snap, W, H);
    }
    function resizedSelection(bounds, handle, dx, dy, snap) {
      return window.PIXIE_GEOMETRY.resizedSelection(bounds, handle, dx, dy, snap, W, H);
    }
    const capture = selection => window.PIXIE_SELECTION.capture(selection, active(), activeAttr());
    const clear = selection => window.PIXIE_SELECTION.clear(selection, active());
    const stamp = (data, x, y) => window.PIXIE_SELECTION.stamp(data, x, y, active());
    function withLayer(index, layer, action) {
      const originalIndex = activeLayer, originalLayer = editingLayer;
      activeLayer = index; editingLayer = layer;
      try { action(); }
      finally { activeLayer = originalIndex; editingLayer = originalLayer; }
    }
    function movePreviewLayers(source, data, target, sourceLayer, targetLayer) {
      const previews = new Map();
      const edit = (index, action) => {
        if (index == null || index < 0) return;
        let layer = previews.get(index);
        if (!layer) {
          const original = layers[index];
          layer = cloneLayer(original);
          previews.set(index, layer);
        }
        withLayer(index, layer, action);
      };
      if (source) edit(sourceLayer, () => clear(source));
      edit(targetLayer, () => stamp(data, target.x, target.y));
      return previews;
    }
    function pendingPreviewLayers() {
      return movePreviewLayers(pendingMove.source, pendingMove.data, pendingMove.target,
        pendingMove.sourceLayer, pendingMove.targetLayer);
    }
    function finishPendingMove() {
      if (!pendingMove) return;
      if (tracePreview?.move === pendingMove) { cancelTrace(false); return; }
      if (pendingMove.source) withLayer(pendingMove.sourceLayer, layers[pendingMove.sourceLayer],
        () => clear(pendingMove.source));
      withLayer(pendingMove.targetLayer, layers[pendingMove.targetLayer],
        () => stamp(pendingMove.data, pendingMove.target.x, pendingMove.target.y));
      pendingMove = null;
      tracePreview = null;
      updateReferenceFrame();
    }
    function removeSelectionPixels() {
      if (tracePreview?.move === pendingMove) { cancelTrace(false); return; }
      if (!pendingMove) { clear(selection); return; }
      if (pendingMove.source) withLayer(pendingMove.sourceLayer, layers[pendingMove.sourceLayer],
        () => clear(pendingMove.source));
      pendingMove = null;
      tracePreview = null;
      updateReferenceFrame();
    }
    function moveTarget(p) {
      return { x: clamp(drag.source.x + p.x - drag.start.x, W - 1),
        y: clamp(drag.source.y + p.y - drag.start.y, H - 1),
        w: drag.source.w, h: drag.source.h };
    }
    function nudgeSelection(dx, dy) {
      if (!selection) return;
      const target = { ...selection,
        x: clamp(selection.x + dx, W - 1), y: clamp(selection.y + dy, H - 1) };
      if (sameSelection(selection, target)) return;
      if (tracePreview) {
        if (traceDrag) return;
        const before = traceState();
        pendingMove.target = target;
        selection = target;
        recordTraceChange(before);
      } else {
        const source = pendingMove ? null : { ...selection };
        const data = pendingMove ? null : capture(selection);
        remember();
        if (pendingMove) pendingMove.target = target;
        else pendingMove = { source, data, target, sourceLayer: activeLayer, targetLayer: activeLayer };
        selection = target;
      }
      render(); updateCanvasCursor();
    }
    function previewMove(target) {
      const move = pendingMove || { source: drag.source, data: drag.data,
        sourceLayer: activeLayer, targetLayer: activeLayer };
      const previews = movePreviewLayers(move.source, move.data, target, move.sourceLayer, move.targetLayer);
      render(flatten(previews), target, previews);
    }
    function previewSelectionResize(p, snap, clientX, clientY) {
      const target = resizedSelection(drag.source, drag.handle, p.x - drag.start.x, p.y - drag.start.y, snap);
      drag.raw = p;
      drag.pointer = { x: clientX, y: clientY };
      drag.target = target;
      drag.data = scaleSelection(drag.originalData, target.w, target.h);
      const previews = movePreviewLayers(drag.sourceToClear, drag.data, target,
        drag.sourceLayer, drag.targetLayer);
      render(flatten(previews), target, previews);
      showShapeMeasure(`${target.w}×${target.h} px`, clientX, clientY);
    }
    function refreshSelectionResize() {
      if (drag?.action === 'resize' && drag.raw && drag.pointer)
        previewSelectionResize(drag.raw, shiftHeld, drag.pointer.x, drag.pointer.y);
    }
    const { paintBrush, line, cellLine, paintShape, paintAttributeShape, fillArea } = window.PIXIE_DRAW.create({
      getState: () => ({ layer: active(), width: W, height: H, attrMode,
        strokeWidth, inkTransparent, paperTransparent }),
      setBit, setAttr, paintAttrCell, drawingAttr, remember,
    });
    const shapeMeasure = document.querySelector('#shape-measure');
    function lineEnd(start, end, shifted, maxX = W - 1, maxY = H - 1) {
      return window.PIXIE_GEOMETRY.lineEnd(start, end, shifted, maxX, maxY);
    }
    function hideShapeMeasure() { shapeMeasure.style.display = 'none'; }
    function showShapeMeasure(value, clientX, clientY) {
      shapeMeasure.textContent = value;
      shapeMeasure.style.display = 'block';
      shapeMeasure.style.left = `${Math.max(8, Math.min(clientX + 14, window.innerWidth - shapeMeasure.offsetWidth - 8))}px`;
      shapeMeasure.style.top = `${Math.max(8, Math.min(clientY + 14, window.innerHeight - shapeMeasure.offsetHeight - 8))}px`;
    }
    function lineEndpoint(start, raw, shifted) {
      if (attrMode) {
        const first = cellPoint(start);
        const last = lineEnd(first, cellPoint(raw), shifted, Math.ceil(W / 8) - 1, Math.ceil(H / 8) - 1);
        return { end: { x: last.x * 8, y: last.y * 8 },
          length: Math.max(Math.abs(last.x - first.x), Math.abs(last.y - first.y)) + 1,
          unit: tr('cells') };
      }
      const end = lineEnd(start, raw, shifted);
      return { end, length: Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) + 1,
        unit: 'px' };
    }
    function ellipseEndpoint(start, raw, shifted, cellMode) {
      return window.PIXIE_GEOMETRY.ellipseEndpoint(start, raw, shifted, cellMode, W, H);
    }
    function previewPolyline(raw, shifted, clientX, clientY) {
      if (!lineSession) return;
      const index = layers.indexOf(lineSession.layer);
      if (index < 0) { stopLineSession(); return; }
      lineSession.raw = raw;
      lineSession.pointer = { x: clientX, y: clientY };
      const { end, length, unit } = lineEndpoint(lineSession.start, raw, shifted);
      const layer = layers[index];
      const previewLayer = cloneLayer(layer);
      withLayer(index, previewLayer, () => {
        if (attrMode) paintAttributeShape('line', lineSession.start, end);
        else paintShape('line', lineSession.start, end, lineSession.on);
      });
      const previews = new Map([[index, previewLayer]]);
      render(flatten(previews), null, previews);
      showShapeMeasure(`${length} ${unit}`, clientX, clientY);
    }
    function stopLineSession() {
      if (!lineSession) return;
      if (shapePress?.kind === 'line') shapePress = null;
      lineSession = null; hideShapeMeasure(); render();
    }
    function refreshPolyline() {
      if (lineSession?.raw && lineSession.pointer)
        previewPolyline(lineSession.raw, shiftHeld, lineSession.pointer.x, lineSession.pointer.y);
    }
    function clickPolyline(p, shifted, clientX, clientY) {
      if (!lineSession) {
        lineSession = { layer: active(), start: p, on: true, committed: false };
        previewPolyline(p, shifted, clientX, clientY);
        return;
      }
      const index = layers.indexOf(lineSession.layer);
      if (index < 0) { stopLineSession(); return; }
      const { end } = lineEndpoint(lineSession.start, p, shifted);
      if (!lineSession.committed) { remember(); lineSession.committed = true; }
      withLayer(index, layers[index], () => {
        if (attrMode) paintAttributeShape('line', lineSession.start, end);
        else paintShape('line', lineSession.start, end, lineSession.on);
      });
      lineSession.start = end;
      previewPolyline(end, false, clientX, clientY);
    }
    function previewRectangle(raw, shifted, clientX, clientY) {
      if (!rectangleSession) return;
      const index = layers.indexOf(rectangleSession.layer);
      if (index < 0) { stopRectangleSession(); return; }
      rectangleSession.raw = raw;
      rectangleSession.pointer = { x: clientX, y: clientY };
      const end = rectangleSession.action === 'ellipse'
        ? ellipseEndpoint(rectangleSession.start, raw, shifted, rectangleSession.attrMode) : raw;
      const layer = layers[index];
      const previewLayer = cloneLayer(layer);
      withLayer(index, previewLayer, () => {
        if (rectangleSession.attrMode) paintAttributeShape(rectangleSession.action, rectangleSession.start, end);
        else paintShape(rectangleSession.action, rectangleSession.start, end, rectangleSession.on);
      });
      const previews = new Map([[index, previewLayer]]);
      render(flatten(previews), null, previews);
      const size = rectangle(rectangleSession.attrMode ? cellPoint(rectangleSession.start) : rectangleSession.start,
        rectangleSession.attrMode ? cellPoint(end) : end);
      showShapeMeasure(`${size.w}×${size.h} ${rectangleSession.attrMode ? tr('cells') : 'px'}`, clientX, clientY);
    }
    function stopRectangleSession() {
      if (!rectangleSession) return;
      if (shapePress?.kind === 'rectangle') shapePress = null;
      rectangleSession = null; hideShapeMeasure(); render();
    }
    function refreshRectangle() {
      if (!rectangleSession?.raw || !rectangleSession.pointer) return;
      rectangleSession.attrMode = attrMode && !rectangleSession.forceErase;
      previewRectangle(rectangleSession.raw, shiftHeld, rectangleSession.pointer.x, rectangleSession.pointer.y);
    }
    function clickRectangle(p, forceErase, shifted, clientX, clientY) {
      if (!rectangleSession) {
        rectangleSession = { layer: active(), action: tool, start: p, forceErase,
          attrMode: attrMode && !forceErase, on: !forceErase };
        previewRectangle(p, shifted, clientX, clientY);
        return true;
      }
      if (forceErase) {
        rectangleSession.forceErase = true;
        rectangleSession.attrMode = false;
        rectangleSession.on = false;
      }
      const index = layers.indexOf(rectangleSession.layer);
      if (index < 0) { stopRectangleSession(); return false; }
      const end = rectangleSession.action === 'ellipse'
        ? ellipseEndpoint(rectangleSession.start, p, shifted, rectangleSession.attrMode) : p;
      remember();
      withLayer(index, layers[index], () => {
        if (rectangleSession.attrMode) paintAttributeShape(rectangleSession.action, rectangleSession.start, end);
        else paintShape(rectangleSession.action, rectangleSession.start, end, rectangleSession.on);
      });
      stopRectangleSession();
      return false;
    }
    function cancelDrawingGesture() {
      if (lineSession || rectangleSession) {
        const pointerId = shapePress?.pointerId;
        if (lineSession) stopLineSession();
        else stopRectangleSession();
        if (pointerId != null && screen.hasPointerCapture(pointerId)) screen.releasePointerCapture(pointerId);
        return true;
      }
      if (!drag) return false;
      const current = drag;
      drag = null;
      if (screen.hasPointerCapture(current.pointerId)) screen.releasePointerCapture(current.pointerId);
      hideShapeMeasure();
      if (current.action === 'draw' || current.action === 'move-layer' || current.finalizedPending) {
        restore(undo, redo);
        redo.pop();
      } else {
        selection = current.action === 'move' ? current.source : current.previousSelection;
        render(); updateCanvasCursor();
      }
      return true;
    }
    function previewSelection(end, snap, clientX, clientY) {
      drag.raw = end;
      drag.pointer = { x: clientX, y: clientY };
      const size = selectionRectangle(drag.start, end, snap);
      drawOverlay(size);
      showShapeMeasure(`${size.w}×${size.h} px`, clientX, clientY);
    }
    function drawText(p, value) {
      const data = textUI.textPixels(value);
      if (!data) return;
      finishPendingMove();
      remember();
      const target = { x: p.x, y: p.y, w: data.w, h: data.h };
      selection = { ...target };
      const targetIndex = layers.indexOf(p.layer);
      pendingMove = { source: null, data, target, sourceLayer: null,
        targetLayer: targetIndex >= 0 ? targetIndex : activeLayer };
      setTool('select');
      render();
      note(tr('Text ready. Move, resize, or apply it.'));
    }
    const textUI = window.PIXIE_TEXT_UI.create({
      tr, note, textEntry, textPreview, textFont, textFontList, textLocalFonts,
      textSize, textBold, textItalic, getActiveLayer: active, drawText,
      getSize: () => ({ W, H }),
      getDrawState: () => ({ inkTransparent, paperTransparent, brightEnabled, bright, normal,
        ink, paper, attr: activeAttr() }),
      onPreview: () => navigatorUi?.drawNavigator(),
    });
    const { previewText, commitText, cancelText, startText } = textUI;
    document.addEventListener('click', event => {
      if (!textUI.session || event.target === textEntry || event.target.closest('#viewport, #text-settings, #panel-resizer')) return;
      if (document.querySelector('dialog[open]')) return;
      if (event.target.closest('#new, #open, #open-project, #save, #save-project, #save-png')) return;
      textEntry.focus({ preventScroll: true });
    });
    viewport.addEventListener('pointerdown', event => {
      if (event.target.closest('#stage')) return;
      if (tracePreview) return;
      if (textUI.session) commitText();
      if (lineSession) stopLineSession();
      if (rectangleSession) stopRectangleSession();
      if (selection) { remember(); finishPendingMove(); selection = null; render(); }
    });
    document.addEventListener('pointerdown', event => {
      if (tracePreview || selectedReference < 0 || event.target.closest('#reference-frame, .reference-row, #screen, #reference-trace, #trace-settings, #navigator, #panel-resizer')) return;
      selectedReference = -1;
      renderReferenceList();
    });
    function beginShapePress(kind, event) {
      shapePress = { kind, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      screen.setPointerCapture(event.pointerId);
    }
    function updateShapePress(event) {
      if (!shapePress || shapePress.pointerId !== event.pointerId) return;
      const dx = event.clientX - shapePress.x, dy = event.clientY - shapePress.y;
      if (dx * dx + dy * dy >= 9) shapePress.moved = true;
    }
    function beginTraceDrag(event, p) {
      const kind = traceHit(event.clientX, event.clientY);
      traceDrag = { pointerId: event.pointerId, kind, start: p,
        area: { ...tracePreview.area }, target: { ...pendingMove.target },
        before: traceState(), moved: false };
      screen.setPointerCapture(event.pointerId);
      event.preventDefault();
      updateCanvasCursor(p);
    }
    function moveTraceDrag(event, immediate = false) {
      if (!traceDrag || traceDrag.pointerId !== event.pointerId) return;
      const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
      const dx = p.x - traceDrag.start.x, dy = p.y - traceDrag.start.y;
      if (!dx && !dy && !traceDrag.moved) return;
      traceDrag.moved = true;
      if (traceDrag.kind === 'move') {
        traceControlsUI.clearTimer();
        const target = { ...traceDrag.target,
          x: clamp(traceDrag.target.x + dx, W - 1), y: clamp(traceDrag.target.y + dy, H - 1) };
        pendingMove.target = target; selection = { ...target }; render();
        return;
      }
      const area = traceDrag.kind === 'new'
        ? selectionRectangle(traceDrag.start, p, event.shiftKey || shiftHeld)
        : resizeTraceArea(traceDrag.area, traceDrag.kind, dx, dy, event.shiftKey || shiftHeld);
      const target = traceDrag.kind === 'new' ? area : {
        x: area.x + traceDrag.target.x - traceDrag.area.x,
        y: area.y + traceDrag.target.y - traceDrag.area.y, w: area.w, h: area.h };
      traceDrag.nextArea = area; traceDrag.nextTarget = target;
      queueTraceArea(area, target, immediate);
    }
    function finishTraceDrag(event, cancelled = false) {
      if (!traceDrag || traceDrag.pointerId !== event.pointerId) return false;
      const original = traceDrag;
      if (cancelled) {
        traceControlsUI.clearTimer();
        changeTraceArea(original.area, original.target);
      } else {
        moveTraceDrag(event, true);
        recordTraceChange(original.before);
      }
      traceDrag = null;
      updateCursor(event);
      return true;
    }
    screen.addEventListener('contextmenu', event => {
      if (tool === 'draw' || tool === 'rect' || tool === 'fill-rect' || tool === 'ellipse' || tool === 'fill') event.preventDefault();
    });
    screen.addEventListener('pointerdown', event => {
      if (tracePreview) {
        if (event.button === 0) beginTraceDrag(event, point(event));
        return;
      }
      if (shapePress) return;
      const forceErase = event.button === 2 && (tool === 'draw' || tool === 'rect' || tool === 'fill-rect' || tool === 'ellipse' || tool === 'fill');
      if (event.button !== 0 && !forceErase) return;
      const p = point(event); if (!inside(p.x, p.y)) return;
      if (tool === 'text' && textUI.session) {
        event.preventDefault();
        commitText();
        if (tool === 'text') setTool('select');
        updateCanvasCursor(p);
        return;
      }
      if (selectedReference >= 0 && !pendingMove) {
        event.preventDefault();
        selectedReference = -1;
        renderReferenceList();
        return;
      }
      if (forceErase) event.preventDefault();
      if (tool !== 'text' && textUI.session) commitText();
      const resizeHandle = tool === 'select' ? selectionResizeHit(event.clientX, event.clientY) : null;
      const previousSelection = selection ? { ...selection } : null;
      let finalizedPending = false;
      if (pendingMove && (tool !== 'select' || (!contains(selection, p) && !resizeHandle))) {
        remember(); finishPendingMove();
        finalizedPending = true;
      }
      if (tool !== 'select' && selection) { selection = null; drawOverlay(); }
      if (tool === 'text') {
        if (previousSelection && !finalizedPending) remember(previousSelection);
        const position = event.shiftKey || shiftHeld
          ? { x: p.x & ~7, y: p.y & ~7 } : p;
        event.preventDefault(); startText(position); return;
      }
      if (tool === 'line') {
        if (previousSelection && !finalizedPending) remember(previousSelection);
        event.preventDefault();
        clickPolyline(p, event.shiftKey || shiftHeld, event.clientX, event.clientY);
        if (lineSession) beginShapePress('line', event);
        return;
      }
      if (tool === 'rect' || tool === 'fill-rect' || tool === 'ellipse') {
        if (previousSelection && !finalizedPending) remember(previousSelection);
        event.preventDefault();
        if (clickRectangle(p, forceErase, event.shiftKey || shiftHeld, event.clientX, event.clientY)) beginShapePress('rectangle', event);
        return;
      }
      if (tool === 'fill') {
        event.preventDefault();
        fillArea(p, forceErase, finalizedPending ? null : previousSelection);
        render();
        return;
      }
      if (drawingTools.has(tool) && !finalizedPending) remember(previousSelection);
      if (tool === 'move-layer' && !finalizedPending) remember(previousSelection);
      drag = { start: p, last: p, action: resizeHandle ? 'resize'
        : tool === 'select' && contains(selection, p) ? 'move' : tool,
        attrMode: attrMode && drawingTools.has(tool) && !forceErase, previousSelection, finalizedPending,
        pointerId: event.pointerId };
      if (tool === 'draw' && !drag.attrMode) drag.on = !forceErase && (inkTransparent || !bit(p.x, p.y));
      if (tool === 'move-layer') drag.origin = { x: active().x, y: active().y };
      if (drag.action === 'move') {
        drag.source = { ...selection };
        drag.data = pendingMove ? pendingMove.data : capture(drag.source);
      }
      if (drag.action === 'resize') {
        drag.source = { ...selection };
        drag.sourceToClear = pendingMove ? pendingMove.source : drag.source;
        drag.sourceLayer = pendingMove ? pendingMove.sourceLayer : activeLayer;
        drag.targetLayer = pendingMove ? pendingMove.targetLayer : activeLayer;
        drag.originalData = pendingMove ? pendingMove.scaleSource || pendingMove.data : capture(drag.source);
        drag.cut = !!pendingMove?.cut;
        drag.handle = resizeHandle;
      }
      if (drag.action === 'select') selection = null;
      screen.setPointerCapture(event.pointerId);
      updateCanvasCursor(p);
      if (tool === 'draw') {
        if (drag.attrMode) paintAttrCell(p.x, p.y);
        else paintBrush(p.x, p.y, drag.on);
      }
      render();
      if (drag.action === 'select') previewSelection(p, event.shiftKey || shiftHeld, event.clientX, event.clientY);
    });
    screen.addEventListener('pointermove', event => {
      if (traceDrag) { moveTraceDrag(event); return; }
      updateShapePress(event);
      if (lineSession) {
        const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
        previewPolyline(p, event.shiftKey || shiftHeld, event.clientX, event.clientY);
        return;
      }
      if (rectangleSession) {
        const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
        previewRectangle(p, event.shiftKey || shiftHeld, event.clientX, event.clientY);
        return;
      }
      if (!drag) return;
      const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
      if (drag.action === 'draw') {
        if (drag.attrMode) cellLine(cellPoint(drag.last), cellPoint(p));
        else line(drag.last, p, drag.on);
      }
      if (drag.action === 'move-layer') {
        active().x = drag.origin.x + p.x - drag.start.x;
        active().y = drag.origin.y + p.y - drag.start.y;
        updateActiveLayerCoords();
      }
      if (drag.action === 'select') previewSelection(p, event.shiftKey || shiftHeld, event.clientX, event.clientY);
      else if (drag.action === 'move') previewMove(moveTarget(p));
      else if (drag.action === 'resize') previewSelectionResize(p, event.shiftKey || shiftHeld, event.clientX, event.clientY);
      else render();
      drag.last = p;
    });
    function updateCursor(event) {
      const p = point(event);
      cursorPoint = inside(p.x, p.y) ? p : null;
      paintCursor();
      updateCanvasCursor(cursorPoint, event.clientX, event.clientY);
    }
    screen.addEventListener('pointerdown', updateCursor);
    screen.addEventListener('pointermove', updateCursor);
    screen.addEventListener('pointerleave', () => { cursorPoint = null; paintCursor(); updateCanvasCursor(null); });
    screen.addEventListener('pointerup', event => {
      if (finishTraceDrag(event)) return;
      if (shapePress?.pointerId === event.pointerId) {
        updateShapePress(event);
        const press = shapePress;
        shapePress = null;
        if (press.moved) {
          const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
          if (press.kind === 'line' && lineSession) {
            clickPolyline(p, event.shiftKey || shiftHeld, event.clientX, event.clientY);
            stopLineSession();
          } else if (press.kind === 'rectangle' && rectangleSession) {
            clickRectangle(p, false, event.shiftKey || shiftHeld, event.clientX, event.clientY);
          }
        }
        return;
      }
      if (!drag) return;
      if (drag.action === 'draw') {
        const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
        if (drag.attrMode) cellLine(cellPoint(drag.last), cellPoint(p));
        else line(drag.last, p, drag.on);
      }
      if (drag.action === 'move-layer') {
        const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
        active().x = drag.origin.x + p.x - drag.start.x;
        active().y = drag.origin.y + p.y - drag.start.y;
        renderLayerList();
      }
      if (drag.action === 'select') {
        const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
        const snap = event.shiftKey || shiftHeld;
        const nextSelection = !snap && drag.start.x === p.x && drag.start.y === p.y
          ? null : selectionRectangle(drag.start, p, snap);
        if (!drag.finalizedPending && !sameSelection(drag.previousSelection, nextSelection)) remember(drag.previousSelection);
        selection = nextSelection;
      }
      if (drag.action === 'move') {
        const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
        const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
        if (dx || dy) {
          const target = moveTarget(p);
          if (!sameSelection(selection, target)) {
            remember();
            if (pendingMove) pendingMove.target = target;
            else pendingMove = { source: drag.source, data: drag.data, target,
              sourceLayer: activeLayer, targetLayer: activeLayer };
            selection = target;
          }
        } else { remember(); finishPendingMove(); selection = null; }
      }
      if (drag.action === 'resize') {
        const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
        previewSelectionResize(p, event.shiftKey || shiftHeld, event.clientX, event.clientY);
        if (!sameSelection(drag.source, drag.target)) {
          remember();
          pendingMove = { source: drag.sourceToClear, data: drag.data, target: { ...drag.target },
            sourceLayer: drag.sourceLayer, targetLayer: drag.targetLayer,
            scaleSource: drag.originalData, cut: drag.cut };
          selection = { ...drag.target };
        }
      }
      hideShapeMeasure(); drag = null; render();
      updateCursor(event);
    });
    screen.addEventListener('pointercancel', event => {
      if (finishTraceDrag(event, true)) return;
      if (shapePress) {
        if (shapePress.kind === 'line') stopLineSession();
        else stopRectangleSession();
        shapePress = null;
      }
      if (drag?.action === 'select') selection = drag.finalizedPending ? null : drag.previousSelection;
      hideShapeMeasure(); drag = null; render(); updateCanvasCursor();
    });
    document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
    document.querySelector('#new').onclick = newDocument;
    const newDialog = document.querySelector('#new-dialog');
    for (const input of document.querySelectorAll('#new-width, #new-height')) {
      input.addEventListener('focus', () => {
        document.querySelector('input[name="new-size"][value="custom"]').checked = true;
      });
    }
    function requestedSize() {
      if (document.querySelector('input[name="new-size"][value="screen"]').checked)
        return { width: MAX_W, height: MAX_H };
      const width = Number(document.querySelector('#new-width').value);
      const height = Number(document.querySelector('#new-height').value);
      if (!Number.isInteger(width) || !Number.isInteger(height) ||
          width < 1 || width > MAX_W || height < 1 || height > MAX_H) {
        document.querySelector('#new-size-error').textContent = tr('Size: width 1–256, height 1–192 pixels.');
        return null;
      }
      document.querySelector('#new-size-error').textContent = '';
      return { width, height };
    }
    document.querySelector('#new-cancel').onclick = () => newDialog.close();
    document.querySelector('#new-discard').onclick = () => {
      const size = requestedSize(); if (!size) return;
      newDialog.close(); resetDocument(size.width, size.height);
    };
    document.querySelector('#new-save').onclick = async () => {
      const size = requestedSize(); if (!size) return;
      newDialog.close();
      if (await saveProject()) resetDocument(size.width, size.height);
      else newDialog.showModal();
    };
    document.querySelector('#layer-add').onclick = addLayer;
    document.querySelector('#layer-up').onclick = () => moveLayerStack(1);
    document.querySelector('#layer-down').onclick = () => moveLayerStack(-1);
    document.querySelector('#layer-merge').onclick = mergeDown;
    function captureSelection() {
      if (tracePreview) {
        traceControlsUI.clearTimer();
        if (traceDrag?.nextArea) changeTraceArea(traceDrag.nextArea, traceDrag.nextTarget);
        else updateFloatingTrace();
      }
      if (!pendingMove) return capture(selection);
      const data = pendingMove.data;
      return { ...data, x: selection.x, y: selection.y,
        bits: data.bits.slice(), colors: data.colors.slice(), opacity: data.opacity.slice() };
    }
    document.querySelector('#copy').onclick = () => {
      if (!selection) return;
      clipboard = captureSelection();
      if (pendingMove) pendingMove.cut = false;
      note(tr(tracePreview ? 'Traced selection copied.' : 'Selection copied.'));
    };
    document.querySelector('#cut').onclick = () => {
      if (!selection) return;
      if (tracePreview) {
        clipboard = captureSelection(); cancelTrace(false);
        note(tr('Traced selection cut to clipboard.')); return;
      }
      clipboard = captureSelection(); remember();
      const previous = pendingMove;
      const cleared = copyPixels(clipboard);
      cleared.opacity.fill(0);
      pendingMove = { source: previous ? previous.source : { ...selection },
        data: cleared, target: { ...selection },
        sourceLayer: previous ? previous.sourceLayer : activeLayer,
        targetLayer: previous ? previous.targetLayer : activeLayer, cut: true };
      render();
      note(tr('Selection cut.'));
    };
    document.querySelector('#paste').onclick = () => {
      if (!clipboard) { note(tr('Copy a selection first.')); return; }
      if (tracePreview) cancelTrace(false);
      commitText(); remember();
      selection = { x: clipboard.x, y: clipboard.y, w: clipboard.w, h: clipboard.h };
      if (pendingMove?.cut) {
        pendingMove.data = copyPixels(clipboard);
        pendingMove.target = { ...selection };
        pendingMove.cut = false;
      } else {
        finishPendingMove();
        pendingMove = copyMove({ source: null, data: clipboard, target: selection,
          sourceLayer: null, targetLayer: activeLayer });
      }
      setTool('select'); render();
      note(tr('Paste ready. Move or apply it.'));
    };
    document.querySelector('#undo').onclick = () => tracePreview ? undoTrace()
      : cancelDrawingGesture() || restore(undo, redo);
    document.querySelector('#redo').onclick = () => tracePreview ? redoTrace() : restore(redo, undo);
    document.querySelector('#swap').onclick = () => {
      [ink, paper] = [paper, ink];
      [inkTransparent, paperTransparent] = [paperTransparent, inkTransparent];
      updateSwatches(); previewText(); refreshPolyline(); refreshRectangle();
    };
    brightControl.onclick = () => {
      brightEnabled = !brightEnabled;
      brightControl.classList.toggle('active', brightEnabled);
      brightControl.setAttribute('aria-pressed', String(brightEnabled));
      updateSwatches();
      updateBackgroundSwatches();
      previewText();
      refreshPolyline(); refreshRectangle();
    };
    gridControl.onclick = () => {
      gridEnabled = !gridEnabled;
      gridControl.classList.toggle('active', gridEnabled);
      gridControl.setAttribute('aria-pressed', String(gridEnabled));
      updateGrid();
    };
    zxPreviewControl.onclick = () => {
      setZxPreview(!zxPreview);
      note(tr(zxPreview ? 'ZX attribute preview on.' : 'ZX attribute preview off.'));
    };
    window.PIXIE_VIEWPORT.bindPanelResizer(
      document.querySelector('#panel-resizer'), document.querySelector('.workspace'));
    navigatorUi = window.PIXIE_VIEWPORT.bind({
      viewport, stage, getSize: () => ({ width: W, height: H }),
      getZoom: () => zoom, setZoom: value => { zoom = value; },
      renderReferences, drawOverlay, drawTransparency, updateGrid,
      navigator: document.querySelector('#navigator'),
      navigatorCanvas: document.querySelector('#navigator-canvas'),
      navigatorWindow: document.querySelector('#navigator-window'),
      screen, textCanvas: textPreview.canvas,
      getNavigatorScene: () => ({ references, tracing: tracePreview?.reference,
        background: backgroundCode < 0 ? null :
          (backgroundCode >= 8 ? bright[backgroundCode - 8] : normal[backgroundCode]) }),
    });
    const { zoomAt, zoomAtCenter, fitZoom } = navigatorUi;
    function projectText() {
      const previews = pendingMove && !tracePreview ? pendingPreviewLayers() : null;
      return window.PIXIE_PROJECT.projectText({
        width: W, height: H, activeLayer, backgroundCode, zxPreview, traceSettings,
        layers: layers.map((layer, index) => layerForPreview(index, previews)), references,
      });
    }
    function hasUnsavedChanges() {
      return !!(textUI.session && textEntry.value) || projectText() !== savedProjectText;
    }
    function confirmReplacement() {
      if (!hasUnsavedChanges()) return Promise.resolve(true);
      return new Promise(resolve => {
        const dialog = document.querySelector('#unsaved-dialog');
        if (dialog.open) { resolve(false); return; }
        const cancel = document.querySelector('#unsaved-cancel');
        const discard = document.querySelector('#unsaved-discard');
        const save = document.querySelector('#unsaved-save');
        let done = false;
        function finish(confirmed) {
          if (done) return;
          done = true;
          dialog.removeEventListener('close', onClose);
          cancel.onclick = discard.onclick = save.onclick = null;
          if (dialog.open) dialog.close();
          resolve(confirmed);
        }
        function onClose() { if (!dialog.open) finish(false); }
        cancel.onclick = () => finish(false);
        discard.onclick = () => finish(true);
        save.onclick = async () => {
          dialog.removeEventListener('close', onClose);
          dialog.close();
          if (await saveProject()) finish(true);
          else {
            dialog.addEventListener('close', onClose);
            dialog.showModal();
          }
        };
        dialog.addEventListener('close', onClose);
        dialog.showModal();
      });
    }
    const parseProject = source => window.PIXIE_PROJECT.parseProject(source, tr, window.PIXIE_TRACE);
    document.querySelector('#open').onclick = () => document.querySelector('#file').click();
    document.querySelector('#file').onchange = async event => {
      const file = event.target.files[0]; if (!file) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length !== 6912) {
        note(tr('A standard 6912-byte SCR file is required.'));
        event.target.value = ''; return;
      }
      if (!await confirmReplacement()) { event.target.value = ''; return; }
      stopLineSession(); stopRectangleSession(); cancelText();
      setDocumentSize(MAX_W, MAX_H, true);
      layers = [{ name: file.name, visible: true, solo: false, x: 0, y: 0,
        bitmap: bytes.slice(0, 6144), attrs: bytes.slice(6144), mask: new Uint8Array(6144).fill(0xff), extra: new Map() }];
      traceControlsUI.clearTimer();
      tracePreview = null; traceDrag = null;
      references = []; selectedReference = -1; renderReferences(); renderReferenceList();
      traceSettingsPanel.hidden = true;
      traceSettings = { ...window.PIXIE_TRACE.defaults }; syncTraceControls();
      activeLayer = 0; backgroundCode = -1; zxPreview = true;
      zxPreviewControl.classList.add('active'); zxPreviewControl.setAttribute('aria-pressed', 'true');
      updateBackgroundSwatches();
      projectFileName = fileStem(file.name) + '.pixie'; exportFileName = file.name;
      projectHandle = null; projectDocumentId = nextProjectDocumentId++;
      savedProjectText = null;
      undo.length = 0; redo.length = 0; selection = null; pendingMove = null;
      renderLayerList(); render(); note(tr('Imported SCR: {name}', { name: file.name }));
      event.target.value = '';
    };
    document.querySelector('#save').onclick = async () => {
      const name = await askFileName('SCR', exportFileName, '.scr');
      if (!name) return;
      commitText();
      exportFileName = name;
      download(name, flatten(tracePreview ? null : undefined), 'application/octet-stream');
    };
    document.querySelector('#save-png').onclick = async () => {
      const name = await askFileName('PNG', fileStem(projectFileName) + '.png', '.png');
      if (!name) return;
      commitText();
      const { imageColors, coverage } = compositePixels(tracePreview ? null : undefined);
      const scr = zxPreview ? flatten(tracePreview ? null : undefined) : null;
      const blob = await window.PIXIE_DISPLAY.pngBlob(W, H, imageColors, coverage, scr, paletteRgb);
      if (!blob) { note(tr('Could not create PNG.')); return; }
      download(name, blob, 'image/png');
    };
    async function loadProject(file, handle = null) {
      try {
        const source = await file.text();
        let project = parseProject(source);
        if (!await confirmReplacement()) return;
        if (handle) {
          const currentSource = await (await handle.getFile()).text();
          if (currentSource !== source) project = parseProject(currentSource);
        }
        await Promise.all(project.references.map(async reference => {
          reference.image = await decodeReference(reference.dataUrl);
        }));
        stopLineSession(); stopRectangleSession(); cancelText();
        layers = project.layers; references = project.references; selectedReference = -1;
        traceControlsUI.clearTimer();
        tracePreview = null; traceDrag = null;
        traceSettingsPanel.hidden = true;
        traceSettings = project.traceSettings; syncTraceControls();
        activeLayer = project.activeLayer; backgroundCode = project.background;
        zxPreview = project.zxPreview;
        zxPreviewControl.classList.toggle('active', zxPreview);
        zxPreviewControl.setAttribute('aria-pressed', String(zxPreview));
        setDocumentSize(project.width, project.height, true);
        updateBackgroundSwatches();
        projectFileName = file.name; exportFileName = fileStem(file.name) + '.scr';
        projectHandle = handle; projectDocumentId = nextProjectDocumentId++;
        undo.length = 0; redo.length = 0; selection = null; pendingMove = null;
        renderLayerList(); renderReferenceList(); renderReferences(); render();
        savedProjectText = projectText();
        note(tr('Opened project {name}', { name: file.name }));
      } catch (error) { note(tr('Could not open project: {message}', { message: error.message })); }
    }
    document.querySelector('#open-project').onclick = async () => {
      if (!window.showOpenFilePicker) { document.querySelector('#project-file').click(); return; }
      try {
        const [handle] = await window.showOpenFilePicker({ types: [{ description: 'Pixie project',
          accept: { 'application/octet-stream': ['.pixie'] } }] });
        if (handle) await loadProject(await handle.getFile(), handle);
      } catch (error) {
        if (error.name !== 'AbortError') note(tr('Could not open project: {message}', { message: error.message }));
      }
    };
    document.querySelector('#project-file').onchange = async event => {
      const file = event.target.files[0]; if (file) await loadProject(file);
      event.target.value = '';
    };
    function setProjectFile(handle, name) {
      projectHandle = handle;
      projectFileName = name;
      exportFileName = fileStem(name) + '.scr';
      for (const saved of [...undo, ...redo]) {
        if (saved.projectDocumentId !== projectDocumentId) continue;
        saved.projectHandle = handle;
        saved.projectFileName = name;
        saved.exportFileName = exportFileName;
      }
    }
    async function saveProject() {
      if (window.showSaveFilePicker) {
        try {
          const handle = projectHandle || await window.showSaveFilePicker({ suggestedName: projectFileName,
            types: [{ description: 'Pixie project', accept: { 'application/octet-stream': ['.pixie'] } }] });
          if (!await canWriteProject(handle)) {
            note(tr('Write access to the project file was not granted.'));
            return false;
          }
          commitText();
          const content = projectText();
          const writable = await handle.createWritable();
          await writable.write(content);
          await writable.close();
          setProjectFile(handle, handle.name);
          savedProjectText = content;
          note(tr('Saved project {name}', { name: handle.name }));
          return true;
        } catch (error) {
          if (error.name !== 'AbortError') note(tr('Could not save project: {message}', { message: error.message }));
          return false;
        }
      }
      const name = await askFileName(tr('Pixie project'), projectFileName, '.pixie');
      if (!name) return false;
      commitText();
      setProjectFile(null, name);
      const content = projectText();
      download(name, content, 'application/toml;charset=utf-8');
      savedProjectText = content;
      note(tr('Downloaded a copy: {name}', { name }));
      return true;
    }
    document.querySelector('#save-project').onclick = saveProject;
    let shiftHeld = false;
    document.addEventListener('keydown', event => {
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        shiftHeld = true;
        refreshPolyline(); refreshRectangle(); refreshSelectionResize();
        if (drag?.action === 'select' && drag.raw && drag.pointer) previewSelection(drag.raw, true, drag.pointer.x, drag.pointer.y);
      }
    }, true);
    document.addEventListener('keyup', event => {
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        shiftHeld = false;
        refreshPolyline(); refreshRectangle(); refreshSelectionResize();
        if (drag?.action === 'select' && drag.raw && drag.pointer) previewSelection(drag.raw, false, drag.pointer.x, drag.pointer.y);
      }
    }, true);
    window.addEventListener('blur', () => { shiftHeld = false; hideShapeMeasure(); });
    document.addEventListener('keydown', event => {
      if (document.querySelector('#name-dialog').open || document.querySelector('#new-dialog').open) return;
      const typing = event.target instanceof Element && !!event.target.closest('input, textarea, select, [contenteditable="true"]');
      const code = event.code;
      if (event.altKey && !event.metaKey && !event.ctrlKey && !typing) {
        if (code === 'KeyP' && !event.shiftKey) {
          event.preventDefault(); document.querySelector('#save-png').click(); return;
        }
        const digit = /^Digit([0-9])$/.exec(event.code);
        const shifted = event.shiftKey || shiftHeld;
        if (digit && shifted && Number(digit[1]) >= 1 && Number(digit[1]) <= strokeSizes.length) {
          event.preventDefault(); setStrokeWidth(strokeSizes[Number(digit[1]) - 1]); return;
        }
        if (digit && !shifted) {
          event.preventDefault(); if (digit[1] === '0') fitZoom(); else zoomAtCenter(Number(digit[1])); return;
        }
      }
      if (event.metaKey || event.ctrlKey) {
        if (code === 'KeyO') {
          event.preventDefault(); document.querySelector(event.shiftKey ? '#open' : '#open-project').click(); return;
        }
        if (code === 'KeyS') {
          event.preventDefault(); document.querySelector(event.shiftKey ? '#save' : '#save-project').click(); return;
        }
        if (tracePreview && (code === 'KeyC' || code === 'KeyX')) {
          event.preventDefault(); document.querySelector(code === 'KeyC' ? '#copy' : '#cut').click(); return;
        }
        if (tracePreview && code === 'KeyZ') {
          event.preventDefault(); if (event.shiftKey) redoTrace(); else undoTrace(); return;
        }
        if (typing) return;
        if (code === 'KeyZ') {
          event.preventDefault();
          if (!event.shiftKey && cancelDrawingGesture()) return;
          restore(event.shiftKey ? redo : undo, event.shiftKey ? undo : redo);
        }
        if (code === 'KeyC' && selection) { event.preventDefault(); document.querySelector('#copy').click(); }
        if (code === 'KeyX' && selection) { event.preventDefault(); document.querySelector('#cut').click(); }
        if (code === 'KeyV') { event.preventDefault(); document.querySelector('#paste').click(); }
        return;
      }
      if (tracePreview && event.key === 'Enter' && !event.altKey && event.target.tagName !== 'SELECT') {
        event.preventDefault(); applyTrace(); return;
      }
      if (event.key === 'Escape') {
        if (cancelDrawingGesture()) { event.preventDefault(); return; }
        if (tracePreview) { event.preventDefault(); cancelTrace(); return; }
        if (selection || pendingMove) {
          event.preventDefault(); remember();
          pendingMove = null; selection = null;
          updateReferenceFrame(); render(); updateCanvasCursor();
          return;
        }
        if (selectedReference >= 0) {
          event.preventDefault(); selectedReference = -1; renderReferenceList(); return;
        }
        if (typing) event.target.blur();
        setTool('draw'); render(); return;
      }
      if (typing || event.altKey) return;
      if (event.key === 'Enter' && selection) {
        event.preventDefault(); remember();
        finishPendingMove(); selection = null;
        render(); updateCanvasCursor();
        return;
      }
      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (directions[event.key] && selection && tool !== 'move-layer') {
        event.preventDefault();
        const [dx, dy] = directions[event.key];
        nudgeSelection(nudgeCoordinate(selection.x, dx, event.shiftKey) - selection.x,
          nudgeCoordinate(selection.y, dy, event.shiftKey) - selection.y);
        return;
      }
      if (selection && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault(); remember(); removeSelectionPixels(); render();
        note(tr('Selection cleared. Clipboard unchanged.')); return;
      }
      if (tool === 'move-layer' && directions[event.key]) {
        event.preventDefault(); remember();
        const [dx, dy] = directions[event.key];
        active().x = nudgeCoordinate(active().x, dx, event.shiftKey);
        active().y = nudgeCoordinate(active().y, dy, event.shiftKey);
        renderLayerList(); render(); return;
      }
      if (directions[event.key]) {
        event.preventDefault();
        const [dx, dy] = directions[event.key];
        const step = event.shiftKey ? 192 : 48;
        viewport.scrollLeft += dx * step;
        viewport.scrollTop += dy * step;
        return;
      }
      const digit = /^Digit([1-8])$/.exec(event.code);
      if (digit) {
        event.preventDefault();
        chooseColor(event.shiftKey ? 'paper' : 'ink', Number(digit[1]) - 1); return;
      }
      if (code === 'Digit0') {
        event.preventDefault();
        chooseColor(event.shiftKey ? 'paper' : 'ink', 8); return;
      }
      const shortcuts = {
        KeyB: () => setTool('draw'), KeyD: () => setTool('line'), KeyR: () => setTool('rect'), KeyF: () => setTool('fill-rect'),
        KeyE: () => setTool('ellipse'), KeyP: () => setTool('fill'), KeyS: () => setTool('select'),
        KeyM: () => setTool('move-layer'), KeyA: () => attrModeButton.click(), KeyT: () => setTool('text'),
        KeyN: newDocument,
        KeyI: () => document.querySelector('#swap').click(),
        KeyH: () => brightControl.click(), KeyG: () => gridControl.click(),
        KeyZ: () => zxPreviewControl.click(),
        KeyK: activateTrace,
        KeyV: () => cycleLayerVisibility(active()),
      };
      if (code === 'KeyL') {
        event.preventDefault();
        if (event.shiftKey) deleteLayer(); else addLayer();
        return;
      }
      if (code === 'KeyM' && event.shiftKey) { event.preventDefault(); mergeDown(); return; }
      if (code === 'BracketRight') { event.preventDefault(); moveLayerStack(1); return; }
      if (code === 'BracketLeft') { event.preventDefault(); moveLayerStack(-1); return; }
      if (shortcuts[code]) { event.preventDefault(); shortcuts[code](); return; }
    });
    drawTransparency(); fitZoom(); updateGrid(); renderLayerList(); render();
    savedProjectText = projectText();
  })();
