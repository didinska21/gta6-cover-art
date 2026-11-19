(function () {
  'use strict';

  const VP = window.VP = window.VP || {};
  const MAX_PHOTOS = 6;
  const SAMPLE_PATHS = [
    'samples/neon-boulevard.jpg',
    'samples/palm-beach.jpg',
    'samples/neon-portrait.jpg',
    'samples/marina-run.jpg'
  ];
  const FALLBACK_ACCENTS = { sunset: '#ffad66', neon: '#ff57cc', miami: '#58f1df' };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function containsPoint(polygon, x, y) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [ax, ay] = polygon[i];
      const [bx, by] = polygon[j];
      if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) {
        inside = !inside;
      }
    }
    return inside;
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  VP.createEditor = function (els) {
    function reportError(error) {
      if (els?.hint) els.hint.textContent = `Terjadi kesalahan: ${error?.message || error}`;
    }

    try {
      const { canvas, tray, hint } = els;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Kanvas pratinjau tidak tersedia.');

      const photos = [];
      const panelList = [];
      const photoUrls = new Set();
      let intake = { pending: 0 };
      let layoutMode = 'auto';
      let selected = 0;
      let preset = 'sunset';
      let title = 'VICE PANELS';
      let caption = 'Satu kota, sejuta cerita';
      const fx = { grade: 0.55, grain: 0.35, halftone: 0.25, vignette: 0.55, shadow: 0.7 };
      let exportSize = { w: 1920, h: 1080 };
      let framePending = false;
      let drag = null;

      // Keep failures in deferred work on the same status line as init failures.
      function guarded(fn) {
        return (...args) => {
          try {
            const result = fn(...args);
            if (typeof result?.catch === 'function') result.catch(reportError);
          } catch (error) {
            reportError(error);
          }
        };
      }

      function listen(target, type, fn, options) {
        target.addEventListener(type, guarded(fn), options);
      }

      function posterState() {
        return { photos: photos.map(function (p) { return p.img; }), panels: panelList, preset, title, caption, fx };
      }

      function scheduleRender() {
        if (framePending) return;
        framePending = true;
        window.requestAnimationFrame(guarded(() => {
          framePending = false;
          const { w, h } = exportSize;
          const scale = Math.min(920 / w, 920 / h);
          const width = Math.round(w * scale);
          const height = Math.round(h * scale);
          if (canvas.width !== width) canvas.width = width;
          if (canvas.height !== height) canvas.height = height;

          ctx.save();
          try {
            VP.drawPoster(ctx, width, height, posterState());
          } finally {
            ctx.restore();
          }

          const polygon = VP.panelPolygons(panelList.length, width, height)[selected];
          if (!polygon || !polygon.length) return;
          ctx.save();
          try {
            ctx.beginPath();
            ctx.moveTo(...polygon[0]);
            polygon.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
            ctx.closePath();
            ctx.strokeStyle = VP.PRESETS[preset]?.accent || FALLBACK_ACCENTS[preset];
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 7]);
            ctx.stroke();
          } finally {
            ctx.restore();
          }
        }));
      }

      function refreshSelection() {
        const panel = panelList[selected];
        els.panelInfo.textContent = panel
          ? `Panel ${selected + 1} dari ${panelList.length} · Foto ${panel.photo + 1}`
          : 'Belum ada panel';
        tray.querySelectorAll('.thumb').forEach((thumb, index) => {
          thumb.classList.toggle('active', !!panel && panel.photo === index);
        });
        scheduleRender();
      }

      function rebuildPanels() {
        const photoCount = Math.max(photos.length, 1);
        const count = layoutMode === 'auto' ? Math.min(photoCount, 4) : Number(layoutMode);
        if (count !== panelList.length) endDrag();
        if (panelList.length > count) panelList.length = count;
        while (panelList.length < count) {
          panelList.push({ photo: panelList.length % photoCount, zoom: 1.12, ox: 0, oy: -0.25 });
        }
        panelList.forEach((panel) => { panel.photo = clamp(panel.photo, 0, photoCount - 1); });
        selected = clamp(selected, 0, count - 1);
      }

      function rebuildTray() {
        tray.textContent = '';
        if (!photos.length) {
          const empty = document.createElement('p');
          empty.className = 'empty';
          empty.textContent = 'Belum ada foto — klik Contoh atau tambahkan foto.';
          tray.appendChild(empty);
          return;
        }

        photos.forEach(({ img, name }, index) => {
          const thumb = document.createElement('button');
          thumb.className = 'thumb';
          thumb.type = 'button';
          const picture = document.createElement('img');
          picture.src = img.src;
          picture.alt = name;
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.textContent = String(index + 1);
          thumb.append(picture, badge);
          listen(thumb, 'click', () => {
            const panel = panelList[selected];
            if (!panel) return;
            panel.photo = index;
            refreshSelection();
          });
          tray.appendChild(thumb);
        });
      }

      function refreshPhotos() {
        rebuildPanels();
        rebuildTray();
        refreshSelection();
      }

      // Reserve slots while images load, and discard results from replaced batches.
      async function loadBatch(entries, batch) {
        let remaining = entries.length;
        batch.pending += remaining;
        let loaded = 0;
        try {
          for (const { file, path, name } of entries) {
            if (batch !== intake) break;
            const url = file ? URL.createObjectURL(file) : path;
            try {
              const img = await loadImage(url);
              if (!img || batch !== intake) continue;
              photos.push({ img, name });
              if (file) photoUrls.add(url);
              loaded += 1;
              refreshPhotos();
            } finally {
              remaining -= 1;
              batch.pending -= 1;
              if (file && !photoUrls.has(url)) URL.revokeObjectURL(url);
            }
          }
          return loaded;
        } finally {
          batch.pending -= remaining;
        }
      }

      async function addFiles(files) {
        if (!files.length) return;
        const batch = intake;
        const available = Math.max(0, MAX_PHOTOS - photos.length - batch.pending);
        const entries = files.slice(0, available).map((file) => ({ file, name: file.name }));
        const ignored = files.length - entries.length;
        const limitMessage = ignored ? ` ${ignored} foto tambahan diabaikan (maksimal ${MAX_PHOTOS}).` : '';
        if (ignored) hint.textContent = limitMessage.trim();
        const loaded = await loadBatch(entries, batch);
        if (batch === intake) hint.textContent = `${loaded} foto dimuat.${limitMessage}`;
      }

      async function loadSamples() {
        const batch = intake = { pending: 0 };
        photoUrls.forEach((url) => URL.revokeObjectURL(url));
        photoUrls.clear();
        photos.length = 0;
        refreshPhotos();

        const entries = SAMPLE_PATHS.map((path) => ({ path, name: path.split('/').pop() }));
        const loaded = await loadBatch(entries, batch);
        if (batch !== intake) return;
        layoutMode = 'auto';
        title = els.titleInput.value = 'VICE PANELS';
        caption = els.captionInput.value = 'Matahari terbenam, neon menyala';
        setActive(els.layoutBtns, 'layout', layoutMode);
        rebuildPanels();
        refreshSelection();
        hint.textContent = `${loaded} foto contoh dimuat.`;
      }

      function canvasPoint(event) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        return {
          x: (event.clientX - rect.left) * canvas.width / rect.width,
          y: (event.clientY - rect.top) * canvas.height / rect.height
        };
      }

      function startDrag(event) {
        if (drag || event.button !== 0) return;
        const point = canvasPoint(event);
        if (!point) return;
        const polygons = VP.panelPolygons(panelList.length, canvas.width, canvas.height);
        const index = polygons.findIndex((polygon) => containsPoint(polygon, point.x, point.y));
        if (index < 0) return;

        selected = index;
        const panel = panelList[index];
        const xs = polygons[index].map(([x]) => x);
        const ys = polygons[index].map(([, y]) => y);
        drag = {
          id: event.pointerId, point, panel, ox: panel.ox, oy: panel.oy,
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys)
        };
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = 'grabbing';
        refreshSelection();
      }

      function moveDrag(event) {
        if (!drag || event.pointerId !== drag.id) return;
        const point = canvasPoint(event);
        if (!point) return;
        const dx = point.x - drag.point.x;
        const dy = point.y - drag.point.y;
        if (drag.width) drag.panel.ox = clamp(drag.ox + dx / (drag.width * 0.5), -1, 1);
        if (drag.height) drag.panel.oy = clamp(drag.oy + dy / (drag.height * 0.5), -1, 1);
        scheduleRender();
      }

      function endDrag(event) {
        if (!drag || (event && event.pointerId !== drag.id)) return;
        const { id } = drag;
        drag = null;
        if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
        canvas.style.cursor = 'grab';
      }

      function swapPhoto(direction) {
        const count = panelList.length;
        if (count < 2) return;
        const panel = panelList[selected];
        const neighbour = panelList[(selected + direction + count) % count];
        [panel.photo, neighbour.photo] = [neighbour.photo, panel.photo];
        refreshSelection();
      }

      function setActive(buttons, key, value) {
        buttons.forEach((button) => button.classList.toggle('active', button.dataset[key] === value));
      }

      function bindButtons(buttons, key, initial, update) {
        setActive(buttons, key, initial);
        buttons.forEach((button) => listen(button, 'click', () => {
          const value = button.dataset[key];
          update(value);
          setActive(buttons, key, value);
        }));
      }

      function exportPoster() {
        const { w, h } = exportSize;
        const size = `${w}x${h}`;
        const output = document.createElement('canvas');
        output.width = w;
        output.height = h;
        const outputContext = output.getContext('2d');
        if (!outputContext) throw new Error('Kanvas ekspor tidak tersedia.');
        VP.drawPoster(outputContext, w, h, posterState());

        output.toBlob(guarded((blob) => {
          if (!blob) throw new Error('PNG tidak dapat dibuat.');
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          try {
            link.href = url;
            link.download = `vice-panels-${size}.png`;
            document.body.appendChild(link);
            link.click();
            hint.textContent = `PNG tersimpan: ${size}`;
          } finally {
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 0);
          }
        }), 'image/png');
      }

      listen(els.addPhotosBtn, 'click', () => { els.fileInput.click(); });
      listen(els.fileInput, 'change', () => {
        const files = Array.from(els.fileInput.files || []);
        els.fileInput.value = '';
        return addFiles(files);
      });
      listen(window, 'dragover', (event) => {
        event.preventDefault();
        els.dropOverlay.classList.add('show');
      });
      listen(window, 'dragleave', () => els.dropOverlay.classList.remove('show'));
      listen(window, 'drop', (event) => {
        event.preventDefault();
        els.dropOverlay.classList.remove('show');
        return addFiles(Array.from(event.dataTransfer?.files || []));
      });
      listen(els.sampleBtn, 'click', loadSamples);

      canvas.style.cursor = 'grab';
      canvas.style.touchAction = 'none';
      listen(canvas, 'pointerdown', startDrag);
      listen(canvas, 'pointermove', moveDrag);
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => listen(canvas, type, endDrag));
      listen(canvas, 'wheel', (event) => {
        event.preventDefault();
        const panel = panelList[selected];
        if (!panel) return;
        panel.zoom = clamp(panel.zoom * (event.deltaY < 0 ? 1.07 : 0.93), 1, 3.2);
        scheduleRender();
      }, { passive: false });

      listen(els.focusBtn, 'click', () => {
        const panel = panelList[selected];
        if (!panel) return;
        Object.assign(panel, { zoom: 1.18, ox: 0, oy: -0.28 });
        scheduleRender();
      });
      listen(els.swapPrev, 'click', () => swapPhoto(-1));
      listen(els.swapNext, 'click', () => swapPhoto(1));

      bindButtons(els.layoutBtns, 'layout', layoutMode, (value) => {
        layoutMode = value;
        rebuildPanels();
        refreshSelection();
      });
      bindButtons(els.presetBtns, 'preset', preset, (value) => {
        preset = value;
        scheduleRender();
      });
      bindButtons(els.sizeBtns, 'size', `${exportSize.w}x${exportSize.h}`, (value) => {
        const [w, h] = value.split('x').map(Number);
        endDrag();
        exportSize = { w, h };
        scheduleRender();
      });

      els.titleInput.value = title;
      els.captionInput.value = caption;
      listen(els.titleInput, 'input', () => {
        title = els.titleInput.value;
        scheduleRender();
      });
      listen(els.captionInput, 'input', () => {
        caption = els.captionInput.value;
        scheduleRender();
      });
      Object.keys(fx).forEach((key) => {
        const slider = els.sliders[key];
        slider.value = Math.round(fx[key] * 100);
        listen(slider, 'input', () => {
          fx[key] = clamp(Number(slider.value) / 100, 0, 1);
          scheduleRender();
        });
      });
      listen(els.exportBtn, 'click', exportPoster);

      refreshPhotos();
      return { scheduleRender: guarded(scheduleRender) };
    } catch (error) {
      reportError(error);
      return {};
    }
  };
}());
