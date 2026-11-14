# If this is home, welcome home.

*whnvr, for* Liminal Landing

A floating archipelago of temporary homes, performed live as a DJ set.
New York and Taiwan drift side by side, each in its own time of day, with
small islands between them: a bus stop, a subway entrance, a grove, a
lighthouse, a window standing on its own. Birds commute between them, a
baggage belt loops underneath, and paper houses float in the sky. Each song
gets its own camera, light and sky, and the world slowly comes apart and
returns as the night goes on.

Built with Three.js (vendored in `lib/`, so it runs offline), an
orthographic camera and procedural geometry only. No build step, no backend.

**→ The full guide is in [GUIDE.md](GUIDE.md):** every control, saving
views, streaming, recording, editing songs and a map of the files.

## Quick start

```bash
python serve.py          # macOS: python3 serve.py
```

1. Open http://localhost:8080/control.html and press *Open viewer*.
2. Put the viewer on its own screen and press **f** for fullscreen.
3. Use *◀ Prev* / *Next ▶* (or **←** / **→**) to move through the songs.

The controller and viewer must be in the same browser on the same computer.

## Live setup

We stream the viewer to YouTube with OBS, and the venue plays the stream on
its projector. Capture the viewer with **Window Capture**, untick **Capture
Cursor**, and keep the viewer window visible (not minimized). Details and a
pre-show checklist are in [GUIDE.md → Streaming](GUIDE.md#streaming-to-youtube-obs).

## Where things live

| To change | Edit |
| --- | --- |
| Songs: camera, time, sky, float, birds | `js/songs.js` (saved views go to `views.json`) |
| Camera presets | `js/presets.js` |
| Atmospheres, local times, defaults | `js/config.js` |
| What changed and when | [CHANGELOG.md](CHANGELOG.md) |
