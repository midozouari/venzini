# Demo video pipeline

`pnpm demo:video` makes the MVP demo video from [docs/demo-script.md](../../docs/demo-script.md), from start to finish:

1. **Voice-over.** One clip per scene from its "Narration", made with [edge-tts](https://github.com/rany2/edge-tts). The voice is Microsoft's neural voice **en-US-AndrewNeural** (calm and natural, male), 5% slower than its default. Each clip is measured, and clips are cached in `demo-output/audio/`, so only changed lines are spoken again.
2. **Recording.** Playwright drives the production preview build of the web app (mock API, port 4174) in Chromium at 1920×1080:
   - a visible cursor glides smoothly and shows a soft ripple on each click;
   - it pauses about 1 s after each click and types at a person's speed;
   - a small navy-and-cream title appears at the start of each scene;
   - each scene lasts at least as long as its narration.

   Frames are captured straight from Chromium's screencast, at high quality, for sharp text.

3. **Assembly.** ffmpeg turns the frames into a 30 fps picture and places each narration clip at its scene's start. It adds a 1 s fade in and out, and exports **H.264 1080p MP4**.

The result is `demo-output/venzini-demo.mp4`, with `demo-output/timeline.json` (scene start times and lengths). The `demo-output/` folder is ignored by Git.

## What you need

- **Python 3.8+ and edge-tts:** `pip install edge-tts`. The voice is made online by Microsoft's speech service, so this step needs internet access.
- **ffmpeg:** nothing to install. The `ffmpeg-static` package brings it with `pnpm install`.
- **Chromium for Playwright:** the same one the end-to-end tests use. Install it once with `pnpm --filter @venzini/e2e exec playwright install chromium`.
- Internet access for the map tiles (OpenStreetMap).

## Options

```bash
pnpm demo:video                 # everything: build, voice, recording, assembly
pnpm demo:video --skip-build    # reuse the last build of apps/web
pnpm demo:video --keep-frames   # keep the captured frames in demo-output/frames
```

## Changing the script

- The narration and the on-screen titles are read from `docs/demo-script.md`, so editing them there is enough.
- The robot's actions are in `src/scenes.ts`, one function per scene. If a scene is added, removed or renamed, the command stops and asks for `scenes.ts` to be updated.
- The voice and its speed are set at the top of `src/main.ts` (`VOICE`, `RATE`).

## Where the video differs from the written script

The real screens differ from a few written actions, so the robot does this instead:

- **Scene 7:** the drag of ST012 onto T-02 is a real drag. If the drop fails, the robot uses the script's own fallback, **Move to tanker…**.
- **Scene 8:** the plan is reset to optimal _before_ the quantity edit. This is so the scripted limit applies ("Enter 6,400 L or less"). The dialog's close button is **Back**, not "Cancel".
- **Scene 10:** the newest entry is the whole-plan approval. Its panel compares routes, stops and total litres.
- **Scene 11:** after logging out, the page reloads on the login screen, which starts a fresh session. This is needed because the resources of 03 Nov are locked once the plan is approved in scene 9. The save dialog's cancel button is **Keep editing**. T-06 is switched back off before the day changes, so no unsaved change is left behind.
- **The developer toolbar is never used** and never appears in the video.
