/** Prepare a deterministic screenshot scene using the editor's real controls. */
export async function runShot(query, api) {
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query);
  window.__shotReady = false;
  const requested = Number(params.get('n') ?? 4);
  const count = Number.isFinite(requested) ? Math.max(0, Math.min(4, Math.trunc(requested))) : 4;
  const samples = ['neon-boulevard', 'palm-beach', 'neon-portrait', 'marina-run'];
  const dimensions = /^(\d+)x(\d+)$/.exec(params.get('size') ?? '1920x1080');
  if (dimensions) api.setSize(Number(dimensions[1]), Number(dimensions[2]));
  if (params.has('preset')) api.setPreset(params.get('preset'));
  if (params.has('layout')) api.setLayout(params.get('layout'));
  api.setWords(params.has('title') ? params.get('title') : undefined,
    params.has('caption') ? params.get('caption') : undefined);
  if (count === 4) await api.loadSamples();
  else for (const name of samples.slice(0, count)) await api.addSample(name);
  await api.ready();
  api.render();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
