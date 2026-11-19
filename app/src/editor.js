import { drawPoster } from './poster.js';
import { panelPolygons, pointInPolygon, polygonBounds } from './panels.js';

const SAMPLE_PATHS = ['samples/neon-boulevard.jpg', 'samples/palm-beach.jpg', 'samples/neon-portrait.jpg', 'samples/marina-run.jpg'];
const MAX_PHOTOS = 6;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const defaultSlot = () => ({ dx: 0, dy: 0, zoom: 1 });
const photos = [];
const slots = [];
let layout = 'auto';
let preset = 'sunset';
let selected = 0;
let frame = null;
let drag = null;
let samplesPromise = null;
let pendingPhotos = 0;

const ids = [
  'fileInput', 'sampleBtn', 'exportBtn', 'exportBtn2', 'stageWrap',
  'stageCanvas', 'dropHint', 'photoList', 'photoCount', 'layoutSeg',
  'presetSeg', 'titleInput', 'captionInput', 'selectedLabel', 'autoFocusBtn',
  'fxGrade', 'fxGrain', 'fxHalftone', 'fxVignette', 'fxShadow', 'sizeSelect',
];
const elements = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
const canvas = elements.stageCanvas;
const sliders = ['fxGrade', 'fxGrain', 'fxHalftone', 'fxVignette', 'fxShadow'];
const fxNames = ['grade', 'grain', 'halftone', 'vignette', 'shadow'];

function panelCount() {
  return layout === 'auto' ? clamp(photos.length, 1, 4) : parseInt(layout, 10);
}

function buildView() {
  const fx = Object.fromEntries(sliders.map((id, i) => {
    const value = Number(elements[id]?.value ?? 0);
    return [fxNames[i], Number.isFinite(value) ? clamp(value, 0, 100) / 100 : 0];
  }));
  return {
    panels: Array.from({ length: panelCount() }, (_, i) => ({
      img: photos[i] ? photos[i].img : null,
      ...(slots[i] || defaultSlot()),
    })),
    preset,
    title: elements.titleInput?.value ?? '',
    caption: elements.captionInput?.value ?? '',
    fx,
  };
}

function exportSize() {
  const match = /^(\d+)x(\d+)$/.exec(elements.sizeSelect?.value ?? '1080x1080');
  if (!match || Number(match[1]) < 1 || Number(match[2]) < 1) return [1080, 1080];
  return [Number(match[1]), Number(match[2])];
}

function previewSize() {
  const [width, height] = exportSize();
  // Scale both dimensions together so even unusually narrow sizes keep their aspect.
  const scale = Math.max(920 / Math.max(width, height), 320 / Math.min(width, height));
  return [Math.round(width * scale), Math.round(height * scale)];
}

function render() {
  if (!canvas || frame !== null) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    const [width, height] = previewSize();
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) drawPoster(ctx, width, height, buildView());
  });
}

function updateSelection() {
  selected = clamp(selected, 0, panelCount() - 1);
  if (elements.selectedLabel) elements.selectedLabel.textContent = 'Panel ' + (selected + 1);
  if (elements.photoList) {
    Array.from(elements.photoList.children).forEach((row, i) => {
      row.classList.toggle('active', i === selected);
    });
  }
}

function refreshList() {
  if (elements.photoList) {
    elements.photoList.replaceChildren();
    photos.forEach((photo, i) => {
      const row = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = photo.name;
      row.append(name);
      const button = (text, label, disabled, action) => {
        const control = document.createElement('button');
        control.type = 'button';
        control.className = 'small';
        control.textContent = text;
        control.setAttribute('aria-label', label + ' ' + photo.name);
        control.disabled = disabled;
        control.addEventListener('click', event => {
          event.stopPropagation();
          action();
          refreshList();
          render();
        });
        row.append(control);
      };
      const move = target => {
        [photos[i], photos[target]] = [photos[target], photos[i]];
        [slots[i], slots[target]] = [slots[target], slots[i]];
        if (selected === i) selected = target;
        else if (selected === target) selected = i;
      };
      button('↑', 'Move up', i === 0, () => move(i - 1));
      button('↓', 'Move down', i === photos.length - 1, () => move(i + 1));
      button('×', 'Remove', false, () => {
        photos.splice(i, 1);
        slots.splice(i, 1);
        if (selected > i) selected -= 1;
      });
      row.addEventListener('click', () => {
        selected = clamp(i, 0, panelCount() - 1);
        updateSelection();
        render();
      });
      elements.photoList.append(row);
    });
  }
  if (elements.photoCount) elements.photoCount.textContent = photos.length + ' / 6 photos';
  if (elements.dropHint) elements.dropHint.hidden = photos.length > 0;
  updateSelection();
}

