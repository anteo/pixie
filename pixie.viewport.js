window.PIXIE_VIEWPORT = (() => {
  function bind({ viewport, stage, getSize, getZoom, setZoom,
    renderReferences, drawOverlay, drawTransparency, updateGrid }) {
    function zoomAt(value, clientX, clientY) {
      const next = Math.max(1, Math.min(24, value));
      const current = getZoom();
      if (next === current) return;
      const view = viewport.getBoundingClientRect();
      if (!Number.isFinite(clientX)) clientX = view.left + view.width / 2;
      if (!Number.isFinite(clientY)) clientY = view.top + view.height / 2;
      const rect = stage.getBoundingClientRect();
      const x = (clientX - rect.left) / current, y = (clientY - rect.top) / current;
      const { width, height } = getSize();
      setZoom(next);
      stage.style.width = width * next + 'px';
      stage.style.height = height * next + 'px';
      renderReferences();
      drawOverlay();
      if ((current >= 8) !== (next >= 8)) { drawTransparency(); updateGrid(); }
      viewport.scrollLeft += x * (next - current);
      viewport.scrollTop += y * (next - current);
    }
    function zoomAtCenter(value) {
      const rect = viewport.getBoundingClientRect();
      zoomAt(value, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    function fitZoom() {
      const { width, height } = getSize();
      const fitWidth = (viewport.clientWidth - 60) / width;
      const fitHeight = (viewport.clientHeight - 60) / height;
      zoomAtCenter(Math.max(1, Math.min(fitWidth, fitHeight)));
    }
    document.querySelector('#zoom-1').onclick = () => zoomAtCenter(1);
    document.querySelector('#zoom-2').onclick = () => zoomAtCenter(2);
    document.querySelector('#zoom-fit').onclick = fitZoom;
    // Chromium sends trackpad pinch as Ctrl+wheel. An ordinary wheel scrolls the viewport.
    let safariGesture = false, safariScale = 1;
    viewport.addEventListener('wheel', event => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (!safariGesture) zoomAt(getZoom() * Math.exp(-event.deltaY * 0.01), event.clientX, event.clientY);
    }, { passive: false });
    // Safari uses gesture events for the same trackpad motion.
    viewport.addEventListener('gesturestart', event => {
      event.preventDefault(); safariGesture = true; safariScale = 1;
    }, { passive: false });
    viewport.addEventListener('gesturechange', event => {
      event.preventDefault();
      zoomAt(getZoom() * event.scale / safariScale, event.clientX, event.clientY);
      safariScale = event.scale;
    }, { passive: false });
    viewport.addEventListener('gestureend', event => {
      event.preventDefault(); safariGesture = false;
    }, { passive: false });
    return { zoomAt, zoomAtCenter, fitZoom };
  }
  return { bind };
})();
