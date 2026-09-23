# V1 acceptance evidence

Verification date: 2026-09-20 (author self-review); independent re-verification on 2026-09-22 (E16). Neither is an independent security certification. This records tested cases, not a guarantee of defect-free software.

| Gate | Evidence |
|---|---|
| E01 clean install | Fresh Linux Docker/Compose project with PostgreSQL 16; local account, original PNG upload, actual 720p H.264/AAC render. No provider configured for generation. |
| E02 integrated creation | Real browser journey: FLUX image → that owned image in Wan image-to-video → project → editor → MP4 → playback and seek. No manual re-upload. |
| E03 English product story | Real three-scene script, generated image/video, English female narration, captions and original synthesized audio mixed into a 15-second portrait MP4. Re-edited and exported through the UI. |
| E04 Chinese feature story | Real Chinese script and three Chinese voice clips; landscape MP4, Chinese captions visually inspected; re-edited/exported through UI. |
| E05 social story | Real social-template script; previously generated image, text-to-video and image-to-video assets plus uploaded original audio; source assets retained in project. |
| E06 scene-specific retry | Failed third-scene queue test preserves the first two results; retry creates only the explicitly requested new job. |
| E07 uncertain submission | Fault injection preserves reconciliation state and durable receipt; one real ambiguous TTS outcome was checked against provider history before a deliberate separate retry. No blind automatic paid resubmission. |
| E08 restart | Durable receipt/lease tests; Docker API restart preserves project and identical media digest. |
| E09 rejected input | Auth/key/cost/resolution server tests; bilingual settings/balance/access guidance; unsupported 4K submission rejected without a queued job. |
| E10 longer narration | Timeline tests and actual UI export reject silent truncation; explicitly extending a one-second still-image scene preserves its longer real voice and matching caption duration. |
| E11 storage/export failure | Injected insufficient space rejects before temporary output/asset registration; real 720p/1080p landscape and portrait export tests; terminal errors are not success. |
| E12 references | Browser duplicate/delete flow retains assets; server prevents deleting project- or active-job-referenced assets. |
| E13 restore | Independent PostgreSQL/media volumes restored from stopped-writer backup; local login, project references, exact MP4 hash and decryption of an inert test-provider setting verified. No real provider key was copied to the acceptance server. |
| E14 isolation/security | Owner scoping, CSRF origin, hashed sessions, media sniffing, bounded size, private files, provider URL allowlists, FFmpeg file/pipe protocol restriction, secret/history scan. |
| E15 UI | EN/ZH navigation at 1440×900, 1280×720 and 390×844; storyboard persistence, native-dialog Escape, real export preview/seek. Editor 125% CSS-zoom proxy and mobile export/download checked; Chinese editor/mobile dialog checked separately. OS-level display scaling was not tested. |
| E16 independent low-spec re-verification | Re-verified on 2026-09-22 on modest, independent hardware (2 vCPU, ~4 GB RAM, mechanical disk) unrelated to the original author's environment: clean `docker compose build`/`up`, full setup/login/upload/storyboard/editor cycle with a real FFmpeg export, then a container restart preserving the same project and an identical export file hash. |

## Reproduce free checks

Install Node 22+, FFmpeg/ffprobe and run the commands in README. `npm run test:community:e2e` starts isolated temporary local services/data. Paid provider tests skip in ordinary CI; never add a real API key to GitHub test artifacts.

`scripts/container-smoke.mjs` is guarded by `COMMUNITY_ACCEPTANCE=1` and intended only for a new, isolated acceptance installation. It creates a test owner and original test media. It must never be run against somebody's existing installation. `--verify` checks previously recorded private results after restart/restore.

Paid generation evidence, provider request IDs, local test accounts, raw traces, DB dumps and master keys stay outside the public repository. Public source contains only test logic and redacted outcome summaries. Conservative paid-test reservation is US$4.40 within an explicitly approved US$10 cap; this is not a reconciled provider invoice.

## Scope limits

- Single local owner; not multi-tenant public hosting. Bind loopback and use an SSH tunnel for remote access.
- CPU rendering, 100 MB media limit, 32 timeline clips. Large effects and long projects depend on hardware.
- No automatic speech transcription, AI music generation, or social OAuth publishing in V1. SRT import/manual captions, uploaded music and downloadable MP4 are supported.
- Saved drafts/media persist. Save storyboard edits before switching modules; changing an unsaved draft is not a cloud autosave promise.
- Rapid testing/multiple tabs can hit the existing per-IP limit; wait and retry. An uncertain paid submission must be reconciled, never blindly repeated.
- No public binary container image. Docker builds from source locally; binary redistribution needs its own dependency-license review.
