import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { z } from "zod";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { CommunityStore, Document } from "./store.js";
import type { LocalMedia } from "./media.js";
import {
  fromApi,
  toApi,
  validateTimeline,
} from "../../../../packages/studio/lib/video-timeline.js";
const idSchema = z.string().uuid();
const parameters = (v: unknown) => z.object({ id: idSchema }).parse(v).id;
export const assetPublic = (doc: Document) => ({
  id: doc.id,
  kind: doc.data.kind,
  content_type: doc.data.contentType,
  byte_size: doc.data.byteSize,
  width: doc.data.width,
  height: doc.data.height,
  duration_ms: doc.data.durationMs,
  hasAudio: doc.data.hasAudio,
  created_at: doc.created_at,
  tags: [doc.data.name],
  metadata: doc.data.metadata ?? {},
  signedUrl: `/api/v1/assets/${doc.id}/content`,
  thumbnailUrl:
    doc.data.kind === "audio"
      ? undefined
      : `/api/v1/assets/${doc.id}/thumbnail`,
});
const projectPublic = (doc: Document) => ({
  id: doc.id,
  name: doc.data.name,
  revision: doc.revision,
  created_at: doc.created_at,
  updated_at: doc.updated_at,
  storyboard: doc.data.storyboard ?? null,
});
const success = (data: unknown) => ({ success: true, data });
const error = (code: string, statusCode = 400) =>
  Object.assign(new Error(code), { statusCode });
