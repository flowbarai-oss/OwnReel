# OwnReel

**From an idea to an editable movie — on your own host.**

A self-hosted creative studio with integrated image/video creation, editable smart-movie storyboards, a multi-track editor, voice, subtitles and real MP4 export. English and Chinese interfaces. No FlowBar account, subscription, wallet or cloud moderation service is required.

> V0.1.0 is an early community release for a single local owner. See [verified scope and limitations](docs/community/VERIFICATION.md) and the repository's current Actions status before installing. It is not a public multi-tenant hosting platform.

[中文指南](docs/community/README.zh-CN.md) · [Operations](docs/community/OPERATIONS.md) · [Security](SECURITY.md) · [Capabilities](docs/community/CAPABILITY-MATRIX.md)

## What you can make

- **Integrated creation:** generate an image, select that saved asset for image-to-video, add the result to a project, edit and export without downloading and re-uploading between steps.
- **Smart movie:** product ads, feature stories and social shorts. Generate or manually write a three-scene storyboard; edit each scene, choose/generate its visual and narration, build an editable timeline.
- **Video editor:** trim, split, reorder, multiple tracks, text/captions, SRT import/export, music and volume, basic transitions, undo/redo and persistent timeline versions.
- **Private library:** upload or generate media; preserve it across browser restarts. Deleting a project keeps media. Referenced assets cannot be removed accidentally.
- **Local export:** 720p/1080p, landscape/portrait, H.264/AAC MP4 using FFmpeg. Export dimensions do not improve the native detail of low-resolution sources.

With no provider key, upload your own media and produce a real movie. With your own **fal** key, the current adapters support Gemini Flash Lite scripts, FLUX Schnell images, Wan 2.2 text/image-to-video and MiniMax English/Chinese narration. This is not a promise that every model in the hosted professional edition is included.

## Quick start (Docker)

Requirements: Docker Engine with Compose v2+, Node.js 22+ for the initialization helper; recommended 4 CPU cores, 8 GB RAM and 10 GB free disk. CPU rendering time depends on duration, effects and resolution. A GPU is not required for local composition; paid generation runs at the provider.

```sh
git clone https://github.com/flowbarai-oss/OwnReel.git
cd OwnReel
node scripts/community-init.mjs
docker compose --env-file .env -f deploy/community/compose.yaml up --build -d
docker compose --env-file .env -f deploy/community/compose.yaml exec api cat /data/bootstrap-token
```

Open **http://localhost:4420**. Use the one-time token to create a local username and a password of at least 12 characters, then sign in. The token expires after 30 minutes; restarting the API issues a fresh token if setup is incomplete. Do not publish it.

The application binds only to `127.0.0.1`. For a remote host, use an SSH tunnel (`ssh -L 4420:127.0.0.1:4420 your-host`) and open the same localhost URL. Do not simply expose the port to the internet. A shared public service needs HTTPS, access controls, resource quotas, monitoring and an operational security review beyond this local single-owner edition.

## Your first movie (no API key)

Need original test material? Run `node scripts/create-samples.mjs` after `npm ci`. It creates an original geometric product image, a simple synthesized audio tone and bilingual subtitle/narration text in `data/samples`. These are clearly labeled non-AI examples; record your own narration or use optional paid TTS.

1. **Projects → Create project**.
2. **Assets → Upload media** (PNG/JPEG/WebP, MP4/WebM, MP3/WAV; 100 MB/file).
3. **Smart movie → Use manual template**. Choose assets for each scene, edit text/duration and save. This template is explicitly non-AI.
4. **Build editable timeline → Open editor**. Add music or adjust clips/captions.
5. **Export → Render locally**. Download the finished MP4; it is also saved in Assets.

For AI generation, set your fal key in **Settings**. Review the provider’s current rates and acknowledge billing before each submission. Charges go directly to your provider account, not FlowBar credits. Unknown prices are not displayed as free; retries may cost more. Existing media remains usable if you remove the key. Export and uploaded-media editing do not call paid models.

Jobs survive closing the browser. A failed job is not success. An uncertain submission is held for reconciliation rather than automatically submitted twice. See [recovery](docs/community/OPERATIONS.md).

## Development and checks

```sh
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm run test:all
npm run audit:secrets
npm run audit:licenses
npm run build:all
npm run test:community:e2e
```

Install FFmpeg and ffprobe on PATH (or set `FFMPEG_PATH` / `FFPROBE_PATH`). Native development may set `COMMUNITY_DEV_DB=1` and run `npm run dev:api` plus `npm run dev`; this uses a persistent PGlite development database and is explicitly rejected in production. Docker uses PostgreSQL. Paid tests are opt-in and never run in ordinary CI.

## Architecture and boundaries

Next.js/React studio → same-origin Fastify API → PostgreSQL documents/durable job queue → server-side provider adapters or local FFmpeg worker. Media and encrypted credentials stay on the host; provider requests necessarily send the submitted prompt/reference content to fal. The master encryption key lives in the media data volume, so back up that volume together with PostgreSQL.

Single local owner in V1; no public registration, wallet, reward gallery, social-network OAuth publishing or provider-hosting service. Downloaded videos can be uploaded to your platform yourself. The [optional hosted studio](https://gen.flowbarai.com) is a separate product with its own accounts and pricing; community features are not Star-gated or subscription-gated.

## License and contribution

MIT for this project’s source; original notices are retained. [NOTICE](NOTICE) and [third-party notices](docs/community/THIRD-PARTY.md) explain dependencies, FFmpeg and trademarks. Bring media you are authorized to use. No production user media, credentials, databases or private Git history are included.

Useful feedback, reproducible issues and contributions are welcome. If the project helps you make something, a GitHub Star is appreciated — never required. See [CONTRIBUTING](CONTRIBUTING.md).
