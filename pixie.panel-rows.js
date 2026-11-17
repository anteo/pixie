window.PIXIE_PANEL_ROWS = (() => {
  function layer({ layer, index, active, muted, canDelete, tr, select, toggle, rename, remove }) {
    const row = document.createElement('div');
    row.dataset.index = String(index);
    row.className = 'layer-row' + (active ? ' active' : '') + (muted ? ' solo-muted' : '');
    row.title = tr('Select or drag layer; double-click its name to rename');
    row.onclick = select;
    const eye = document.createElement('button');
    const state = layer.solo ? 'Solo' : layer.visible ? 'On' : 'Off';
    const next = layer.solo ? 'On' : layer.visible ? 'Off' : 'Solo';
    eye.type = 'button'; eye.className = 'layer-eye';
    eye.title = tr('Layer state: {state}; click for {next} (V for active layer)',
      { state: tr(state), next: tr(next) });
    eye.setAttribute('aria-label', eye.title);
    eye.setAttribute('aria-pressed', layer.solo ? 'mixed' : String(layer.visible));
    eye.innerHTML = layer.solo ? '<span class="solo-mark" aria-hidden="true">S</span>'
      : `<svg class="icon"><use href="#i-eye${layer.visible ? '' : '-off'}"/></svg>`;
    eye.onclick = event => { event.stopPropagation(); toggle(); };
    const name = document.createElement('span');
    name.className = 'layer-name'; name.textContent = layer.name;
    name.ondblclick = event => { event.stopPropagation(); rename(); };
    const coords = document.createElement('span');
    coords.className = 'layer-coords'; coords.textContent = `${layer.x}:${layer.y}`;
    coords.title = tr('Layer offset: x {x}, y {y}', { x: layer.x, y: layer.y });
    const removeButton = document.createElement('button');
    removeButton.type = 'button'; removeButton.className = 'icon-button';
    removeButton.title = tr('Delete layer'); removeButton.setAttribute('aria-label', removeButton.title);
    removeButton.disabled = !canDelete;
    removeButton.innerHTML = '<svg class="icon"><use href="#i-trash"/></svg>';
    removeButton.onclick = event => { event.stopPropagation(); remove(); };
    row.append(eye, name, coords, removeButton);
    return row;
  }

  function reference({ reference, index, active, tr, select, toggle, remove, opacityChange }) {
    const row = document.createElement('div');
    row.dataset.index = String(index);
    row.className = 'reference-row' + (active ? ' active' : '');
    row.title = tr('Select or drag reference; move or resize it on the canvas');
    row.onclick = select;
    const thumb = document.createElement('img');
    thumb.src = reference.dataUrl; thumb.alt = ''; thumb.draggable = false;
    const name = document.createElement('span');
    name.className = 'reference-name'; name.textContent = reference.name; name.title = reference.name;
    const eye = document.createElement('button');
    eye.type = 'button'; eye.className = 'icon-button';
    eye.title = tr(reference.visible ? 'Hide reference' : 'Show reference');
    eye.setAttribute('aria-label', eye.title);
    eye.innerHTML = `<svg class="icon"><use href="#i-eye${reference.visible ? '' : '-off'}"/></svg>`;
    eye.onclick = event => { event.stopPropagation(); toggle(); };
    const removeButton = document.createElement('button');
    removeButton.type = 'button'; removeButton.className = 'icon-button';
    removeButton.title = tr('Delete reference'); removeButton.setAttribute('aria-label', removeButton.title);
    removeButton.innerHTML = '<svg class="icon"><use href="#i-trash"/></svg>';
    removeButton.onclick = event => { event.stopPropagation(); remove(); };
    const opacity = document.createElement('label');
    opacity.className = 'reference-opacity';
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.value = String(Math.round(reference.opacity * 100));
    slider.title = tr('Reference opacity');
    slider.setAttribute('aria-label', `${reference.name}: ${tr('Reference opacity')}`);
    const output = document.createElement('output');
    output.textContent = `${slider.value}%`;
    let editing = false;
    slider.oninput = event => {
      event.stopPropagation();
      opacityChange(Number(slider.value) / 100, !editing);
      editing = true;
      output.textContent = `${slider.value}%`;
    };
    slider.onchange = () => { editing = false; };
    slider.onblur = () => { editing = false; };
    slider.onclick = event => event.stopPropagation();
    opacity.append(slider, output);
    row.append(eye, thumb, name, removeButton, opacity);
    return row;
  }
  return { layer, reference };
})();
