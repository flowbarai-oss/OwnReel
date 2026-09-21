# Security

OwnReel V1 is a **single-owner, loopback-bound self-hosted application**, not a hardened public multi-tenant SaaS. Keep the Compose binding to 127.0.0.1 and use an SSH tunnel for remote access.

- Local password hashes use scrypt with per-account random salts. Sessions are hashed in the database and cookies are HttpOnly/SameSite=Strict. HTTPS origins use secure host-only cookies.
- Mutating requests require the configured exact Origin. Never set a wildcard origin or trust arbitrary proxy headers.
- Setup requires a one-time, expiring token from the host. There is no default administrator password.
- Provider keys are encrypted server-side. Protect `/data/master.key` and backups. Encryption does not protect against a compromised host administrator.
- Uploaded files are sniffed and validated, size/pixel/duration bounded, stored under generated IDs, and served only after authentication. Do not accept untrusted public uploads without additional isolation, antivirus and resource controls.
- Provider URLs are allowlisted and redirects are rejected. Unknown submissions require reconciliation to avoid repeat charges.
- Logs and issue reports must never include API keys, session cookies, bootstrap tokens, database URLs or private media.

Report a suspected vulnerability privately to **support@flowbarai.com**, with affected commit, impact and safe reproduction steps. Do not open a public issue containing an exploit, key or user data. No response SLA or bounty is promised.

Run dependency audits before deployment. The source scanner detects common credential patterns; it is not a proof that every possible secret format is absent. Review the exact candidate tree and history before publishing.
