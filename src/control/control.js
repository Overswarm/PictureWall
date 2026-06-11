// PictureWall control window: everything the operator touches.
/* global SCENE_DEFS */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const els = {
    startShow: $('btn-start-show'),
    fullscreen: $('btn-fullscreen'),
    chooseFolder: $('btn-choose-folder'),
    folderPath: $('folder-path'),
    photoCount: $('photo-count'),
    prioritizeNew: $('opt-prioritize-new'),
    thumbs: $('thumbs'),
    addMusic: $('btn-add-music'),
    clearMusic: $('btn-clear-music'),
    playlist: $('playlist'),
    prev: $('btn-prev'),
    play: $('btn-play'),
    next: $('btn-next'),
    seek: $('seek'),
    time: $('time'),
    beatDot: $('beat-dot'),
    nowPlaying: $('now-playing'),
    bpm: $('bpm'),
    loop: $('opt-loop'),
    shuffle: $('opt-shuffle'),
    volume: $('volume'),
    volumeVal: $('volume-val'),
    sceneList: $('scene-list'),
    sceneSettings: $('scene-settings'),
    minSwitch: $('min-switch'),
    minSwitchVal: $('min-switch-val'),
    maxSwitch: $('max-switch'),
    maxSwitchVal: $('max-switch-val'),
    sensitivity: $('sensitivity'),
    sensitivityVal: $('sensitivity-val'),
    displayState: $('display-state'),
  };

  let state = null;
  let status = { playing: false, trackIndex: 0, trackName: null, position: 0, duration: 0 };
  let displayOpen = false;
  let seeking = false;

  // ----------------------------------------------------------- helpers ----

  function fmtTime(s) {
    if (!Number.isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${ss}`;
  }

  // Don't fight the user while they're dragging a slider.
  function setIfIdle(input, value) {
    if (document.activeElement !== input) input.value = value;
  }

  function sendSettings(partial) {
    window.pw.send('control:set-settings', partial);
  }

  // ------------------------------------------------------- scene picker ----

  const sceneTiles = new Map();

  function buildSceneList() {
    els.sceneList.innerHTML = '';
    for (const def of SCENE_DEFS) {
      const tile = document.createElement('div');
      tile.className = 'scene-tile';
      tile.innerHTML = `<div class="scene-emoji"></div><div class="scene-name"></div>`;
      tile.querySelector('.scene-emoji').textContent = def.emoji;
      tile.querySelector('.scene-name').textContent = def.name;
      tile.addEventListener('click', () => window.pw.send('control:set-scene', def.id));
      els.sceneList.appendChild(tile);
      sceneTiles.set(def.id, tile);
    }
  }

  let renderedSceneId = null;

  function sceneSettingValue(def, s) {
    const stored = state.sceneSettings && state.sceneSettings[def.id];
    const v = stored ? stored[s.key] : undefined;
    return v === undefined || v === null ? s.default : v;
  }

  function buildSceneSettings(def) {
    renderedSceneId = def.id;
    els.sceneSettings.innerHTML = '';
    const blurb = document.createElement('p');
    blurb.className = 'blurb';
    blurb.textContent = def.blurb;
    els.sceneSettings.appendChild(blurb);

    for (const s of def.settings) {
      if (s.type === 'toggle') {
        const label = document.createElement('label');
        label.className = 'check';
        label.style.marginTop = '10px';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!sceneSettingValue(def, s);
        input.addEventListener('change', () => {
          window.pw.send('control:set-scene-setting', { sceneId: def.id, key: s.key, value: input.checked });
        });
        label.appendChild(input);
        label.appendChild(document.createTextNode(' ' + s.label));
        els.sceneSettings.appendChild(label);
      } else {
        const row = document.createElement('div');
        row.className = 'slider-row';
        const label = document.createElement('label');
        label.textContent = s.label;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = s.min;
        input.max = s.max;
        input.step = s.step;
        input.value = sceneSettingValue(def, s);
        const val = document.createElement('span');
        val.className = 'mono dim';
        val.textContent = input.value;
        input.addEventListener('input', () => {
          val.textContent = input.value;
          window.pw.send('control:set-scene-setting', { sceneId: def.id, key: s.key, value: Number(input.value) });
        });
        input.dataset.key = s.key;
        row.appendChild(label);
        row.appendChild(input);
        row.appendChild(val);
        els.sceneSettings.appendChild(row);
      }
    }
  }

  function renderScene() {
    for (const [id, tile] of sceneTiles) {
      tile.classList.toggle('active', id === state.sceneId);
    }
    const def = SCENE_DEFS.find((d) => d.id === state.sceneId) || SCENE_DEFS[0];
    if (renderedSceneId !== def.id) buildSceneSettings(def);
  }

  // ------------------------------------------------------------ render ----

  function renderPlaylist() {
    els.playlist.innerHTML = '';
    if (!state.playlist.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.innerHTML = 'No songs yet — add one or more music files (.mp3, .wav, …).<br/>' +
        '<span class="dim">No music? The show still runs as a regular slideshow.</span>';
      els.playlist.appendChild(li);
      return;
    }
    state.playlist.forEach((t, i) => {
      const li = document.createElement('li');
      if (i === status.trackIndex && status.trackName) li.classList.add('active');
      const name = document.createElement('span');
      name.className = 'song-name';
      name.textContent = `${i + 1}. ${t.name}`;
      const rm = document.createElement('button');
      rm.className = 'remove';
      rm.title = 'Remove from list';
      rm.textContent = '✕';
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        window.pw.send('control:playlist', { action: 'remove', index: i });
      });
      li.addEventListener('dblclick', () => window.pw.send('control:playlist', { action: 'select', index: i }));
      li.title = 'Double-click to play this song';
      li.appendChild(name);
      li.appendChild(rm);
      els.playlist.appendChild(li);
    });
  }

  function renderState() {
    if (!state) return;
    const s = state.settings;
    els.folderPath.textContent = state.photoFolder || 'No folder chosen yet';
    els.folderPath.classList.toggle('dim', !state.photoFolder);
    els.prioritizeNew.checked = !!s.prioritizeNew;
    els.loop.checked = !!s.loopPlaylist;
    els.shuffle.checked = !!s.shufflePlaylist;
    setIfIdle(els.volume, s.volume);
    els.volumeVal.textContent = `${s.volume}%`;
    setIfIdle(els.minSwitch, s.minSwitchSec);
    els.minSwitchVal.textContent = `${s.minSwitchSec} s`;
    setIfIdle(els.maxSwitch, s.maxSwitchSec);
    els.maxSwitchVal.textContent = `${s.maxSwitchSec} s`;
    setIfIdle(els.sensitivity, s.beatSensitivity);
    els.sensitivityVal.textContent = s.beatSensitivity;
    renderScene();
    renderPlaylist();
  }

  function renderStatus() {
    els.play.textContent = status.playing ? '⏸' : '▶';
    if (!seeking) {
      els.seek.value = status.duration ? Math.round((status.position / status.duration) * 1000) : 0;
    }
    els.time.textContent = `${fmtTime(status.position)} / ${fmtTime(status.duration)}`;
    els.nowPlaying.textContent = status.trackName
      ? (status.playing ? '♪ ' : '⏸ ') + status.trackName
      : 'Nothing playing';
    renderPlaylist();
  }

  function renderDisplayState() {
    els.displayState.textContent = displayOpen ? 'Show window: open' : 'Show window: closed';
    els.fullscreen.disabled = !displayOpen;
    els.startShow.textContent = displayOpen ? '✓ Show is live' : '▶  Start show';
  }

  // ------------------------------------------------------------ thumbs ----

  const thumbUrls = [];

  async function renderThumbs(photos) {
    els.thumbs.innerHTML = '';
    while (thumbUrls.length) URL.revokeObjectURL(thumbUrls.pop());
    if (!photos.length) {
      const ph = document.createElement('span');
      ph.className = 'placeholder';
      ph.textContent = state && state.photoFolder
        ? 'No photos in this folder yet — drop some in!'
        : 'The newest photos will preview here.';
      els.thumbs.appendChild(ph);
      return;
    }
    const newest = [...photos].sort((a, b) => b.mtime - a.mtime).slice(0, 8);
    for (const p of newest) {
      try {
        const buf = await window.pw.invoke('media:read', p.path);
        const url = URL.createObjectURL(new Blob([buf]));
        thumbUrls.push(url);
        const img = document.createElement('img');
        img.src = url;
        els.thumbs.appendChild(img);
      } catch {
        /* file may have just been deleted */
      }
    }
  }

  let thumbTimer = null;
  function scheduleThumbs(photos) {
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(() => renderThumbs(photos), 250);
  }

  // ------------------------------------------------------------- wires ----

  els.startShow.addEventListener('click', () => window.pw.send('control:open-display'));
  els.fullscreen.addEventListener('click', () => window.pw.send('control:toggle-fullscreen'));

  els.chooseFolder.addEventListener('click', () => window.pw.invoke('dialog:choose-folder'));
  els.prioritizeNew.addEventListener('change', () => sendSettings({ prioritizeNew: els.prioritizeNew.checked }));

  els.addMusic.addEventListener('click', () => window.pw.invoke('dialog:add-music'));
  els.clearMusic.addEventListener('click', () => window.pw.send('control:playlist', { action: 'clear' }));

  els.play.addEventListener('click', () => window.pw.send('control:transport', { action: 'toggle' }));
  els.prev.addEventListener('click', () => window.pw.send('control:transport', { action: 'prev' }));
  els.next.addEventListener('click', () => window.pw.send('control:transport', { action: 'next' }));

  els.seek.addEventListener('input', () => { seeking = true; });
  els.seek.addEventListener('change', () => {
    seeking = false;
    window.pw.send('control:transport', { action: 'seek', value: Number(els.seek.value) / 1000 });
  });

  els.loop.addEventListener('change', () => sendSettings({ loopPlaylist: els.loop.checked }));
  els.shuffle.addEventListener('change', () => sendSettings({ shufflePlaylist: els.shuffle.checked }));

  els.volume.addEventListener('input', () => {
    els.volumeVal.textContent = `${els.volume.value}%`;
    sendSettings({ volume: Number(els.volume.value) });
  });

  els.minSwitch.addEventListener('input', () => {
    let min = Number(els.minSwitch.value);
    let max = Number(els.maxSwitch.value);
    if (max < min) {
      max = min;
      els.maxSwitch.value = max;
      els.maxSwitchVal.textContent = `${max} s`;
    }
    els.minSwitchVal.textContent = `${min} s`;
    sendSettings({ minSwitchSec: min, maxSwitchSec: max });
  });

  els.maxSwitch.addEventListener('input', () => {
    let min = Number(els.minSwitch.value);
    let max = Number(els.maxSwitch.value);
    if (min > max) {
      min = max;
      els.minSwitch.value = min;
      els.minSwitchVal.textContent = `${min} s`;
    }
    els.maxSwitchVal.textContent = `${max} s`;
    sendSettings({ minSwitchSec: min, maxSwitchSec: max });
  });

  els.sensitivity.addEventListener('input', () => {
    els.sensitivityVal.textContent = els.sensitivity.value;
    sendSettings({ beatSensitivity: Number(els.sensitivity.value) });
  });

  // ---------------------------------------------------------- IPC wires ----

  window.pw.on('state:update', (s) => {
    state = s;
    renderState();
  });

  window.pw.on('photos:update', ({ photos }) => {
    els.photoCount.textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'}`;
    scheduleThumbs(photos);
  });

  window.pw.on('status:update', (st) => {
    if (!st) return;
    status = st;
    renderStatus();
  });

  let beatFade = null;
  window.pw.on('meter:update', (m) => {
    if (!m) return;
    if (m.beat) {
      els.beatDot.style.opacity = String(0.35 + 0.65 * (m.beatStrength || 0.5));
      clearTimeout(beatFade);
      beatFade = setTimeout(() => { els.beatDot.style.opacity = '0.15'; }, 110);
    }
    if (m.bpm && m.playing) {
      els.bpm.textContent = `~${m.bpm} BPM`;
      els.bpm.classList.remove('hidden');
    } else if (!m.playing) {
      els.bpm.classList.add('hidden');
    }
  });

  window.pw.on('display:open-changed', ({ open }) => {
    displayOpen = open;
    renderDisplayState();
  });

  // -------------------------------------------------------------- boot ----

  (async function init() {
    buildSceneList();
    const { state: s, photos, displayOpen: open } = await window.pw.invoke('app:get-state');
    state = s;
    displayOpen = open;
    renderState();
    renderDisplayState();
    els.photoCount.textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'}`;
    scheduleThumbs(photos);
  })();
})();
