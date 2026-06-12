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
    id: 'fireworks',
    name: 'Fireworks',
    emoji: '🎆',
    blurb: 'Rockets climb into the night sky and explode into showers of sparks — and every burst blooms into one of your photos.',
    settings: [
      { key: 'launchRate', label: 'Fireworks per minute', type: 'range', min: 4, max: 40, step: 1, default: 14 },
      { key: 'size', label: 'Photo size', type: 'range', min: 20, max: 60, step: 2, default: 38 },
      { key: 'sparks', label: 'Spark intensity', type: 'range', min: 0, max: 100, step: 5, default: 70 },
    ],
  },
  {
    id: 'snow',
    name: 'Snowfall',
    emoji: '❄️',
    blurb: 'Photos drift gently down through falling snow on a quiet winter night.',
    settings: [
      { key: 'count', label: 'Photos on screen', type: 'range', min: 3, max: 15, step: 1, default: 7 },
      { key: 'speed', label: 'Fall speed', type: 'range', min: 5, max: 100, step: 5, default: 35 },
      { key: 'snow', label: 'Snow amount', type: 'range', min: 0, max: 100, step: 5, default: 60 },
    ],
  },
  {
    id: 'book',
    name: 'Photo Book',
    emoji: '📖',
    blurb: 'A big photo album lies open on the table, turning its pages in time with the music.',
    settings: [
      { key: 'size', label: 'Book size', type: 'range', min: 40, max: 90, step: 5, default: 65 },
      { key: 'turnSpeed', label: 'Page turn speed', type: 'range', min: 0, max: 100, step: 5, default: 50 },
    ],
  },
  {
    id: 'warp',
    name: 'Warp Speed',
    emoji: '🚀',
    blurb: 'Photos race toward you out of a streaking starfield, flying past on the beat.',
    settings: [
      { key: 'count', label: 'Photos on screen', type: 'range', min: 4, max: 16, step: 1, default: 8 },
      { key: 'speed', label: 'Fly speed', type: 'range', min: 5, max: 100, step: 5, default: 40 },
      { key: 'streaks', label: 'Star streaks', type: 'range', min: 0, max: 100, step: 5, default: 60 },
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
