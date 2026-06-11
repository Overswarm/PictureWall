# 📸 PictureWall

**A music-reactive photo slideshow for big screens.** Point it at a folder of
photos, add some music, and put it on the biggest screen you can find. Photos
change and move **in time with the beat** — and any picture dropped into the
folder while the show is running appears on screen automatically.

Perfect for weddings, parties, reunions, school events, and photo booths:
set up a photo station where guests get their picture taken, copy the photos
into the folder, and watch them show up on the wall moments later.

---

## Quick start (Windows)

1. Install **Node.js** from [nodejs.org](https://nodejs.org) (the **LTS** version) if you don't have it.
2. Double-click **`RUN.bat`**.
   The first run downloads PictureWall's components (a few minutes); after that it starts instantly.
3. In the PictureWall window:
   - Click **Choose photo folder…** and pick a folder with pictures in it.
   - Click **Add music…** and pick one or more songs (`.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg`, …).
   - Pick a **Scene**.
   - Click **▶ Start show**, then press **F** on the show window for fullscreen.

That's it. Press **▶** in the Music section to start the tunes.

> 💡 **No music?** The show still works — photos just change on a steady timer
> instead of the beat.

## Using two screens

If a second display (TV, projector) is connected, the show window opens there
automatically and goes fullscreen. The control window stays on your main
screen, so you can change scenes and settings live during the event.

With a single screen, click **⛶ Fullscreen** (or press **F** on the show
window) once everything is set up.

## Adding photos during the event

Just copy new image files into the photo folder (or any subfolder) — from a
camera card, AirDrop'd files, a network share, anything. PictureWall notices
within a couple of seconds. With **"Show new photos right away"** enabled
(the default), fresh photos jump to the front of the line so whoever just
posed sees themselves on the wall right away.

Supported image types: JPG, PNG, GIF, WebP, BMP, AVIF.

## The scenes

| Scene | What it looks like |
|---|---|
| 🖼️ **Classic Slideshow** | Fullscreen photos with smooth crossfades and a slow cinematic drift. Pulses and flashes on the beat. |
| 📸 **Polaroid Pile** | Snapshots tumble onto the table and pile up, covering older ones. Has its own *photo drop rate*. |
| 🧩 **Photo Wall** | A grid of tiles that flip to new photos on every beat, with a color wash that rides the music. |
| 🎠 **Carousel** | Photos orbit the screen, each swinging up front for its moment. The front card bounces on the beat. |
| 🌃 **City Drive** | An endless night drive down a winding neon street — photos appear on billboards, angled roadside signs, and as murals on the buildings you pass. Speed rides the music. |
| 🎈 **Floating Lights** | Photos drift upward like glowing lanterns over a bokeh sky. |
| ❄️ **Snowfall** | Photos drift gently down through falling snow on a quiet winter night. |
| 📖 **Photo Book** | A big photo album lies open on the table, its pages turning to the music — each turn reveals new photos, front and back, like a real book. |
| 🚀 **Warp Speed** | Photos race toward you out of a streaking starfield, flying past on the beat. |

Every scene has its own settings (drop rate, columns, speed, glow, …), plus
global controls:

- **Photos stay at least / change within** — the minimum and maximum time a
  photo stays up. Between those two, photos change *on the beat*.
- **Always show the whole photo** — never crop a picture to fill the space;
  tall and extra-wide photos are framed by a soft blurred backdrop instead.
- **Beat sensitivity** — raise it if the show feels sleepy, lower it if it's
  too jumpy.

All settings are remembered between runs.

## Handy keys (on the show window)

| Key | Action |
|---|---|
| **F** or **F11** | Toggle fullscreen |
| **Esc** | Leave fullscreen |
| **Space** | Play / pause music |
| Double-click | Toggle fullscreen |

## Building a standalone .exe (optional)

If you want a single installer/portable exe so the event PC doesn't need
Node.js:

```bash
npm install
npm run dist
```

The installer and a portable `.exe` land in the `dist/` folder.

## Running from source (any OS)

```bash
npm install
npm start
```

Works on Windows, macOS, and Linux.

## Tips for events

- Use a wired connection between laptop and screen; fullscreen video over
  flaky wireless HDMI can stutter.
- Turn off notifications / sleep mode on the PC running the show.
- Photos straight from phones can be huge — that's fine, PictureWall
  downsizes them in memory automatically.
- The folder is watched recursively, so you can give each photographer their
  own subfolder.
