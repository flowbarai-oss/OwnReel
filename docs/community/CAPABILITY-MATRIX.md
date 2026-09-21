# Community V1 capabilities

This is the tested V0.1.0 scope. See VERIFICATION.md and the current GitHub Actions status for evidence and limitations.

## Source boundary

The original production entry points imported main-site authentication, wallet outbox, commercial pricing, gallery rewards and private cloud storage. Those entry points are **not** in this repository. The exported editor, clip/transition contracts, ASS captions and FFmpeg graph are traced in SOURCE-MANIFEST.json. They are adapted through a separate local API rather than by hiding commercial buttons.

| Capability | Reuse / adaptation | Current evidence |
|---|---|---|
| Local auth | New community adapter, scrypt + opaque hashed sessions | Setup/login/logout/CSRF integration test |
| BYOK storage | Reused SecretBox, new owner-scoped settings | AES-GCM roundtrip / no plaintext database test |
| Projects / assets | New PostgreSQL adapter, private media volume | Reload, metadata, Range, references and stale revision tests |
| Durable tasks | PostgreSQL claim/lease and durable provider receipts | Lost-submit / terminal failure / restart tests |
| Timeline | GEN video-timeline and workstation contracts | Existing timeline/effects tests retained |
| Video export | GEN FFmpeg graph, new standalone executor | Four real H.264/AAC format exports validated with ffprobe |
| One-stop workspace | Community UI using shared assets/jobs/editor | Real paid image-to-video browser journey and playable MP4 passed |
| Smart movie | Editable script and scenes, shared timeline | Three real scripts, EN/ZH voices, real timeline and UI exports passed |
| SRT | New validated import/export | Bilingual exact-time test |

Architecture ruling: PostgreSQL is both persistent state and durable job queue (SKIP LOCKED + leases). A separate unused Redis service is not shipped. The existing Node FFmpeg workstation renderer covers the selected pipeline; production-only Python Composer orchestration is excluded rather than shipping nonfunctional service dependencies. This keeps the user-facing scope unchanged. The embedded PostgreSQL WASM engine (PGlite) is a **development/test** option; production startup explicitly rejects that mode. Docker uses PostgreSQL 16.

## Initial provider profile

One fal key covers the four roles. Model IDs and supported inputs were checked against official documentation on 2026-09-20. Documentation support is not proof of successful generation; paid smoke evidence must be recorded separately.

| Role | Endpoint | Exposed controls |
|---|---|---|
| Script | `fal-ai/any-llm` with `google/gemini-2.5-flash-lite` | English/Chinese, three templates |
| Image | `fal-ai/flux/schnell` | One image; portrait/landscape; safety checker on |
| Text-to-video | `fal-ai/wan/v2.2-a14b/text-to-video` | 480p/720p; 81 frames at 16 fps; 16:9/9:16 |
| Image-to-video | `fal-ai/wan/v2.2-a14b/image-to-video` | Same exposed subset; owned image sent as data URI |
| Voice | `fal-ai/minimax/speech-02-hd` | English/Chinese; Wise_Woman; normal speed |

Sources: [fal queue](https://fal.ai/docs/documentation/model-apis/inference/queue), [LLM](https://fal.ai/models/fal-ai/any-llm/api), [image](https://fal.ai/models/fal-ai/flux/schnell/api), [text-to-video](https://fal.ai/models/fal-ai/wan/v2.2-a14b/text-to-video/api), [image-to-video](https://fal.ai/models/fal-ai/wan/v2.2-a14b/image-to-video/api), [speech](https://fal.ai/models/fal-ai/minimax/speech-02-hd/api).

Unknown provider charges are explicitly unknown, never zero or “free”. A cost acknowledgment is checked server-side. Local exports do not call a paid model. No platform membership, cloud account, Star or subscription gate exists.
