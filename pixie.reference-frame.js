window.PIXIE_REFERENCE_FRAME = (() => {
  function bind(frame, { selected, getReferences, getZoom, remember, render }) {
    let drag = null;
    frame.addEventListener('pointerdown', event => {
      const index = selected();
      if (event.button !== 0 || index < 0) return;
      const handle = event.target.dataset.handle || 'move';
      event.preventDefault(); event.stopPropagation();
      const reference = getReferences()[index];
      drag = { reference, handle, pointerId: event.pointerId,
        clientX: event.clientX, clientY: event.clientY,
        x: reference.x, y: reference.y, width: reference.width, height: reference.height, changed: false };
      event.target.setPointerCapture(event.pointerId);
    });
    frame.addEventListener('pointermove', event => {
      const move = drag;
      if (!move || move.pointerId !== event.pointerId || !getReferences().includes(move.reference)) return;
      event.preventDefault();
      const dx = (event.clientX - move.clientX) / getZoom();
      const dy = (event.clientY - move.clientY) / getZoom();
      let x = move.x, y = move.y, width = move.width, height = move.height;
      if (move.handle === 'move') { x += dx; y += dy; }
      else {
        const west = move.handle.includes('w'), north = move.handle.includes('n');
        width = Math.max(1, move.width + (west ? -dx : dx));
        height = Math.max(1, move.height + (north ? -dy : dy));
        if (event.shiftKey) {
          const scaleX = width / move.width, scaleY = height / move.height;
          const scale = Math.max(1 / move.width, 1 / move.height,
            Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY);
          width = move.width * scale; height = move.height * scale;
        }
        if (west) x = move.x + move.width - width;
        if (north) y = move.y + move.height - height;
      }
      if (Math.abs(x - move.reference.x) < 0.01 && Math.abs(y - move.reference.y) < 0.01 &&
          Math.abs(width - move.reference.width) < 0.01 && Math.abs(height - move.reference.height) < 0.01) return;
      if (!move.changed) { remember(); move.changed = true; }
      Object.assign(move.reference, { x, y, width, height });
      render();
    });
    const finish = event => { if (drag?.pointerId === event.pointerId) drag = null; };
    frame.addEventListener('pointerup', finish);
    frame.addEventListener('pointercancel', finish);
  }
  return { bind };
})();
