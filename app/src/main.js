import { drawCover, computePanels, panelIndexAt, PRESETS } from './cover.js';
import { runShot } from './shots.js';

const SAMPLES = ['neon-boulevard', 'palm-beach', 'neon-portrait', 'marina-run'];
const $ = (id) => document.getElementById(id);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const canvas = $('cover');
const ctx = canvas.getContext('2d');
const photos = [];
const views = new Map();
const pending = new Set();
const sampleLoads = new Map();
const uploadURLs = new Set();
const fxInputs = {
  grade: $('fxGrade'), grain: $('fxGrain'),
  halftone: $('fxHalftone'), vignette: $('fxVignette'),
};
const fx = Object.fromEntries(Object.entries(fxInputs).map(([key, input]) => [key, Number(input.value) / 100]));
let panelStates = [];
let layoutMode = 'auto';
let presetKey = 'sunset';
let size = { w: 1920, h: 1080 };
let selected = 0;
let frame = null;
let drag = null;

const fontsReady = document.fonts
  ? Promise.all([document.fonts.load('80px Anton'), document.fonts.load('40px "Archivo Black"')])
    .then(() => document.fonts.ready)
  : Promise.resolve();

/** Load a drawable image from a local URL or an object URL. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${url}`));
    img.src = url;
  });
}

function track(promise) {
  pending.add(promise);
  promise.then(() => pending.delete(promise), () => pending.delete(promise));
  return promise;
}

function reportError(error) {
  $('statusLine').textContent = error.message || 'Unable to load this photo.';
}

function autoFocus(img) {
  const fallback = { focusX: 0.5, focusY: 0.42 };
  const probe = document.createElement('canvas');
  probe.width = 72;
  probe.height = Math.max(1, Math.round(72 * img.naturalHeight / img.naturalWidth));
  const context = probe.getContext('2d', { willReadFrequently: true });
  try {
    context.drawImage(img, 0, 0, probe.width, probe.height);
    const height = Math.max(1, Math.floor(probe.height * 0.7));
    const { data } = context.getImageData(0, 0, probe.width, height);
    let matches = 0;
    let sumX = 0;
    let sumY = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < probe.width; x += 1) {
        const i = (y * probe.width + x) * 4;
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        if (r > 95 && g > 40 && b > 20 && r > g && r > b
          && Math.max(r, g, b) - Math.min(r, g, b) > 15) {
          matches += 1;
          sumX += x + 0.5;
          sumY += y + 0.5;
        }
      }
    }
    if (matches >= probe.width * height * 0.025) {
      return {
        focusX: clamp(sumX / matches / probe.width, 0.15, 0.85),
        focusY: clamp(sumY / matches / probe.height, 0.15, 0.85),
      };
    }
  } catch { /* Use the neutral focus if pixel sampling is unavailable. */ }
  return fallback;
}

function panelCount() {
  return layoutMode === 'auto'
    ? clamp(photos.length, 1, 4)
    : Math.min(layoutMode, Math.max(photos.length, 1));
}

// Each panel retains a separate view for every photo that has occupied it.
function panelView(index, photo) {
  const key = `${index}:${photo}`;
  if (!views.has(key)) {
    views.set(key, {
      photo, ...(photos[photo] ? autoFocus(photos[photo].img) : { focusX: 0.5, focusY: 0.42 }), zoom: 1,
    });
  }
  return views.get(key);
}

function rebuildPanels() {
  panelStates = Array.from({ length: panelCount() }, (_, i) => panelView(i, photos.length ? (i < photos.length ? i : 0) : -1));
  selected = clamp(selected, 0, panelStates.length - 1);
  syncSelection();
  render();
}

function addPhoto(img, name) {
  photos.push({ img, name });
  rebuildPanels();
  rebuildPhotoStrip();
  return photos.length - 1;
}

