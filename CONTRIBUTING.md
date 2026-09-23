# Contributing

Use Node.js 22.13+ or 24+ (ESLint 10 rejects 22.0–22.12), FFmpeg/ffprobe and PostgreSQL (or the development-only PGlite mode). Keep provider keys outside the repository. Run the README check commands before proposing changes.

Add a failing regression test before fixing behavior. Test actual media output for renderer changes; mocks do not prove provider generation or playable export. Never weaken ownership checks, cost acknowledgement, idempotency or failure handling to make a test pass.

Describe the problem, smallest reproduction, screenshots where useful, environment, tests and limitations. Use synthetic or authorized media. Do not attach credentials, customer media or database dumps.

Keep English and Chinese labels aligned. Core UI changes need desktop/mobile checks and keyboard access. New models need an explicit capability adapter and truthful cost behavior, not arbitrary URL forwarding.

Contributions are submitted under the repository MIT license. Third-party source must retain its license and provenance. Do not include unlicensed plugins or proprietary model weights.
