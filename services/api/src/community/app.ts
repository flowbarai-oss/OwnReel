import Fastify from "fastify";
import { mkdir } from "node:fs/promises";
import { z, ZodError } from "zod";
import { CommunityStore, type Queryable } from "./store.js";
import { LocalMedia } from "./media.js";
import { JobQueue, type CommunityJob } from "./jobs.js";
import { ProviderSettings } from "./settings.js";
import { registerCommunityAuth } from "./auth.js";
import { registerProjects } from "./projects.js";
import {
  generationSchema,
  modelCatalog,
  preflight,
  providerInput,
} from "./providers.js";
import { CommunityWorker, storyboardSchema } from "./runtime.js";
import { workstationSchema } from "@flowbar/gen-contracts";
export interface CommunityOptions {
  db: Queryable;
  mediaRoot: string;
  masterKey: Buffer;
  origin: string;
  setupToken: string;
  setupExpires: number;
}
declare module "fastify" {
  interface FastifyInstance {
    community: {
      store: CommunityStore;
      queue: JobQueue;
      settings: ProviderSettings;
      media: LocalMedia;
      runtime: CommunityWorker;
    };
  }
}
const ok = (data: unknown) => ({ success: true, data });
const id = (params: unknown) =>
  z.object({ id: z.string().uuid() }).parse(params).id;
