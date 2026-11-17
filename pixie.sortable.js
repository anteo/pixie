window.PIXIE_SORTABLE = (() => {
  function bind(list, { rowSelector, blockedSelector, itemAt, reorder }) {
    let drag = null, suppressClick = false;
    const clearMarkers = () => {
      for (const row of list.children) row.classList.remove('drop-before', 'drop-after');
    };
    const clearDragging = () => {
      for (const row of list.children) row.classList.remove('dragging');
      clearMarkers();
    };
    list.addEventListener('pointerdown', event => {
      suppressClick = false;
      if (event.button !== 0 || event.target.closest(blockedSelector)) return;
      const row = event.target.closest(rowSelector);
      if (!row || !list.contains(row)) return;
      drag = { source: itemAt(Number(row.dataset.index)), pointerId: event.pointerId,
        x: event.clientX, y: event.clientY, active: false, target: null, before: false };
    });
    list.addEventListener('pointermove', event => {
      const move = drag;
      if (!move || move.pointerId !== event.pointerId) return;
      if (!move.active) {
        const dx = event.clientX - move.x, dy = event.clientY - move.y;
        if (dx * dx + dy * dy < 16) return;
        move.active = true;
        list.setPointerCapture(event.pointerId);
        const sourceRow = [...list.children].find(row => itemAt(Number(row.dataset.index)) === move.source);
        sourceRow?.classList.add('dragging');
      }
      event.preventDefault(); clearMarkers();
      move.target = null;
      const bounds = list.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) return;
      const rows = [...list.children];
      const targetRow = rows.find(row => event.clientY <= row.getBoundingClientRect().bottom) || rows.at(-1);
      if (!targetRow) return;
      const box = targetRow.getBoundingClientRect();
      move.target = itemAt(Number(targetRow.dataset.index));
      move.before = event.clientY < box.top + box.height / 2;
      targetRow.classList.add(move.before ? 'drop-before' : 'drop-after');
    });
    list.addEventListener('pointerup', event => {
      const move = drag;
      if (!move || move.pointerId !== event.pointerId) return;
      drag = null;
      if (list.hasPointerCapture(event.pointerId)) list.releasePointerCapture(event.pointerId);
      clearDragging();
      if (!move.active) return;
      suppressClick = true;
      if (move.target) reorder(move.source, move.target, move.before);
    });
    list.addEventListener('pointercancel', event => {
      if (drag?.pointerId !== event.pointerId) return;
      drag = null;
      clearDragging();
    });
    return { get suppressClick() { return suppressClick; } };
  }
  return { bind };
})();
