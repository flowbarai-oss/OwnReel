"use client";
import { useState,useEffect } from "react";
import {
  api,
  readableError,
  type Project,
  type Asset,
  type Job,
  type Storyboard,
  type Shot,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { storyboardTimeline } from "@/lib/smart-movie";
import { toApi } from "@/lib/video-timeline";
export function SmartMovie({
  project,
  assets,
  jobs,
  confirmed,
  onSubmit,
  onReload,
}: {
  project: Project;
  assets: Asset[];
  jobs: Job[];
  confirmed: boolean;
  onSubmit: (kind: string, input: Record<string, unknown>) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const { locale } = useI18n(),
    en = locale === "en",
    say = (a: string, b: string) => (en ? a : b);
  const [draft, setDraft] = useState<Storyboard>(
      project.storyboard ?? { title: project.name, shots: [] },
    ),
    [revision, setRevision] = useState(project.revision),
    [topic, setTopic] = useState(""),
    [template, setTemplate] = useState<string>(project.storyboard?.template??"product"),
    [aspect, setAspect] = useState<string>(project.storyboard?.aspectRatio??"9:16"),
    [resolution, setResolution] = useState<string>(project.storyboard?.resolution??"720p"),
    [extend, setExtend] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(true),
    [editorReady, setEditorReady] = useState(false);
  useEffect(()=>{if(saved)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[saved]);
  const change = (next: Storyboard) => {
    setDraft(next);
    setSaved(false);
    setEditorReady(false);
  };
  const patch = (id: string, value: Partial<Shot>) =>
    change({
      ...draft,
      shots: draft.shots.map((s) => (s.id === id ? { ...s, ...value } : s)),
    });
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await onReload();
    } catch (e) {
      setError(readableError(e, locale));
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    const result = await api<{ revision: number }>(
      `/api/community/projects/${project.id}/storyboard`,
      { method: "PUT", body: JSON.stringify({ revision, storyboard: {...draft,aspectRatio:aspect,resolution,template} }) },
    );
    setRevision(result.revision);
    setSaved(true);
  };
  const manual = () => {
    const prompts =
      template === "product"
        ? [
            say("Introduce the product", "展示产品"),
            say("Demonstrate the main benefit", "展示核心优势"),
            say("Finish with a call to action", "行动号召"),
          ]
        : template === "feature"
          ? [
              say("Show the problem", "展示问题"),
              say("Demonstrate the feature", "演示功能"),
              say("Show the result", "展示结果"),
            ]
          : [
              say("Open with an attention hook", "吸引注意的开头"),
              say("Share one clear idea", "表达一个清晰观点"),
              say("Invite the viewer to act", "邀请观众行动"),
            ];
    change({
      title: topic || project.name,
      shots: prompts.map((p) => ({
        id: crypto.randomUUID(),
        prompt: `${topic || project.name}: ${p}`,
        narration: "",
        caption: p,
        durationMs: 5000,
      })),
    });
  };
  const projectJobs = jobs.filter((j) => j.input.projectId === project.id);
  return (
    <div className="stack">
      <section className="panel stack">
        <h2>{say("1. Write the story", "1. 编写故事")}</h2>
        <div className="guide">
          {say(
            "Describe your idea, generate a script, then approve and edit every scene before generating media. Or use the manual template and your own assets without an API key. Save your storyboard before leaving.",
            "描述想法生成脚本，逐镜头修改并确认，再生成素材。也可以使用手工模板和自己的素材，无需 API 密钥。离开前请保存分镜。",
          )}
        </div>
        <div className="row">
          <label>
            {say("Template", "模板")}
            <select
              value={template}
              onChange={(e) => {setTemplate(e.target.value);setSaved(false);setEditorReady(false);}}
            >
              <option value="product">{say("Product ad", "产品广告")}</option>
              <option value="feature">
                {say("Feature story", "功能介绍")}
              </option>
              <option value="social">
                {say("Social short", "社交短视频")}
              </option>
            </select>
          </label>
          <label>
            {say("Aspect ratio", "画幅")}
            <select value={aspect} onChange={(e) => {setAspect(e.target.value);setSaved(false);setEditorReady(false);}}>
              <option>9:16</option>
              <option>16:9</option>
            </select>
          </label>
          <label>
            {say("Export size", "导出尺寸")}
            <select
              value={resolution}
              onChange={(e) => {setResolution(e.target.value);setSaved(false);setEditorReady(false);}}
            >
              <option>720p</option>
              <option>1080p</option>
            </select>
          </label>
        </div>
        <label>
          {say("Topic / product brief", "主题 / 产品简报")}
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={4000}
          />
        </label>
        <div className="row">
          <button
            disabled={busy || !topic || !confirmed}
            onClick={() =>
              void run(() =>
                onSubmit("script", {
                  prompt: topic,
                  template,
                  aspectRatio: aspect,
                }),
              )
            }
          >
            {say("Generate storyboard", "生成分镜脚本")}
          </button>
          <button disabled={busy} onClick={manual}>
            {say("Use manual template (no AI)", "使用手工模板（非 AI）")}
          </button>
        </div>
        {projectJobs
          .filter((j) => j.kind === "script")
          .slice(0, 3)
          .map((j) => (
            <div className="job" key={j.id}>
              <span>
                {say("Script job", "脚本任务")} · {j.state}
              </span>
              {j.result?.storyboard && (
                <button onClick={() => change(j.result!.storyboard!)}>
                  {say("Use generated storyboard", "使用生成的分镜")}
                </button>
              )}
              {j.result?.error && (
                <p className="error">
                  {readableError(new Error(j.result.error), locale)}
                </p>
              )}
            </div>
          ))}
      </section>
      {draft.shots.length > 0 && (
        <>
          <section className="panel stack">
            <h2>{say("2. Direct each scene", "2. 编辑每个镜头")}</h2>
            <label>
              {say("Movie title", "影片标题")}
              <input
                value={draft.title}
                onChange={(e) => change({ ...draft, title: e.target.value })}
              />
            </label>
            <p>
              {say(
                "Choose an existing asset or generate just this scene. Failed scenes do not re-run successful scenes. Narration is optional; captions are not automatic audio transcription.",
                "选择已有素材或仅生成当前镜头。失败镜头不会触发已成功镜头重跑。配音可选，字幕不是对音频的自动转录。",
              )}
            </p>
            {draft.shots.map((shot, index) => (
              <article key={shot.id} className="shot stack">
                <header>
                  <strong>
                    {say("Scene", "镜头")} {index + 1}
                  </strong>
                  <label>
                    {say("Seconds", "秒")}
                    <input
                      type="number"
                      min={1}
                      max={30}
                      step={0.1}
                      value={shot.durationMs / 1000}
                      onChange={(e) =>
                        patch(shot.id, {
                          durationMs: Math.round(Number(e.target.value) * 1000),
                        })
                      }
                    />
                  </label>
                </header>
                <div className="shot-fields">
                  <label>
                    {say("Visual prompt", "画面提示词")}
                    <textarea
                      value={shot.prompt}
                      onChange={(e) =>
                        patch(shot.id, { prompt: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    {say("Narration", "配音文本")}
                    <textarea
                      value={shot.narration}
                      onChange={(e) =>
                        patch(shot.id, { narration: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    {say("Caption", "字幕")}
                    <input
                      value={shot.caption}
                      onChange={(e) =>
                        patch(shot.id, { caption: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    {say("Visual asset", "画面素材")}
                    <select
                      value={shot.assetId ?? ""}
                      onChange={(e) =>
                        patch(shot.id, { assetId: e.target.value || undefined })
                      }
                    >
                      <option value="">
                        {say("Choose image or video", "选择图片或视频")}
                      </option>
                      {assets
                        .filter((a) => a.kind !== "audio")
                        .map((a) => (
                          <option value={a.id} key={a.id}>
                            {a.tags?.[0]} · {a.width}×{a.height}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    {say("Voice asset", "配音素材")}
                    <select
                      value={shot.voiceAssetId ?? ""}
                      onChange={(e) =>
                        patch(shot.id, {
                          voiceAssetId: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">
                        {say("No narration audio", "无配音音轨")}
                      </option>
                      {assets
                        .filter((a) => a.kind === "audio")
                        .map((a) => (
                          <option value={a.id} key={a.id}>
                            {a.tags?.[0]}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <div className="row">
                  <button
                    disabled={busy || !confirmed}
                    onClick={() =>
                      void run(() =>
                        onSubmit("image", {
                          prompt: shot.prompt,
                          aspectRatio: aspect,
                          shotId: shot.id,
                        }),
                      )
                    }
                  >
                    {say("Generate image", "生成图片")}
                  </button>
                  <button
                    disabled={busy || !confirmed}
                    onClick={() =>
                      void run(() =>
                        onSubmit("video", {
                          prompt: shot.prompt,
                          aspectRatio: aspect,
                          resolution: "480p",
                          shotId: shot.id,
                        }),
                      )
                    }
                  >
                    {say("Generate video", "生成视频")}
                  </button>
                  <button
                    disabled={busy || !confirmed || !shot.narration}
                    onClick={() =>
                      void run(() =>
                        onSubmit("tts", {
                          prompt: shot.narration,
                          shotId: shot.id,
                        }),
                      )
                    }
                  >
                    {say("Generate voice", "生成配音")}
                  </button>
                </div>
                {projectJobs
                  .filter((j) => j.input.shotId === shot.id)
                  .slice(0, 6)
                  .map((j) => (
                    <div className="row" key={j.id}>
                      <small>
                        {j.kind} · {j.state}
                      </small>
                      {j.result?.assetId && (
                        <button
                          onClick={() =>
                            patch(
                              shot.id,
                              j.kind === "tts"
                                ? { voiceAssetId: j.result!.assetId }
                                : { assetId: j.result!.assetId },
                            )
                          }
                        >
                          {say("Use result", "使用结果")}
                        </button>
                      )}
                      {j.result?.error && (
                        <small className="error">
                          {readableError(new Error(j.result.error), locale)}
                        </small>
                      )}
                    </div>
                  ))}
              </article>
            ))}
            <div className="row">
              <button
                className="primary"
                disabled={busy || saved}
                onClick={() => void run(save)}
              >
                {say("Save storyboard", "保存分镜")}
              </button>
              <span role="status">
                {saved
                  ? say("Saved", "已保存")
                  : say("Unsaved changes", "有未保存修改")}
              </span>
            </div>
          </section>
          <section className="panel stack">
            <h2>{say("3. Edit and export", "3. 剪辑与导出")}</h2>
            <label className="check">
              <input
                type="checkbox"
                checked={extend}
                onChange={(e) => setExtend(e.target.checked)}
              />
              {say(
                "Extend still-image scenes when narration is longer. Videos need a shorter narration or a longer source.",
                "配音更长时延长图片镜头。视频镜头需要缩短配音或提供更长素材。",
              )}
            </label>
            <p>
              {say(
                "Build a timeline from your chosen assets. In the editor, add music, trim, split, reorder, style subtitles, then export a real MP4. Source images use local motion/hold, not generated AI video.",
                "从已选素材创建时间线。进入剪辑器后添加音乐、裁剪拆分、排序、美化字幕并导出 MP4。图片素材使用本地展示，并非 AI 生成视频。",
              )}
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await save();
                  const timeline = storyboardTimeline(
                    draft,
                    assets,
                    aspect,
                    resolution,
                    extend,
                  );
                  let expectedRevision = 0;
                  try {
                    expectedRevision = (
                      await api<{ revision: number }>(
                        `/api/v1/projects/${project.id}/timeline`,
                      )
                    ).revision;
                  } catch (e) {
                    if ((e as { code?: string }).code !== "timeline_not_found")
                      throw e;
                  }
                  await api(`/api/v1/projects/${project.id}/timeline`, {
                    method: "PUT",
                    body: JSON.stringify({
                      ...toApi(timeline),
                      expectedRevision,
                    }),
                  });
                  const refreshed = await api<Project>(
                    `/api/v1/projects/${project.id}`,
                  );
                  setRevision(refreshed.revision);
                  setEditorReady(true);
                })
              }
            >
              {say("Build editable timeline", "创建可编辑时间线")}
            </button>
            {editorReady && (
              <a
                href={`/workstation/${project.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {say("Open editor and export ↗", "打开剪辑器并导出 ↗")}
              </a>
            )}
          </section>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
