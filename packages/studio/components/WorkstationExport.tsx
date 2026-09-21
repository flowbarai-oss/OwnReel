"use client";
import { useState, useEffect } from "react";
import { api, readableError, type Job } from "@/lib/api";
import { renderClips, type Timeline } from "@/lib/video-timeline";
import { Modal } from './community/Modal';
export function WorkstationExport({
  timeline,
  projectId,
  en,
}: {
  timeline: Timeline;
  projectId: string;
  en: boolean;
}) {
  const [open, setOpen] = useState(false),
    [job, setJob] = useState<Job | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const say = (a: string, b: string) => (en ? a : b);
  useEffect(() => {
    if (
      !job ||
      ["ready", "failed", "cancelled", "reconciling"].includes(job.state)
    )
      return;
    const timer = setInterval(() => {
      void api<Job>(`/api/community/jobs/${job.id}`)
        .then((next) => {
          setJob(next);
          setError("");
        })
        .catch((e) => setError(readableError(e, en ? "en" : "zh-CN")));
    }, 2500);
    return () => clearInterval(timer);
  }, [job, en]);
  return (
    <>
      <button className="primary" onClick={() => setOpen(true)}>
        {say("Export MP4", "导出 MP4")}
      </button>
      {open && (
        <Modal label={say('Export movie','导出影片')} onClose={()=>setOpen(false)}>
          <section className="panel stack">
            <div className="row">
              <h2>{say("Export movie", "导出影片")}</h2>
              <button onClick={() => setOpen(false)}>
                {say("Close", "关闭")}
              </button>
            </div>
            <p>
              {say(
                "Local rendering has no platform fee. Export size does not increase the native detail of low-resolution sources. Your job continues when this tab is closed.",
                "本地渲染不收取平台费用。导出尺寸不会提升低清素材的原生细节。关闭标签页后任务继续执行。",
              )}
            </p>
            <strong>
              {timeline.resolution} · {timeline.aspectRatio}
            </strong>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {job && (
              <>
                <p role="status">
                  {job.state} · {job.id.slice(0, 8)}
                </p>
                {!["ready", "failed", "cancelled", "reconciling"].includes(
                  job.state,
                ) && <progress aria-label="Rendering" />}
                {job.result?.error && (
                  <p className="error">
                    {readableError(
                      new Error(job.result.error),
                      en ? "en" : "zh-CN",
                    )}
                  </p>
                )}
                {job.result?.assetId && (
                  <>
                    <video
                      controls
                      src={`/api/v1/assets/${job.result.assetId}/content`}
                    />
                    <a
                      href={`/api/v1/assets/${job.result.assetId}/content`}
                      download="FlowBarAI-Community.mp4"
                    >
                      {say("Download MP4", "下载 MP4")}
                    </a>
                  </>
                )}
              </>
            )}
            <button
              className="primary"
              disabled={
                busy ||
                (!!job &&
                  !["ready", "failed", "cancelled"].includes(job.state)) ||
                !timeline.clips.length
              }
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  setJob(
                    await api<Job>("/api/community/jobs", {
                      method: "POST",
                      body: JSON.stringify({
                        kind: "render",
                        idempotencyKey: crypto.randomUUID(),
                        input: {
                          projectId,
                          manifest: {
                            version: 1,
                            aspectRatio: timeline.aspectRatio,
                            resolution: timeline.resolution,
                            clips: renderClips(timeline),
                          },
                        },
                        confirmCost: false,
                      }),
                    }),
                  );
                } catch (e) {
                  setError(readableError(e, en ? "en" : "zh-CN"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {say("Render locally", "开始本地渲染")}
            </button>
          </section>
        </Modal>
      )}
    </>
  );
}
