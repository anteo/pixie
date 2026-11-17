window.PIXIE_REFERENCES = (() => {
  function updateFrame(frame, references, selectedIndex, tracing, pendingMove, zoom) {
    const reference = references[selectedIndex];
    frame.hidden = !reference || !reference.visible || !!tracing || !!pendingMove;
    if (frame.hidden) return;
    frame.style.left = `${reference.x * zoom}px`;
    frame.style.top = `${reference.y * zoom}px`;
    frame.style.width = `${reference.width * zoom}px`;
    frame.style.height = `${reference.height * zoom}px`;
  }
  function render(layer, frame, references, selectedIndex, tracing, pendingMove, zoom) {
    const visibleImages = [];
    for (const reference of references) {
      if (tracing && reference !== tracing.reference) continue;
      if (!reference.visible || !reference.image || reference.opacity <= 0) continue;
      const image = reference.image;
      const width = reference.width * zoom, height = reference.height * zoom;
      image.style.left = `${reference.x * zoom}px`;
      image.style.top = `${reference.y * zoom}px`;
      image.style.width = `${width}px`;
      image.style.height = `${height}px`;
      image.style.opacity = String(reference.opacity);
      image.style.imageRendering = width >= image.naturalWidth && height >= image.naturalHeight
        ? 'pixelated' : 'auto';
      visibleImages.push(image);
    }
    layer.replaceChildren(...visibleImages);
    updateFrame(frame, references, selectedIndex, tracing, pendingMove, zoom);
  }
  function sample(reference, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(reference.image, reference.x, reference.y, reference.width, reference.height);
    return context.getImageData(0, 0, width, height);
  }
  function area(reference, width, height) {
    const left = Math.max(0, Math.floor(reference.x));
    const top = Math.max(0, Math.floor(reference.y));
    const right = Math.min(width, Math.ceil(reference.x + reference.width));
    const bottom = Math.min(height, Math.ceil(reference.y + reference.height));
    return right > left && bottom > top ? { x: left, y: top, w: right - left, h: bottom - top } : null;
  }
  return { updateFrame, render, sample, area };
})();