function selectPhoto(index) {
  let panel = panelStates.findIndex((state) => state.photo === index);
  if (panel < 0) {
    panel = selected;
    panelStates[panel] = panelView(panel, index);
  }
  selectPanel(panel);
}

function rebuildPhotoStrip() {
  $('photoStrip').replaceChildren(...photos.map(({ img, name }, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'photoItem';
    button.dataset.photo = String(index);
    button.title = name;
    button.setAttribute('aria-label', `Select ${name}`);
    const thumb = document.createElement('img');
    thumb.src = img.src;
    thumb.alt = name;
    button.append(thumb);
    button.addEventListener('click', () => selectPhoto(index));
    return button;
  }));
  syncSelection();
}

function syncSelection() {
  const state = panelStates[selected];
  $('panelLabel').textContent = `Panel ${selected + 1} selected`;
  $('panelZoom').value = Math.round((state?.zoom ?? 1) * 100);
  $('panelZoom').disabled = !photos[state?.photo];
  $('swapLeftBtn').disabled = selected === 0;
  $('swapRightBtn').disabled = selected === panelStates.length - 1;
  for (const id of ['focusBtn', 'resetPanelBtn']) $(id).disabled = !photos[state?.photo];
  document.querySelectorAll('.photoItem').forEach((button) => {
    const active = Number(button.dataset.photo) === state?.photo;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function selectPanel(index) {
  selected = clamp(index, 0, panelStates.length - 1);
  syncSelection();
  render();
}

function drawTo(target, w, h) {
  drawCover(target, {
    w, h, panels: computePanels(panelCount(), w, h),
    photos: panelStates.map((state) => photos[state.photo] ? { img: photos[state.photo].img, ...state } : null),
    preset: PRESETS[presetKey], title: $('titleInput').value, caption: $('captionInput').value, fx,
  });
}

function render() {
  if (frame !== null) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    drawTo(ctx, size.w, size.h);
  });
}

function activate(selector, attribute, value) {
  document.querySelectorAll(selector).forEach((button) => {
    const active = button.dataset[attribute] === String(value);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function setSize(w, h) {
  w = Number(w);
  h = Number(h);
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) return;
  size = { w, h };
  canvas.width = w;
  canvas.height = h;
  activate('#sizeSeg button[data-size]', 'size', `${w}x${h}`);
  render();
}

function setPreset(key) {
  if (!Object.hasOwn(PRESETS, key)) return;
  presetKey = key;
  activate('.presetBtn', 'preset', key);
  render();
}

function setLayout(mode) {
  mode = mode === 'auto' ? mode : Number(mode);
  if (mode !== 'auto' && (!Number.isInteger(mode) || mode < 1 || mode > 4)) return;
  layoutMode = mode;
  activate('.layoutBtn', 'layout', mode);
  rebuildPanels();
}

function setWords(title, caption) {
  if (title !== undefined) $('titleInput').value = title;
  if (caption !== undefined) $('captionInput').value = caption;
  render();
}

function setFx(partial) {
  for (const key of Object.keys(fxInputs)) {
    if (partial[key] !== undefined && Number.isFinite(Number(partial[key]))) {
      fx[key] = clamp(Number(partial[key]), 0, 1);
      fxInputs[key].value = fx[key] * 100;
    }
  }
  render();
}

function addSample(name) {
  if (!SAMPLES.includes(name)) return Promise.reject(new Error(`Unknown sample: ${name}`));
  if (sampleLoads.has(name)) return sampleLoads.get(name);
  const promise = track(loadImage(`samples/${name}.jpg`).then((img) => addPhoto(img, name)));
  sampleLoads.set(name, promise);
  promise.catch(() => sampleLoads.delete(name));
  return promise;
}

function loadSamples() {
  return track((async () => {
    // Commit in sample order so panel assignments are independent of decode timing.
    for (const name of SAMPLES) await addSample(name);
  })());
}

async function ready() {
  await fontsReady;
  while (pending.size) await Promise.all([...pending]);
}

function addFiles(files) {
  return track((async () => {
    for (const file of files) {
      if (file.type && !file.type.startsWith('image/')) continue;
      const url = URL.createObjectURL(file);
      try {
        addPhoto(await loadImage(url), file.name);
        uploadURLs.add(url);
      } catch (error) {
        URL.revokeObjectURL(url);
        reportError(error);
      }
    }
  })());
}

window.addEventListener('pagehide', (event) => {
  if (!event.persisted) uploadURLs.forEach((url) => URL.revokeObjectURL(url));
});

$('fileInput').addEventListener('change', (event) => {
  addFiles([...event.target.files]).catch(reportError);
  event.target.value = '';
});
$('dropZone').addEventListener('click', (event) => {
  if (event.target !== $('fileInput')) $('fileInput').click();
});
$('dropZone').addEventListener('keydown', (event) => {
  if (event.target === $('dropZone') && ['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    $('fileInput').click();
  }
});
let dragDepth = 0;
function highlightDrop(active) {
  $('dropZone').classList.toggle('drag', active);
  $('dropZone').classList.toggle('dragover', active);
}
$('dropZone').addEventListener('dragenter', (event) => {
  event.preventDefault();
  dragDepth += 1;
  highlightDrop(true);
});
$('dropZone').addEventListener('dragover', (event) => {
  event.preventDefault();
  highlightDrop(true);
});
$('dropZone').addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) highlightDrop(false);
});
$('dropZone').addEventListener('drop', (event) => {
  event.preventDefault();
  dragDepth = 0;
  highlightDrop(false);
  addFiles([...event.dataTransfer.files]).catch(reportError);
});
$('sampleBtn').addEventListener('click', () => loadSamples().catch(reportError));
document.querySelectorAll('.sampleThumb').forEach((button) => {
  button.addEventListener('click', () => addSample(button.dataset.sample).then(selectPhoto).catch(reportError));
});
for (const id of ['titleInput', 'captionInput']) $(id).addEventListener('input', render);
document.querySelectorAll('.presetBtn').forEach((button) => button.addEventListener('click', () => setPreset(button.dataset.preset)));
document.querySelectorAll('.layoutBtn').forEach((button) => button.addEventListener('click', () => setLayout(button.dataset.layout)));
document.querySelectorAll('#sizeSeg button[data-size]').forEach((button) => {
  button.addEventListener('click', () => setSize(...button.dataset.size.split('x').map(Number)));
});
for (const [key, input] of Object.entries(fxInputs)) {
  input.addEventListener('input', () => setFx({ [key]: Number(input.value) / 100 }));
}
function setZoom(zoom) {
  const state = panelStates[selected];
  if (!photos[state?.photo]) return;
  state.zoom = clamp(zoom, 1, 3.2);
  syncSelection();
  render();
}
$('panelZoom').addEventListener('input', (event) => setZoom(Number(event.target.value) / 100));
function refocus(resetZoom = false) {
  const state = panelStates[selected];
  if (!photos[state?.photo]) return;
  Object.assign(state, autoFocus(photos[state.photo].img));
  if (resetZoom) state.zoom = 1;
  syncSelection();
  render();
}
$('focusBtn').addEventListener('click', () => refocus());
$('resetPanelBtn').addEventListener('click', () => refocus(true));
function swap(direction) {
  const neighbour = selected + direction;
  if (neighbour < 0 || neighbour >= panelStates.length) return;
  const a = { ...panelStates[selected] };
  const b = { ...panelStates[neighbour] };
  panelStates[selected] = panelView(selected, b.photo);
  panelStates[neighbour] = panelView(neighbour, a.photo);
  Object.assign(panelStates[selected], b);
  Object.assign(panelStates[neighbour], a);
  selectPanel(neighbour);
}
$('swapLeftBtn').addEventListener('click', () => swap(-1));
$('swapRightBtn').addEventListener('click', () => swap(1));

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
}
canvas.style.cursor = 'grab';
canvas.style.touchAction = 'none';
canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || drag) return;
  const point = canvasPoint(event);
  const polygons = computePanels(panelCount(), size.w, size.h);
  const index = panelIndexAt(polygons, point.x, point.y);
  if (index < 0) return;
  selectPanel(index);
  if (!photos[panelStates[index].photo]) return;
  event.preventDefault();
  drag = { ...point, index, pointerId: event.pointerId, polygon: polygons[index] };
  canvas.setPointerCapture(event.pointerId);
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const point = canvasPoint(event);
  const state = panelStates[drag.index];
  const img = photos[state?.photo]?.img;
  if (!img) return;
  const xs = drag.polygon.map(([x]) => x);
  const ys = drag.polygon.map(([, y]) => y);
  const scale = Math.max((Math.max(...xs) - Math.min(...xs)) / img.naturalWidth,
    (Math.max(...ys) - Math.min(...ys)) / img.naturalHeight) * state.zoom;
  state.focusX = clamp(state.focusX - (point.x - drag.x) / (img.naturalWidth * scale), 0, 1);
  state.focusY = clamp(state.focusY - (point.y - drag.y) / (img.naturalHeight * scale), 0, 1);
  Object.assign(drag, point);
  render();
});
function endDrag(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  drag = null;
  canvas.style.cursor = 'grab';
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, endDrag);
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.h : 1;
  setZoom((panelStates[selected]?.zoom ?? 1) * Math.exp(-event.deltaY * unit * 0.001));
}, { passive: false });

