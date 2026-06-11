// Scene catalogue shared by the control window (to build the settings UI)
// and the display window (for default values). Implementations live in
// src/display/scenes/.
const SCENE_DEFS = [
  {
    id: 'classic',
    name: 'Classic Slideshow',
    emoji: '🖼️',
    blurb: 'Big fullscreen photos with smooth crossfades and a slow cinematic drift. Photos change in time with the music.',
    settings: [
      { key: 'drift', label: 'Camera drift', type: 'range', min: 0, max: 100, step: 5, default: 45 },
      { key: 'pulse', label: 'Beat pulse', type: 'range', min: 0, max: 100, step: 5, default: 50 },
      { key: 'flash', label: 'Soft flash on strong beats', type: 'toggle', default: true },
    ],
  },
  {
    id: 'polaroids',
    name: 'Polaroid Pile',
    emoji: '📸',
    blurb: 'Polaroid snapshots tumble onto the table and pile up, slowly covering the older ones.',
    settings: [
      { key: 'dropRate', label: 'Photo drop rate (per minute)', type: 'range', min: 2, max: 60, step: 1, default: 14 },
      { key: 'beatDrop', label: 'Extra drops on the beat', type: 'range', min: 0, max: 100, step: 5, default: 60 },
      { key: 'pileSize', label: 'Pile size', type: 'range', min: 8, max: 80, step: 1, default: 30 },
      { key: 'size', label: 'Polaroid size', type: 'range', min: 12, max: 42, step: 1, default: 24 },
    ],
  },
  {
    id: 'mosaic',
    name: 'Photo Wall',
    emoji: '🧩',
    blurb: 'A wall of photo tiles that flip over to reveal new pictures on every beat.',
    settings: [
      { key: 'columns', label: 'Columns', type: 'range', min: 3, max: 10, step: 1, default: 5 },
      { key: 'flips', label: 'Tiles flipped per beat', type: 'range', min: 1, max: 6, step: 1, default: 2 },
      { key: 'glow', label: 'Color pulse', type: 'range', min: 0, max: 100, step: 5, default: 45 },
    ],
  },
  {
    id: 'carousel',
    name: 'Carousel',
    emoji: '🎠',
    blurb: 'Photos circle slowly around the screen, each one swinging up front for its moment.',
    settings: [
      { key: 'count', label: 'Photos in the ring', type: 'range', min: 5, max: 14, step: 1, default: 8 },
      { key: 'speed', label: 'Spin speed', type: 'range', min: 5, max: 100, step: 5, default: 30 },
      { key: 'bounce', label: 'Beat bounce', type: 'range', min: 0, max: 100, step: 5, default: 50 },
    ],
  },
  {
    id: 'city',
    name: 'City Drive',
    emoji: '🌃',
    blurb: 'Cruise down a neon city street at night, where your photos light up the billboards.',
    settings: [
      { key: 'speed', label: 'Driving speed', type: 'range', min: 5, max: 100, step: 5, default: 40 },
      { key: 'density', label: 'Billboard density', type: 'range', min: 10, max: 100, step: 5, default: 55 },
      { key: 'neon', label: 'Neon glow', type: 'range', min: 0, max: 100, step: 5, default: 60 },
    ],
  },
  {
    id: 'drift',
    name: 'Floating Lights',
    emoji: '🎈',
    blurb: 'Photos float gently upward like lanterns, glowing softly in time with the music.',
    settings: [
      { key: 'count', label: 'Photos on screen', type: 'range', min: 3, max: 15, step: 1, default: 7 },
      { key: 'speed', label: 'Float speed', type: 'range', min: 5, max: 100, step: 5, default: 35 },
      { key: 'sparkle', label: 'Background sparkle', type: 'range', min: 0, max: 100, step: 5, default: 50 },
    ],
  },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCENE_DEFS };
} else {
  window.SCENE_DEFS = SCENE_DEFS;
}
