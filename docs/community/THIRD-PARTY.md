# Third-party components and distribution boundaries

Project source is MIT, with the original Open Generative AI notice retained. The source allowlist and hashes identify provenance. FlowBarAI names/logos identify this project; the source license does not imply endorsement of modified distributions.

## Runtime/build dependencies

The lockfile is the exact inventory. `npm run audit:licenses` checks every package entry, including optional platform packages. Most packages use MIT, ISC, Apache-2.0 or BSD licenses. Retain their bundled notices when redistributing them.

Reviewed non-permissive components are **unmodified, separately licensed dependencies**:

- Sharp prebuilt packages bundle libvips and supporting libraries under LGPL-3.0-or-later (alongside Apache-2.0/MIT code). The source repository does not copy their binaries. npm installs them from their upstream packages. See [Sharp installation](https://sharp.pixelplumbing.com/install/) and the installed package license files. Redistributing binaries requires retaining licenses and satisfying applicable LGPL source/relinking obligations.
- Lightning CSS and its platform binaries use MPL-2.0. No upstream files are modified here. Source and license: [parcel-bundler/lightningcss](https://github.com/parcel-bundler/lightningcss). Preserve notices and make any covered-file modifications available under MPL when distributing.
- FFmpeg is installed from Debian in a user-built Docker image. The Debian build includes GPL components such as libx264; it is **not covered by this repository’s MIT license**. See [FFmpeg legal information](https://ffmpeg.org/legal.html). Docker users obtain these packages from Debian. Publishing a prebuilt image is a separate distribution step requiring the corresponding source and license obligations to be fulfilled. No prebuilt image is published by this source-only candidate.
- Noto CJK fonts are installed from Debian under their upstream font license. Keep `/usr/share/doc/fonts-noto-cjk` and license notices in redistributed images.
- Development-only ffprobe-static includes a third-party executable. It is not shipped as a committed artifact; runtime Docker uses Debian ffprobe. The test tool’s MIT wrapper does not relicense FFmpeg.

## Media and models

No customer media, hosted-site promotional videos, model weights or third-party music are part of the source tree. Tests create synthetic media or require an explicitly supplied authorized file. fal model/service usage and generated-output terms are separate from this software license; users supply their own key and must review the selected provider/model terms.

No Open-Poe-AI source is included because the selected upstream revision lacks an explicit license grant. No provider key, production database, private history, OAuth token or commercial wallet adapter is exported.