const publicJob = (j: CommunityJob) => ({
  id: j.id,
  kind: j.kind,
  state: j.state,
  input: j.input,
  result: j.result,
  created_at: j.created_at,
  updated_at: j.updated_at,
  providerRequestId: j.provider?.request_id ?? null,
});
export async function buildCommunityApp(options: CommunityOptions) {
  const app = Fastify({
    bodyLimit: 1024 * 1024,
    logger: false,
    trustProxy: false,
  });
  const store = new CommunityStore(options.db),
    queue = new JobQueue(options.db),
    settings = new ProviderSettings(options.db, options.masterKey),
    media = new LocalMedia(options.mediaRoot);
  await mkdir(media.root, { recursive: true });
  await store.migrate();
  await queue.migrate();
  await settings.migrate();
  const runtime = new CommunityWorker(store, queue, settings, media);
  app.setErrorHandler((err, _req, reply) => {
    const error = err as Error & { statusCode?: number };
    const code = error.statusCode===429?'rate_limited':
      error instanceof ZodError
        ? "invalid_input"
        : /^[a-z_0-9]+$/.test(error.message)
          ? error.message
          : "operation_failed";
    const status =
      error instanceof ZodError
        ? 400
        : ["revision_conflict", "idempotency_conflict"].includes(code)
          ? 409
          : (error.statusCode ?? 400);
    reply
      .code(status >= 400 && status <= 599 ? status : 500)
      .send({ success: false, code });
  });
  await registerCommunityAuth(app, store, options);
  await registerProjects(app, store, media);
  app.get("/health", async () => {
    await options.db.query("SELECT 1");
    return ok({ status: "ok", edition: "community" });
  });
  app.get("/api/community/settings", async (req) =>
    ok({
      ...(await settings.publicStatus(req.communityUser!.id)),
      models: modelCatalog,
    }),
  );
  app.put("/api/community/settings", async (req) => {
    const body = z
      .object({ falKey: z.string().trim().min(10).max(512) })
      .parse(req.body);
    await settings.save(req.communityUser!.id, body.falKey);
    return ok({ configured: true });
  });
  app.delete("/api/community/settings", async (req) => {
    await settings.clear(req.communityUser!.id);
    return ok({ configured: false });
  });
  app.post("/api/community/preflight", async (req) => {
    const body = z
      .object({
        kind: z.enum([
          "script",
          "image",
          "video",
          "image-video",
          "tts",
          "render",
        ]),
        input: z.unknown(),
        confirmCost: z.boolean().default(false),
      })
      .parse(req.body);
    if (body.kind !== "render") providerInput(body.kind, body.input);
    return ok(
      preflight(
        body.kind,
        !!(await settings.key(req.communityUser!.id)),
        body.confirmCost,
      ),
    );
  });
  app.post("/api/community/jobs", async (req, reply) => {
    const body = z
      .object({
        kind: z.enum([
          "script",
          "image",
          "video",
          "image-video",
          "tts",
          "render",
        ]),
        input: z.record(z.string(), z.unknown()),
        idempotencyKey: z.string().min(1).max(128),
        confirmCost: z.boolean().default(false),
      })
      .parse(req.body);
    const owner = req.communityUser!.id;
    const input: Record<string, unknown> =
      body.kind === "render"
        ? z
            .object({
              manifest: workstationSchema,
              projectId: z.string().uuid(),
            })
            .parse(body.input)
        : generationSchema.parse(body.input);
    const check = preflight(
      body.kind,
      !!(await settings.key(owner)),
      body.confirmCost,
    );
    if (!check.canSubmit)
      return reply.code(409).send({ success: false, ...check });
    const project=input.projectId?await store.document(owner,'project',String(input.projectId)):null;
    if (input.projectId && (!project||project.data.deleted))
      return reply
        .code(404)
        .send({ success: false, code: "project_not_found" });
    const references =
      body.kind === "render"
        ? workstationSchema
            .parse(input.manifest)
            .clips.map((c) => c.sourceAssetId)
        : body.kind === "image-video"
          ? [String(input.referenceAssetId)]
          : [];
    for (const reference of new Set(references)) {
      if (!z.string().uuid().safeParse(reference).success)
        return reply
          .code(400)
          .send({ success: false, code: "image_reference_required" });
      const asset = await store.document(owner, "asset", reference);
      if (!asset || asset.data.deleted)
        return reply
          .code(404)
          .send({ success: false, code: "asset_not_found" });
      if (body.kind === "image-video" && asset.data.kind !== "image")
        return reply
          .code(400)
          .send({ success: false, code: "image_reference_required" });
    }
    return ok(
      publicJob(
        await queue.submit(owner, body.idempotencyKey, body.kind, input),
      ),
    );
  });
  app.get("/api/community/jobs", async (req) =>
    ok(
      (
        await options.db.query<CommunityJob>(
          "SELECT * FROM community_jobs WHERE owner=$1 ORDER BY created_at DESC LIMIT 100",
          [req.communityUser!.id],
        )
      ).rows.map(publicJob),
    ),
  );
  app.get("/api/community/jobs/:id", async (req, reply) => {
    const j = await queue.get(req.communityUser!.id, id(req.params));
    return j
      ? ok(publicJob(j))
      : reply.code(404).send({ success: false, code: "job_not_found" });
  });
  app.post("/api/community/jobs/:id/cancel", async (req, reply) => {
    const rows = (
      await options.db.query<CommunityJob>(
        "UPDATE community_jobs SET state='cancelled',updated_at=now() WHERE id=$1 AND owner=$2 AND state='queued' RETURNING *",
        [id(req.params), req.communityUser!.id],
      )
    ).rows;
    return rows[0]
      ? ok(publicJob(rows[0]))
      : reply
          .code(409)
          .send({ success: false, code: "already_started_may_be_charged" });
  });
  app.post('/api/community/jobs/:id/reconcile',async(req,reply)=>{
    const body=z.object({requestId:z.string().uuid()}).parse(req.body),job=await queue.get(req.communityUser!.id,id(req.params));
    if(!job||job.state!=='reconciling'||job.kind==='render')return reply.code(409).send({success:false,code:'reconciliation_not_available'});
    if(job.provider?.request_id&&job.provider.request_id!==body.requestId)return reply.code(409).send({success:false,code:'provider_receipt_mismatch'});
    const root=providerInput(job.kind,job.input).endpoint.split('/').slice(0,2).join('/');
    const response_url=`https://queue.fal.run/${root}/requests/${body.requestId}`;
    const receipt=job.provider??{request_id:body.requestId,response_url,status_url:`${response_url}/status`};
    const rows=(await options.db.query<CommunityJob>("UPDATE community_jobs SET state='polling',provider=$3::jsonb,result=NULL,lease_token=NULL,lease_until=NULL,available_at=now(),deadline_at=now()+interval '24 hours',updated_at=now() WHERE id=$1 AND owner=$2 AND state='reconciling' RETURNING *",[job.id,job.owner,JSON.stringify(receipt)])).rows;
    return rows[0]?ok(publicJob(rows[0])):reply.code(409).send({success:false,code:'reconciliation_not_available'});
  });
  app.put("/api/community/projects/:id/storyboard", async (req, reply) => {
    const body = z
        .object({ revision: z.number().int(), storyboard: storyboardSchema })
        .parse(req.body),
      owner = req.communityUser!.id;
    const p = await store.document(owner, "project", id(req.params));
    if (!p || p.data.deleted)
      return reply
        .code(404)
        .send({ success: false, code: "project_not_found" });
    const assets = body.storyboard.shots.flatMap((s) =>
      [s.assetId, s.voiceAssetId].filter((v): v is string => !!v),
    );
    for (const reference of assets){
      const asset=await store.document(owner,'asset',reference);
      if (!asset||asset.data.deleted)
        return reply
          .code(404)
          .send({ success: false, code: "asset_not_found" });
    }
    const result = await store.updateDocument(
      owner,
      "project",
      p.id,
      body.revision,
      {
        ...p.data,
        storyboard: body.storyboard,
        assetIds: [...new Set([...(p.data.assetIds as string[]), ...assets])],
      },
    );
    return ok({ revision: result.revision });
  });
  return Object.assign(app, {
    community: { store, queue, settings, media, runtime },
  });
}
