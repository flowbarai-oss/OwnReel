# Operations and recovery

Run commands from the repository root. Keep the same Compose project name, `.env` and data volumes across upgrades. Never substitute a production database URL or volume.

## Start / stop / inspect

```sh
docker compose --env-file .env -f deploy/community/compose.yaml up --build -d
docker compose --env-file .env -f deploy/community/compose.yaml ps
docker compose --env-file .env -f deploy/community/compose.yaml logs --tail=100 api
docker compose --env-file .env -f deploy/community/compose.yaml stop
```

`stop` preserves all volumes. The app is available only on the host loopback port 4420. The database and API have no host ports. Check available disk before a build or render; the renderer requires at least 1 GB free as a minimum safety floor.

## Provider failures

- **Missing/invalid key:** Settings → save a valid fal key. Existing media remains available. Provider balance/access are managed at fal.
- **Explicit failure:** inspect the prompt and provider record; fix the cause before submitting a new request. A retry is a new potentially billable generation. Other successful scenes remain unchanged.
- **Submission unknown:** do not repeatedly click Generate. Check fal’s request history. Use **Reconcile existing request** and its existing request ID. This resumes status/result retrieval, not a new submission. Never enter another person’s or an unrelated request ID.
- **Result download failure:** the worker retries retrieval without regenerating. After 24 hours it pauses for reconciliation. Expired/deleted upstream media may be unrecoverable; contact the provider before deciding to pay for a new generation.
- **Worker restart:** leases expire after five minutes. Polling/render tasks resume; an interrupted paid submission without a durable receipt stays in reconciliation. No blind paid resubmission.
- **Cancel:** queued tasks can be cancelled. Already-submitted provider work may be charged and cannot be promised cancelled/refunded by this app.

Do not manually set a job to ready or edit database state to pretend a missing result exists.

## Backup

Back up PostgreSQL **and** `/data`, including `master.key`, assets and receipts. Losing the key prevents recovery of encrypted provider credentials. Backups contain private material: encrypt and restrict access. The following Bash example creates a consistent stopped-writer backup; it does not delete anything:

```sh
mkdir -p private-backup
chmod 700 private-backup
docker compose --env-file .env -f deploy/community/compose.yaml stop studio api
docker compose --env-file .env -f deploy/community/compose.yaml exec -T database pg_dump -U community -d community -Fc > private-backup/database.dump
docker compose --env-file .env -f deploy/community/compose.yaml run -T --rm --no-deps --entrypoint tar api -C /data -czf - . > private-backup/media.tar.gz
cp .env private-backup/environment.env
git rev-parse HEAD > private-backup/source-commit.txt
docker compose --env-file .env -f deploy/community/compose.yaml start api studio
```

Use a unique backup directory for each run rather than overwriting the only backup. On Windows PowerShell versions with text-only redirection, **do not redirect binary pg_dump/tar output** this way; execute the Bash example in the Linux host shell or use a binary-safe shell. A backup is not verified until a separate restore test succeeds.

## Restore / upgrade

Restore first into a **new isolated Compose project and empty volumes**, not over your only copy. Start its database; restore `database.dump` with `pg_restore -U community -d community --exit-on-error`, and extract `media.tar.gz` into its media volume while the API is stopped. Preserve file ownership for uid 1000 and master-key mode 0600. Use the saved source commit, matching `.env` and master key. Start API/studio, sign in, open projects and download/play a saved asset. Only then retire the old instance.

Before upgrading: record the running commit, take and verify a backup, read the release notes, then build the new commit and start it against the intended volumes. Do not run two API versions against one database during migration. Rollback after a schema change means restoring the **matching application plus database and media backup**, not merely selecting an older image. Current migrations are additive, but future releases may not be.

## Uninstall

To remove containers/network while retaining projects and assets:

```sh
docker compose --env-file .env -f deploy/community/compose.yaml down
```

Do **not** add `--volumes` unless you intentionally want permanent deletion of this installation’s database, keys and media and have verified backups. Never run a global Docker prune as part of uninstall. Check the exact Compose project label before any destructive cleanup.

## Limits

V1 supports one local owner, maximum 100 MB per uploaded/generated file, up to 32 timeline clips, and CPU FFmpeg rendering. It is not a multi-tenant public hosting platform. Provider requests transfer the supplied content to the external service. Local export does not imply that model generation is free or offline.
