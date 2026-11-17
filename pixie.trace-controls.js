window.PIXIE_TRACE_CONTROLS = (() => {
  function bind({ getSettings, setSettings, getPreview, traceState,
    recordTraceChange, updateFloatingTrace }) {
    const controls = [...document.querySelectorAll('[data-trace]')];
    const beforeEdit = new Map();
    let updateTimer = null;
    const clearTimer = () => { clearTimeout(updateTimer); updateTimer = null; };
    const schedule = (callback, delay) => { clearTimer(); updateTimer = setTimeout(callback, delay); };
    const clearHistory = () => beforeEdit.clear();
    function sync() {
      const settings = getSettings();
      for (const control of controls) {
        const key = control.dataset.trace;
        if (control.type === 'checkbox') control.checked = settings[key];
        else control.value = String(settings[key]);
        const output = control.closest('label').querySelector('output');
        if (output) output.textContent = `${settings[key]}${['saturation', 'simplify', 'noise', 'ditherStrength',
          'checkerStrength', 'ditherDensity', 'clashStrength'].includes(key) ? '%' : ''}`;
        const unavailable = key === 'ditherStrength' && ['none', 'checker'].includes(settings.ditherMode)
          || ['checkerStrength', 'ditherDensity'].includes(key) && settings.ditherMode !== 'checker'
          || key === 'clashStrength' && !settings.optimizeClashing;
        control.closest('label').hidden = unavailable;
      }
    }
    function flushHistory() {
      for (const before of beforeEdit.values()) recordTraceChange(before);
      beforeEdit.clear();
    }
    for (const control of controls) {
      const beginEdit = () => {
        if (getPreview() && !beforeEdit.has(control)) beforeEdit.set(control, traceState());
      };
      const finishEdit = () => {
        const before = beforeEdit.get(control);
        if (before) recordTraceChange(before);
        beforeEdit.delete(control);
      };
      control.addEventListener('pointerdown', beginEdit);
      control.addEventListener('keydown', beginEdit);
      control.addEventListener('input', () => {
        beginEdit();
        const key = control.dataset.trace;
        const settings = getSettings();
        settings[key] = control.type === 'checkbox' ? control.checked
          : control.tagName === 'SELECT' ? control.value : Number(control.value);
        setSettings(window.PIXIE_TRACE.normalize(settings));
        sync();
        schedule(updateFloatingTrace, 60);
      });
      control.addEventListener('change', () => {
        clearTimer(); updateFloatingTrace(); finishEdit();
      });
      control.addEventListener('blur', finishEdit);
    }
    sync();
    return { sync, clearTimer, schedule, clearHistory, flushHistory };
  }
  return { bind };
})();
