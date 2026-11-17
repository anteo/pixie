window.PIXIE_FILES = (() => {
  function create(tr) {
    function decodeReference(dataUrl) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(tr('Could not load reference image.')));
        image.src = dataUrl;
      });
    }
    function readReference(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(tr('Could not load reference image.')));
        reader.readAsDataURL(file);
      });
    }
    function download(name, data, type) {
      const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
      const link = document.createElement('a');
      link.href = url; link.download = name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function fileStem(name) {
      return name.replace(/\.(pixie|scr)$/i, '').replace(/-layers$/i, '') || 'screen';
    }
    function askName(title, initial, action = tr('Save')) {
      return new Promise(resolve => {
        const dialog = document.querySelector('#name-dialog');
        if (dialog.open) { resolve(null); return; }
        const input = document.querySelector('#name-input');
        const error = document.querySelector('#name-error');
        const accept = document.querySelector('#name-accept');
        const cancel = document.querySelector('#name-cancel');
        document.querySelector('#name-dialog-title').textContent = title;
        accept.textContent = action;
        input.value = initial;
        error.textContent = '';
        let done = false;
        function finish(value) {
          if (done) return;
          done = true;
          dialog.removeEventListener('close', onClose);
          input.removeEventListener('keydown', onKeydown);
          accept.onclick = cancel.onclick = null;
          if (dialog.open) dialog.close();
          resolve(value);
        }
        function onClose() { finish(null); }
        function onKeydown(event) {
          if (event.key === 'Enter') { event.preventDefault(); accept.click(); }
        }
        accept.onclick = () => {
          const value = input.value.trim();
          if (!value) { error.textContent = tr('Enter a name.'); input.focus(); return; }
          finish(value);
        };
        cancel.onclick = () => finish(null);
        dialog.addEventListener('close', onClose);
        input.addEventListener('keydown', onKeydown);
        dialog.showModal(); input.focus(); input.select();
      });
    }
    async function askFileName(kind, suggested, extension) {
      const answer = await askName(tr('{kind} file name', { kind }), suggested);
      if (answer === null) return null;
      return answer.toLowerCase().endsWith(extension) ? answer : answer + extension;
    }
    async function canWriteProject(handle) {
      if (!handle.queryPermission || !handle.requestPermission) return true;
      const permission = { mode: 'readwrite' };
      if (await handle.queryPermission(permission) === 'granted') return true;
      return await handle.requestPermission(permission) === 'granted';
    }
    return { download, fileStem, askName, askFileName, decodeReference, readReference, canWriteProject };
  }
  return { create };
})();
