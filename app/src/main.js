'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const els = {
    canvas: document.getElementById('stageCanvas'),
    fileInput: document.getElementById('fileInput'),
    dropOverlay: document.getElementById('dropOverlay'),
    tray: document.getElementById('tray'),
    addPhotosBtn: document.getElementById('addPhotosBtn'),
    sampleBtn: document.getElementById('sampleBtn'),
    layoutBtns: Array.from(document.querySelectorAll('button[data-layout]')),
    presetBtns: Array.from(document.querySelectorAll('button[data-preset]')),
    titleInput: document.getElementById('titleInput'),
    captionInput: document.getElementById('captionInput'),
    sliders: {
      grade: document.getElementById('fxGrade'),
      grain: document.getElementById('fxGrain'),
      halftone: document.getElementById('fxHalftone'),
      vignette: document.getElementById('fxVignette'),
      shadow: document.getElementById('fxShadow')
    },
    sizeBtns: Array.from(document.querySelectorAll('button[data-size]')),
    exportBtn: document.getElementById('exportBtn'),
    focusBtn: document.getElementById('focusBtn'),
    swapPrev: document.getElementById('swapPrev'),
    swapNext: document.getElementById('swapNext'),
    panelInfo: document.getElementById('panelInfo'),
    hint: document.getElementById('hintText')
  };

  if (typeof window.VP?.createEditor !== 'function') {
    if (els.hint) els.hint.textContent = 'Editor VICE PANELS tidak tersedia.';
    return;
  }
  window.VP.createEditor(els);
});