function addPhotoFiles(fileList) {
  for (const file of Array.from(fileList || [])) {
    if (!file.type?.startsWith('image/')) continue;
    if (photos.length + pendingPhotos >= MAX_PHOTOS) break;
    const img = new Image();
    const url = URL.createObjectURL(file);
    pendingPhotos += 1;
    const finish = loaded => {
      img.onload = img.onerror = null;
      pendingPhotos -= 1;
      URL.revokeObjectURL(url);
      if (loaded && photos.length < MAX_PHOTOS) {
        photos.push({ img, name: file.name });
        slots.push(defaultSlot());
        refreshList();
        render();
      }
    };
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
  }
}

function loadSamples() {
  if (samplesPromise) return samplesPromise;
  const jobs = SAMPLE_PATHS.map(path => {
    const name = path.split('/').pop();
    if (photos.some(photo => photo.name === name) || photos.length + pendingPhotos >= MAX_PHOTOS) {
      return Promise.resolve();
    }
    pendingPhotos += 1;
    return new Promise(resolve => {
      const img = new Image();
      const finish = loaded => {
        img.onload = img.onerror = null;
        pendingPhotos -= 1;
        if (loaded && photos.length < MAX_PHOTOS) {
          photos.push({ img, name });
          slots.push(defaultSlot());
        }
        resolve();
      };
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      img.src = path;
    });
  });
  samplesPromise = Promise.all(jobs).then(() => {
    refreshList();
    render();
  }).finally(() => { samplesPromise = null; });
  return samplesPromise;
}

function toCanvasCoords(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / (rect.width || 1),
    y: (event.clientY - rect.top) * canvas.height / (rect.height || 1),
  };
}

function autoFocus(i) {
  if (!photos[i] || i < 0 || i >= panelCount()) return;
  const img = photos[i].img;
  const probe = document.createElement('canvas');
  probe.width = probe.height = 48;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  let pixels;
  try {
    ctx.drawImage(img, 0, 0, 48, 48);
    pixels = ctx.getImageData(0, 0, 48, 48).data;
  } catch {
    return;
  }
  const luminance = index => pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
  let bestScore = -Infinity;
  let focusX = 0.5;
  let focusY = 0.5;
  for (let y = 0; y < 48; y += 1) {
    for (let x = 0; x < 48; x += 1) {
      const index = (y * 48 + x) * 4;
      const max = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]);
      const min = Math.min(pixels[index], pixels[index + 1], pixels[index + 2]);
      const saturation = max === 0 ? 0 : (max - min) / max;
      const light = luminance(index);
      const right = (y * 48 + Math.min(x + 1, 47)) * 4;
      const bottom = (Math.min(y + 1, 47) * 48 + x) * 4;
      const score = saturation + (Math.abs(light - luminance(right)) + Math.abs(light - luminance(bottom))) / 255;
      if (score > bestScore) {
        bestScore = score;
        focusX = (x + 0.5) / 48;
        focusY = (y + 0.5) / 48;
      }
    }
  }
  const [width, height] = previewSize();
  const box = polygonBounds(panelPolygons(panelCount(), width, height)[i]);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih || !box.w || !box.h) return;
  const slot = slots[i];
  const scale = Math.max(box.w / iw, box.h / ih) * slot.zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const limitX = Math.max(0, (dw - box.w) / (2 * box.w));
  const limitY = Math.max(0, (dh - box.h) / (2 * box.h));
  slot.dx = clamp((0.5 - focusX) * dw / box.w, -limitX, limitX);
  slot.dy = clamp((0.5 - focusY) * dh / box.h, -limitY, limitY);
  render();
}

function outputCanvas(width, height) {
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const ctx = output.getContext('2d');
  if (ctx) drawPoster(ctx, output.width, output.height, buildView());
  return output;
}