export async function registerProjects(
  app: FastifyInstance,
  store: CommunityStore,
  media: LocalMedia,
) {
  await app.register(multipart, {
    limits: { fileSize: 100 * 1024 * 1024, files: 1, fields: 4 },
  });
  const list = async (owner: string, kind: string) =>
    (
      await store.db.query<Document>(
        "SELECT * FROM community_documents WHERE owner=$1 AND kind=$2 AND NOT(data ? 'deleted') ORDER BY created_at DESC",
        [owner, kind],
      )
    ).rows;
  const requireDoc = async (owner: string, kind: string, id: string) => {
    const doc = await store.document(owner, kind, id);
    if (!doc || doc.data.deleted) throw error(`${kind}_not_found`, 404);
    return doc;
  };
  app.get("/api/v1/projects", async (req) =>
    success((await list(req.communityUser!.id, "project")).map(projectPublic)),
  );
  app.post("/api/v1/projects", async (req) => {
    const data = z
      .object({ name: z.string().trim().min(1).max(160) })
      .parse(req.body);
    return success(
      projectPublic(
        await store.createDocument(req.communityUser!.id, "project", {
          name: data.name,
          assetIds: [],
          timelineRevision: 0,
          versions: [],
        }),
      ),
    );
  });
  app.get("/api/v1/projects/:id", async (req) => {
    const project = await requireDoc(
      req.communityUser!.id,
      "project",
      parameters(req.params),
    );
    const ids = new Set(project.data.assetIds as string[]);
    return success({
      ...projectPublic(project),
      assets: (await list(req.communityUser!.id, "asset"))
        .filter((a) => ids.has(a.id))
        .map(assetPublic),
    });
  });
  app.patch("/api/v1/projects/:id", async (req) => {
    const body = z
        .object({
          name: z.string().trim().min(1).max(160),
          revision: z.number().int(),
        })
        .parse(req.body),
      p = await requireDoc(
        req.communityUser!.id,
        "project",
        parameters(req.params),
      );
    return success(
      projectPublic(
        await store.updateDocument(p.owner, p.kind, p.id, body.revision, {
          ...p.data,
          name: body.name,
        }),
      ),
    );
  });
  app.post("/api/v1/projects/:id/duplicate", async (req) => {
    const p = await requireDoc(
      req.communityUser!.id,
      "project",
      parameters(req.params),
    );
    return success(
      projectPublic(
        await store.createDocument(p.owner, "project", {
          ...p.data,
          name: `${p.data.name} (copy)`.slice(0, 160),
          versions: [],
        }),
      ),
    );
  });
  app.delete("/api/v1/projects/:id", async (req) => {
    const p = await requireDoc(
      req.communityUser!.id,
      "project",
      parameters(req.params),
    );
    await store.updateDocument(p.owner, p.kind, p.id, p.revision, {
      ...p.data,
      deleted: true,
    });
    return success({ deleted: true, assetsRetained: true });
  });
  app.post("/api/v1/projects/:id/assets", async (req) => {
    const { assetId } = z.object({ assetId: idSchema }).parse(req.body);
    const owner = req.communityUser!.id;
    await requireDoc(owner, "asset", assetId);
    const p = await requireDoc(owner, "project", parameters(req.params));
    await store.updateDocument(owner, "project", p.id, p.revision, {
      ...p.data,
      assetIds: [...new Set([...(p.data.assetIds as string[]), assetId])],
    });
    return success({ added: true });
  });
  app.get("/api/v1/assets", async (req) => {
    const query = z
      .object({
        offset: z.coerce.number().int().min(0).optional(),
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        kind: z.string().optional(),
        q: z.string().max(200).optional(),
        search: z.string().max(200).optional(),
      })
      .parse(req.query);
    const rows = (await list(req.communityUser!.id, "asset"))
      .filter(
        (a) =>
          (!query.kind || query.kind === "all" || a.data.kind === query.kind) &&
          String(a.data.name)
            .toLowerCase()
            .includes((query.q ?? query.search ?? "").toLowerCase()),
      )
      .map(assetPublic);
    if (!query.page && !query.limit && query.offset === undefined)
      return success(rows);
    const page = query.page ?? 1,
      limit = query.limit ?? 24,
      offset = query.offset ?? (page - 1) * limit,
      nextOffset = offset + limit < rows.length ? offset + limit : null;
    return success({
      items: rows.slice(offset, offset + limit),
      total: rows.length,
      page,
      pageSize: limit,
      hasMore: nextOffset !== null,
      nextOffset,
    });
  });
  for (const path of [
    "/api/v1/uploads/reference",
    "/api/v1/uploads/video",
    "/api/v1/uploads/sticker",
  ])
    app.post(path, async (req) => {
      const file = await req.file();
      if (!file) throw error("file_required");
      const bytes = await file.toBuffer();
      const item = await media.ingest(bytes, file.filename);
      const { path: _path, directory: _directory, ...data } = item;
      const doc = await store.createDocument(req.communityUser!.id, "asset", {
        ...data,
        mediaId: item.id,
        kind: item.contentType.split("/")[0],
        metadata: { source: "upload", cost: null },
      });
      return success({
        ...assetPublic(doc),
        contentType: item.contentType,
        byteSize: item.byteSize,
        durationMs: item.durationMs,
      });
    });
  for (const suffix of ["content", "thumbnail"])
    app.get(`/api/v1/assets/:id/${suffix}`, async (req, reply) => {
      const doc = await requireDoc(
        req.communityUser!.id,
        "asset",
        parameters(req.params),
      );
      const path = await media.path(
        String(doc.data.mediaId) + (suffix === "thumbnail" ? "-thumb.jpg" : ""),
      );
      let size: number;
      try {
        size = (await stat(path)).size;
      } catch {
        throw error("media_file_missing", 404);
      }
      reply
        .type(
          suffix === "thumbnail" ? "image/jpeg" : String(doc.data.contentType),
        )
        .header("Accept-Ranges", "bytes")
        .header("Content-Disposition", "inline");
      const range = req.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2]))
          return reply
            .code(416)
            .header("Content-Range", `bytes */${size}`)
            .send();
        const start = match[1]
          ? Number(match[1])
          : Math.max(0, size - Number(match[2]));
        const end =
          match[1] && match[2]
            ? Math.min(Number(match[2]), size - 1)
            : size - 1;
        if (
          start > end ||
          start >= size ||
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end)
        )
          return reply
            .code(416)
            .header("Content-Range", `bytes */${size}`)
            .send();
        return reply
          .code(206)
          .header("Content-Range", `bytes ${start}-${end}/${size}`)
          .header("Content-Length", end - start + 1)
          .send(createReadStream(path, { start, end }));
      }
      return reply.header("Content-Length", size).send(createReadStream(path));
    });
  app.delete("/api/v1/assets/:id", async (req, reply) => {
    const owner = req.communityUser!.id,
      id = parameters(req.params),
      asset = await requireDoc(owner, "asset", id);
    const references = (await list(owner, "project")).filter((p) =>
      JSON.stringify(p.data).includes(id),
    );
    const activeJobs=(await store.db.query<{id:string}>("SELECT id FROM community_jobs WHERE owner=$1 AND state NOT IN ('ready','failed','cancelled') AND input::text LIKE $2 LIMIT 1",[owner,`%${id}%`])).rows;
    if (references.length||activeJobs.length)
      return reply
        .code(409)
        .send({
          success: false,
          code: "asset_in_use",
          projects: references.map(projectPublic),
        });
    await store.updateDocument(owner, "asset", id, asset.revision, {
      ...asset.data,
      deleted: true,
    });
    return success({ deleted: true });
  });
  app.get("/api/v1/projects/:id/timeline", async (req) => {
    const p = await requireDoc(
      req.communityUser!.id,
      "project",
      parameters(req.params),
    );
    if (!p.data.timeline) throw error("timeline_not_found", 404);
    return success({
      ...(p.data.timeline as object),
      revision: p.data.timelineRevision,
    });
  });
  app.put("/api/v1/projects/:id/timeline", async (req, reply) => {
    const body = z
      .object({
        name: z.string().max(160),
        aspectRatio: z.string(),
        resolution: z.string(),
        clips: z.array(z.record(z.string(), z.unknown())).max(32),
        tracks: z.array(z.unknown()).optional(),
        expectedRevision: z.number().int().min(0),
      })
      .parse(req.body);
    const p = await requireDoc(
      req.communityUser!.id,
      "project",
      parameters(req.params),
    );
    if (p.data.timelineRevision !== body.expectedRevision)
      return reply
        .code(409)
        .send({ success: false, code: "timeline_conflict" });
    const timeline = {
      name: body.name,
      aspect_ratio: body.aspectRatio,
      resolution: body.resolution,
      tracks: body.tracks,
      clips: body.clips.map((c) => ({
        source_asset_id: c.sourceAssetId,
        source_upload_id: c.sourceUploadId,
        track_kind: c.trackKind,
        timeline_start_ms: c.timelineStartMs,
        source_in_ms: c.sourceInMs,
        source_out_ms: c.sourceOutMs,
        volume: c.volume,
        muted: c.muted,
        transform: c.transform,
      })),
    };
    validateTimeline(fromApi(timeline as Parameters<typeof fromApi>[0]));
    const ids = body.clips.map((c) =>
      idSchema.parse(c.sourceAssetId ?? c.sourceUploadId),
    );
    for (const id of new Set(ids)) await requireDoc(p.owner, "asset", id);
    const revision = body.expectedRevision + 1,
      versions = [
        ...(p.data.versions as object[]),
        { revision, timeline, created_at: new Date().toISOString() },
      ].slice(-10);
    await store.updateDocument(p.owner, p.kind, p.id, p.revision, {
      ...p.data,
      timeline,
      timelineRevision: revision,
      versions,
      assetIds: [...new Set([...(p.data.assetIds as string[]), ...ids])],
    });
    return success({ revision });
  });
  app.get("/api/v1/projects/:id/timeline/versions", async (req) => {
    const p = await requireDoc(
      req.communityUser!.id,
      "project",
      parameters(req.params),
    );
    return success(
      (
        p.data.versions as Array<{
          revision: number;
          created_at: string;
          timeline: Parameters<typeof fromApi>[0];
        }>
      ).map((v) => ({
        revision: v.revision,
        created_at: v.created_at,
        snapshot: toApi(fromApi(v.timeline)),
      })),
    );
  });
  app.get("/api/v1/projects/:id/timeline/uploads", async (req) => {
    await requireDoc(req.communityUser!.id, "project", parameters(req.params));
    return success(
      (await list(req.communityUser!.id, "asset")).map(assetPublic),
    );
  });
  app.post("/api/v1/media-previews", async (req) => {
    const { sourceId } = z.object({ sourceId: idSchema }).parse(req.body);
    const a = await requireDoc(req.communityUser!.id, "asset", sourceId);
    return success({
      id: a.id,
      state: "ready",
      proxyUrl: `/api/v1/assets/${a.id}/content`,
      hasAudio: a.data.hasAudio,
    });
  });
}