function exportCanvas(w, h) {
  w = Number(w);
  h = Number(h);
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) throw new Error('Invalid export size.');
  const output = document.createElement('canvas');
  output.width = w;
  output.height = h;
  drawTo(output.getContext('2d'), w, h);
  return output;
}
document.querySelectorAll('.exportBtn').forEach((button) => {
  button.addEventListener('click', async () => {
    activate('.exportBtn', 'size', button.dataset.size);
    try {
      await ready();
      const [w, h] = button.dataset.size.split('x').map(Number);
      const blob = await new Promise((resolve, reject) => exportCanvas(w, h).toBlob(
        (result) => result ? resolve(result) : reject(new Error('Could not create PNG.')), 'image/png'));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vice-panels-${w}x${h}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      $('statusLine').textContent = `Saved vice-panels-${w}x${h}.png — ready to post`;
    } catch (error) { reportError(error); }
  });
});

function setShotState(partial) {
  if (partial.size) {
    const dimensions = typeof partial.size === 'string' ? partial.size.split('x') : [partial.size.w, partial.size.h];
    setSize(...dimensions);
  } else if (partial.w !== undefined && partial.h !== undefined) setSize(partial.w, partial.h);
  if (partial.presetKey !== undefined || partial.preset !== undefined) setPreset(partial.presetKey ?? partial.preset);
  if (partial.layoutMode !== undefined || partial.layout !== undefined) setLayout(partial.layoutMode ?? partial.layout);
  setWords(partial.title, partial.caption);
  if (partial.fx) setFx(partial.fx);
  if (Number.isInteger(partial.selected)) selectPanel(partial.selected);
  render();
}

rebuildPanels();
setSize(size.w, size.h);
$('statusLine').textContent = 'Tip: drag a panel to reposition its photo; scroll to zoom.';
fontsReady.then(render).catch(reportError);
const query = new URLSearchParams(location.search);
const boot = query.has('shot')
  ? runShot(query, { loadSamples, addSample, setSize, setPreset, setLayout, setWords, setFx, render, ready })
  : loadSamples().then(ready).then(render);
boot.catch(reportError);
window.VicePanels = {
  exportDataURL: (w, h) => exportCanvas(w, h).toDataURL('image/png'),
  loadSamples,
  setShotState,
  async whenReady() {
    await boot;
    await ready();
    render();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  },
};
