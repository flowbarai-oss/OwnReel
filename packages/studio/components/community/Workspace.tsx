"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { SubmissionIntent } from "@/lib/submission";
import {
  api,
  readableError,
  type Asset,
  type Project,
  type Job,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { SmartMovie } from "./SmartMovie";
import { ProjectActions } from "./ProjectActions";
import { Modal } from "./Modal";
const labels = [
  ["create", "Integrated creation", "一体化创作"],
  ["smart", "Smart movie", "智能成片"],
  ["projects", "Projects", "项目"],
  ["assets", "Assets", "资产库"],
  ["settings", "Settings", "设置"],
] as const;
export function Workspace({ onLogout }: { onLogout: () => void }) {
  const { locale } = useI18n(),
    en = locale === "en",
    say = (a: string, b: string) => (en ? a : b);
  const [view, setView] = useState("create"),
    [assets, setAssets] = useState<Asset[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [jobs, setJobs] = useState<Job[]>([]),
    [projectId, setProjectId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [configured, setConfigured] = useState(false),
    [falKey, setFalKey] = useState(""),
    [prompt, setPrompt] = useState(""),
    [kind, setKind] = useState("image"),
    [ratio, setRatio] = useState("16:9"),
    [resolution, setResolution] = useState("480p"),
    [reference, setReference] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [preview, setPreview] = useState<Asset | null>(null);
  useEffect(()=>{
    const query=new URLSearchParams(window.location.search),requested=query.get('view');
    if(labels.some(([id])=>id===requested))setView(requested!);
    if(query.get('kind')==='tts')setKind('tts');
  },[]);
  const reload = useCallback(async () => {
    const [a, p, j, s] = await Promise.all([
      api<Asset[]>("/api/v1/assets"),
      api<Project[]>("/api/v1/projects"),
      api<Job[]>("/api/community/jobs"),
      api<{ configured: boolean }>("/api/community/settings"),
    ]);
    setAssets(a);
    setProjects(p);
    setJobs(j);
    setConfigured(s.configured);
    setProjectId((current) => current || p[0]?.id || "");
  }, []);
  useEffect(() => {
    void reload().catch((e) => setError(readableError(e, locale)));
    const tick = () => {
      if (document.visibilityState === "visible") void reload().catch(() => {});
    };
    const t = setInterval(tick, 8000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload, locale]);
  const perform = async (action: () => Promise<unknown>) => {
    setError("");
    setBusy(true);
    try {
      await action();
      await reload();
    } catch (e) {
      setError(readableError(e, locale));
    } finally {
      setBusy(false);
    }
  };
  const selected = projects.find((p) => p.id === projectId);
  const intent = useRef(new SubmissionIntent());
  const submit = async (kind: string, input: Record<string, unknown>) => {
    if (!confirmed) throw new Error("confirm_provider_cost");
    const payload = {
      ...input,
      projectId: projectId || undefined,
      language: locale,
    };
    await api("/api/community/jobs", {
      method: "POST",
      body: JSON.stringify({
        kind,
        input: payload,
        confirmCost: confirmed,
        idempotencyKey: intent.current.key(kind, payload),
      }),
    });
    intent.current.acknowledge(kind, payload);
    await reload();
  };
  const upload = async (file?: File) => {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    await api("/api/v1/uploads/reference", { method: "POST", body });
  };
  const projectSelect = (
    <label>
      {say("Current project", "当前项目")}
      <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
        <option value="">{say("Choose a project", "选择项目")}</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
  const consent = (
    <label className="check">
      <input
        type="checkbox"
        checked={confirmed}
        onChange={(e) => setConfirmed(e.target.checked)}
      />
      <span>
        {say(
          "I authorize this provider request. Cost is not available here; fal sets the final bill. Retries may incur a new charge. Uploaded-media editing and local exports do not call paid models.",
          "我确认本次供应商调用。这里尚无准确费用，最终以 fal 账单为准，重试可能新增费用。上传素材剪辑和本地导出不会调用付费模型。",
        )}
      </span>
    </label>
  );
  return (
    <div className="app-grid">
      <nav className="sidebar" aria-label={say("Studio modules", "工作室模块")}>
        {labels.map(([key, english, chinese]) => (
          <button
            key={key}
            aria-current={view === key ? "page" : undefined}
            onClick={() => setView(key)}
          >
            {say(english, chinese)}
          </button>
        ))}
        <button
          onClick={() =>
            void perform(async () => {
              await api("/api/community/logout", { method: "POST" });
              onLogout();
            })
          }
        >
          {say("Sign out", "退出登录")}
        </button>
        <a href="https://gen.flowbarai.com" target="_blank" rel="noreferrer">
          {say("Optional cloud studio ↗", "可选云端专业站 ↗")}
        </a>
      </nav>
      <main className="workspace stack">
        <header>
          <span className="eyebrow">YOUR LOCAL CREATIVE STUDIO</span>
          <h1>
            {say(
              labels.find((l) => l[0] === view)?.[1] ?? "Studio",
              labels.find((l) => l[0] === view)?.[2] ?? "工作室",
            )}
          </h1>
        </header>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {view === "projects" && (
          <>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                void perform(async () => {
                  const p = await api<Project>("/api/v1/projects", {
                    method: "POST",
                    body: JSON.stringify({ name }),
                  });
                  setProjectId(p.id);
                  setName("");
                });
              }}
            >
              <label>
                {say("Project name", "项目名称")}
                <input
                  aria-label="Project name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={160}
                />
              </label>
              <button className="primary" disabled={busy}>
                {say("Create project", "创建项目")}
              </button>
            </form>
            <div className="cards">
              {projects.map((p) => (
                <article className="panel stack" key={p.id}>
                  <h3>{p.name}</h3>
                  <small>{new Date(p.updated_at).toLocaleString(locale)}</small>
                  <a
                    href={`/workstation/${p.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {say("Open editor", "打开剪辑器")}
                  </a>
                  <button
                    onClick={() => {
                      setProjectId(p.id);
                      setView("smart");
                    }}
                  >
                    {say("Edit storyboard", "编辑分镜")}
                  </button>
                  <ProjectActions project={p} onAction={perform}/>
                </article>
              ))}
            </div>
            {!projects.length && (
              <p>
                {say(
                  "Create a project first. Your assets remain available across projects.",
                  "先创建一个项目。资产可以跨项目复用。",
                )}
              </p>
            )}
          </>
        )}
        {view === "assets" && (
          <>
            <div className="guide">
              {say(
                "Upload your own images, videos or audio. Media is saved privately on this host and survives browser restarts. Select it in Smart movie or open a project editor to use it.",
                "上传自己的图片、视频或音频。素材保存在本地主机，关闭浏览器不会丢失，可在智能成片或项目剪辑器中使用。",
              )}
            </div>
            <label>
              {say("Upload media", "上传素材")}
              <input
                aria-label="Upload media"
                type="file"
                accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/mpeg,audio/wav"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  void perform(() => upload(file));
                  e.target.value = "";
                }}
              />
            </label>
            <div className="cards">
              {assets.map((a) => (
                <article className="asset-card" key={a.id}>
                  {a.thumbnailUrl ? (
                    <img src={a.thumbnailUrl} alt="" loading="lazy" />
                  ) : (
                    <audio controls preload="none" src={a.signedUrl} />
                  )}
                  <h3>{a.tags?.[0]}</h3>
                  <small>
                    {a.width && a.height ? `${a.width} × ${a.height}` : a.kind}{" "}
                    {a.duration_ms
                      ? ` · ${(a.duration_ms / 1000).toFixed(1)}s`
                      : ""}
                  </small>
                  <small>{new Date(a.created_at).toLocaleString(locale)}</small>
                  <div className="row">
                    <button onClick={() => setPreview(a)}>
                      {say("View", "查看")}
                    </button>
                    <a href={a.signedUrl} download>
                      {say("Download", "下载")}
                    </a>
                    <button onClick={()=>{if(window.confirm(say('Remove this asset from your library? Assets referenced by projects are protected.','从资产库移除此素材？被项目引用的素材不会被删除。')))void perform(()=>api(`/api/v1/assets/${a.id}`,{method:'DELETE'}));}}>{say('Remove','移除')}</button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        {view === "settings" && (
          <section className="panel stack">
            <h2>{say("Bring your own fal key", "使用自己的 fal 密钥")}</h2>
            <p>
              {say(
                "One server-side key covers script, image, video and voice. The encrypted key never returns to your browser. Changing it does not verify balance or model access.",
                "一个服务端密钥覆盖脚本、图片、视频和配音。密钥加密保存，不返回浏览器。更新密钥不代表已验证余额或模型权限。",
              )}
            </p>
            <strong>
              {configured
                ? say("Provider configured", "已配置供应商")
                : say("No provider configured", "尚未配置供应商")}
            </strong>
            <label>
              {say("fal API key", "fal API 密钥")}
              <input
                type="password"
                autoComplete="off"
                value={falKey}
                onChange={(e) => setFalKey(e.target.value)}
              />
            </label>
            <div className="row">
              <button
                disabled={busy || !falKey}
                onClick={() =>
                  void perform(async () => {
                    await api("/api/community/settings", {
                      method: "PUT",
                      body: JSON.stringify({ falKey }),
                    });
                    setFalKey("");
                  })
                }
              >
                {say("Save key", "保存密钥")}
              </button>
              <button
                disabled={busy || !configured}
                onClick={() =>
                  void perform(() =>
                    api("/api/community/settings", { method: "DELETE" }),
                  )
                }
              >
                {say("Remove key", "移除密钥")}
              </button>
            </div>
            <p>
              {say(
                "Supported: Gemini Flash Lite scripts · FLUX Schnell images · Wan 2.2 text/image-to-video (480p/720p, approximately 5 seconds) · MiniMax Speech 02 HD English/Chinese. Export supports 720p/1080p independently of source resolution.",
                "支持：Gemini Flash Lite 脚本 · FLUX Schnell 图片 · Wan 2.2 文/图生视频（480p/720p，约 5 秒）· MiniMax Speech 02 HD 中英配音。导出支持 720p/1080p，不代表源素材原生高清。",
              )}
            </p>
          </section>
        )}
        {view === "create" && (
          <div className="section-grid">
            <section className="panel stack">
              <h2>{say("From idea to asset", "从想法到素材")}</h2>
              {projectSelect}
              {!projects.length && (
                <button onClick={() => setView("projects")}>
                  {say("Create a project first", "先创建项目")}
                </button>
              )}
              <label>
                {say("Create", "制作类型")}
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="image">
                    {say("Image · FLUX Schnell", "图片 · FLUX Schnell")}
                  </option>
                  <option value="video">
                    {say("Text to video · Wan 2.2", "文生视频 · Wan 2.2")}
                  </option>
                  <option value="image-video">
                    {say("Image to video · Wan 2.2", "图生视频 · Wan 2.2")}
                  </option>
                  <option value="tts">
                    {say("Voice · MiniMax", "配音 · MiniMax")}
                  </option>
                </select>
              </label>
              <label>
                {say("Prompt / narration", "提示词 / 配音文本")}
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={5000}
                />
              </label>
              {kind === "image-video" && (
                <label>
                  {say("Reference image from assets", "资产库参考图片")}
                  <select
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  >
                    <option value="">
                      {say("Choose an image", "选择图片")}
                    </option>
                    {assets
                      .filter((a) => a.kind === "image")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.tags?.[0]}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <div className="row">
                <label>
                  {say("Aspect ratio", "画幅")}
                  <select
                    value={ratio}
                    onChange={(e) => setRatio(e.target.value)}
                  >
                    <option>16:9</option>
                    <option>9:16</option>
                  </select>
                </label>
                {kind.includes("video") && (
                  <label>
                    {say("Native resolution", "原生分辨率")}
                    <select
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                    >
                      <option>480p</option>
                      <option>720p</option>
                    </select>
                  </label>
                )}
              </div>
              {consent}
              <button
                className="primary"
                disabled={busy || !prompt.trim() || !configured || !confirmed}
                onClick={() =>
                  void perform(() =>
                    submit(kind, {
                      prompt,
                      aspectRatio: ratio,
                      resolution,
                      referenceAssetId: reference || undefined,
                    }),
                  )
                }
              >
                {say("Generate", "生成")}
              </button>
              {!configured && (
                <button onClick={() => setView("settings")}>
                  {say(
                    "Configure provider — or upload your media in Assets",
                    "配置供应商，或到资产库上传素材",
                  )}
                </button>
              )}
              {selected && (
                <a
                  href={`/workstation/${selected.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {say("Continue in editor ↗", "在剪辑器中继续 ↗")}
                </a>
              )}
            </section>
            <section className="panel stack">
              <h2>{say("Generation & exports", "生成与导出")}</h2>
              <p>
                {say(
                  "Jobs run on the host, even after you close this tab. Completed media is saved in Assets.",
                  "关闭标签页后任务继续在主机执行，完成的素材自动入库。",
                )}
              </p>
              {jobs.map((j) => (
                <article className="job" key={j.id}>
                  <div className="row">
                    <strong>{j.kind}</strong>
                    <span>{j.state}</span>
                    <small>
                      {Math.max(
                        0,
                        Math.round(
                          (new Date(
                            ["ready", "failed", "cancelled"].includes(j.state)
                              ? j.updated_at
                              : Date.now(),
                          ).getTime() -
                            new Date(j.created_at).getTime()) /
                            1000,
                        ),
                      )}
                      s
                    </small>
                  </div>
                  {!["ready", "failed", "cancelled", "reconciling"].includes(
                    j.state,
                  ) && <progress aria-label="Task progress" />}
                  <code>{j.id}</code>
                  {j.state==='queued'&&<button onClick={()=>void perform(()=>api(`/api/community/jobs/${j.id}/cancel`,{method:'POST'}))}>{say('Cancel queued task','取消排队任务')}</button>}
                  {j.state==='reconciling'&&<button onClick={()=>{const requestId=window.prompt(say('After checking fal history, enter the existing request ID. This only resumes polling; it does not submit a new generation.','核对 fal 历史记录后输入已有请求 ID。仅恢复查询，不会重新生成。'),j.providerRequestId??'');if(requestId)void perform(()=>api(`/api/community/jobs/${j.id}/reconcile`,{method:'POST',body:JSON.stringify({requestId})}));}}>{say('Reconcile existing request','恢复已有请求')}</button>}
                  {j.result?.error && (
                    <p className="error">
                      {readableError(new Error(j.result.error), locale)}
                    </p>
                  )}
                  {j.result?.assetId && (
                    <div className="row">
                      <button
                        onClick={() =>
                          setPreview(
                            assets.find((a) => a.id === j.result?.assetId) ??
                              null,
                          )
                        }
                      >
                        {say("Preview", "预览")}
                      </button>
                      <a
                        href={`/api/v1/assets/${j.result.assetId}/content`}
                        download
                      >
                        {say("Download", "下载")}
                      </a>
                      {projectId&&<button onClick={()=>void perform(()=>api(`/api/v1/projects/${projectId}/assets`,{method:'POST',body:JSON.stringify({assetId:j.result!.assetId})}))}>{say('Add to current project','加入当前项目')}</button>}
                      {assets.find(a=>a.id===j.result?.assetId)?.kind==='image'&&<button onClick={()=>{setKind('image-video');setReference(j.result!.assetId!);}}>{say('Use for image-to-video','用作图生视频')}</button>}
                    </div>
                  )}
                </article>
              ))}
            </section>
          </div>
        )}
        {view === "smart" && (
          <>
            <div className="panel stack">
              {projectSelect}
              {consent}
              {!projects.length && (
                <button onClick={() => setView("projects")}>
                  {say("Create a project first", "先创建项目")}
                </button>
              )}
            </div>
            {selected && (
              <SmartMovie
                key={selected.id}
                project={selected}
                assets={assets}
                jobs={jobs}
                confirmed={confirmed}
                onSubmit={submit}
                onReload={reload}
              />
            )}
          </>
        )}
        {preview && (
          <Modal label={say('Asset preview','素材预览')} onClose={()=>setPreview(null)}>
            <section className="panel stack">
              <button onClick={() => setPreview(null)}>
                {say("Close", "关闭")}
              </button>
              {preview.kind === "image" ? (
                <img src={preview.signedUrl} alt={preview.tags?.[0] ?? ""} />
              ) : preview.kind === "video" ? (
                <video src={preview.signedUrl} controls autoPlay />
              ) : (
                <audio src={preview.signedUrl} controls />
              )}
              <h3>{preview.tags?.[0]}</h3>
              <small>
                {String(
                  preview.metadata?.model ?? say("Uploaded media", "上传素材"),
                )}
              </small>
              <p>{String(preview.metadata?.prompt ?? "")}</p>
              <a href={preview.signedUrl} download>
                {say("Download original", "下载原始文件")}
              </a>
            </section>
          </Modal>
        )}
      </main>
    </div>
  );
}