function doExport() {
  const [width, height] = exportSize();
  outputCanvas(width, height).toBlob(blob => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vice-panels-cover.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
}

function activeButton(container, key, value) {
  container?.querySelectorAll('button[data-' + key + ']').forEach(button => {
    button.classList.toggle('active', button.dataset[key] === value);
  });
}

function setPreset(value) {
  if (!['sunset', 'neon', 'miami'].includes(value)) return;
  preset = value;
  activeButton(elements.presetSeg, 'preset', preset);
  render();
}

function setLayout(value) {
  value = String(value);
  if (!['auto', '1', '2', '3', '4'].includes(value)) return;
  layout = value;
  drag = null;
  activeButton(elements.layoutSeg, 'layout', layout);
  updateSelection();
  render();
}

function init() {
  elements.fileInput?.addEventListener('change', () => {
    addPhotoFiles(elements.fileInput.files);
    elements.fileInput.value = '';
  });
  elements.sampleBtn?.addEventListener('click', () => { loadSamples(); });
  elements.exportBtn?.addEventListener('click', doExport);
  elements.exportBtn2?.addEventListener('click', doExport);
  elements.autoFocusBtn?.addEventListener('click', () => autoFocus(selected));
  elements.stageWrap?.addEventListener('dragover', event => event.preventDefault());
  elements.stageWrap?.addEventListener('drop', event => {
    event.preventDefault();
    addPhotoFiles(event.dataTransfer?.files);
  });
  for (const [id, key, setter] of [
    ['layoutSeg', 'layout', setLayout], ['presetSeg', 'preset', setPreset],
  ]) {
    elements[id]?.addEventListener('click', event => {
      const button = event.target.closest?.('button[data-' + key + ']');
      if (button && elements[id].contains(button)) setter(button.dataset[key]);
    });
  }
  for (const id of [...sliders, 'titleInput', 'captionInput']) {
    elements[id]?.addEventListener('input', render);
  }
  elements.sizeSelect?.addEventListener('change', () => { drag = null; render(); });
  if (canvas) {
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || drag) return;
      const point = toCanvasCoords(event);
      const polys = panelPolygons(panelCount(), canvas.width, canvas.height);
      const index = polys.findIndex(poly => pointInPolygon(point, poly));
      if (index < 0) return;
      selected = index;
      updateSelection();
      drag = { pointerId: event.pointerId, last: point };
      canvas.setPointerCapture(event.pointerId);
      render();
    });
    canvas.addEventListener('pointermove', event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const point = toCanvasCoords(event);
      const polys = panelPolygons(panelCount(), canvas.width, canvas.height);
      const box = polygonBounds(polys[selected]);
      const slot = slots[selected];
      if (slot && box.w > 0 && box.h > 0) {
        slot.dx = clamp(slot.dx + (point.x - drag.last.x) / box.w, -0.6, 0.6);
        slot.dy = clamp(slot.dy + (point.y - drag.last.y) / box.h, -0.6, 0.6);
        render();
      }
      drag.last = point;
    });
    const endDrag = event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('lostpointercapture', endDrag);
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      const slot = slots[selected];
      if (!slot) return;
      slot.zoom = clamp(slot.zoom * Math.exp(-event.deltaY * 0.0012), 0.2, 4);
      render();
    }, { passive: false });
    canvas.addEventListener('dblclick', () => autoFocus(selected));
  }

  const params = new URLSearchParams(location.search);
  setPreset(params.get('preset') ?? preset);
  setLayout(params.get('layout') ?? layout);
  for (const [param, id] of [['title', 'titleInput'], ['caption', 'captionInput']]) {
    if (params.has(param) && elements[id]) elements[id].value = params.get(param);
  }
  const size = params.get('size');
  if (elements.sizeSelect && Array.from(elements.sizeSelect.options).some(option => option.value === size)) {
    elements.sizeSelect.value = size;
  }
  if (params.has('fx')) {
    const parts = params.get('fx').split(',');
    const values = parts.map(Number);
    if (parts.length === 5 && parts.every(part => part.trim() !== '') && values.every(value => Number.isFinite(value) && value >= 0 && value <= 100)) {
      sliders.forEach((id, i) => { if (elements[id]) elements[id].value = String(values[i]); });
    }
  }
  window.__vice = {
    loadSamples,
    doExport,
    exportDataURL: (w, h, type, quality) => outputCanvas(w, h).toDataURL(type, quality),
    getState: () => ({ photos: photos.length, panelCount: panelCount(), preset, layout }),
    setPreset,
    setLayout,
  };
  refreshList();
  render();
  if (params.get('samples') === '1') loadSamples();
  window.__viceReady = true;
}

init();
