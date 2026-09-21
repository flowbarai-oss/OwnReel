"use client";
import { GuideLink } from './UserGuide';
import { CaptionFiles } from './community/CaptionFiles';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { WorkstationCaption } from "./WorkstationCaption";
import {
  ArrowLeft,
  CloudCheck,
  Loader2,
  ChevronRight,
  SkipBack,
  SkipForward,
  Maximize2,
  Magnet,
  Minus,
  ZoomIn,
  ScanLine,
  MousePointer2,
  GripHorizontal,
  SlidersHorizontal,
  FolderOpen,
  Copy,
  Film,
  Pause,
  Play,
  Plus,
  Redo2,
  Save,
  Scissors,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  api,
  ApiError,
  readableError,
  type Asset,
  type Project,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  timelineTracks,
  clipTrackId,
  renderClips,
  setCanvasRatio,
  type EditorTrack,
  duration,
  edit,
  emptyTimeline,
  endTime,
  fromApi,
  makeClip,
  previewEdit,
  commitPreviewEdit,
  redo,
  snapTime,
  splitClip,
  trimClip,
  toApi,
  undo,
  type Clip,
  type History,
  type Timeline,
  type Track,
} from "@/lib/video-timeline";
import "./video-workstation.css";
import { setClipTransition, previewFilters } from "@/lib/clip-effects";
import { effectPreview } from "@/lib/effect-preview";
import { audioEnvelope, isCrossTransition } from "@flowbar/gen-contracts";
import { WorkstationExport } from "./WorkstationExport";
import { useWorkstationPreviews } from "@/lib/use-workstation-previews";
import { previewDragPosition } from "@/lib/sticker-position";
import { setOverlayBlendMode } from "@/lib/blend-mode";
import { moveClipToTrack } from "@/lib/clip-capabilities";

import {
  WorkstationLibrary,
  WorkstationInspector,
  type EditorAsset,
  type LibraryMode,
} from "./WorkstationPanels";
import { WorkstationClip } from "./WorkstationClip";
import { WorkstationPlayhead } from "./WorkstationPlayhead";
import { WorkstationEffectPreviewFilters } from "./WorkstationEffectPreviewFilters";
import { WorkstationAssetImport } from "./WorkstationAssetImport";
import {
  AddWorkstationTrack,
  WorkstationTrackHeading,
} from "./WorkstationTracks";
const labels: Record<Track, [string, string]> = {
  video: ["主视频", "Video"],
  overlay: ["叠加素材", "Overlay"],
  caption: ["字幕 / 标题", "Captions"],
  voice: ["配音", "Voice"],
  music: ["背景音乐", "Music"],
  sfx: ["音效", "Sound effects"],
};
const time = (ms: number) =>
  `${Math.floor(ms / 60000)
    .toString()
    .padStart(2, "0")}:${((ms / 1000) % 60).toFixed(2).padStart(5, "0")}`;

export function VideoWorkstation({ projectId }: { projectId: string }) {
  const { locale } = useI18n();
  const en = locale === "en";
  const say = (zh: string, english: string) => (en ? english : zh);
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: emptyTimeline(),
    future: [],
  }));
  const value = history.present;
  const [assets, setAssets] = useState<EditorAsset[]>([]),
    [, setProject] = useState<Project>();
  const [selected, setSelected] = useState(""),
    [laneId, setLaneId] = useState<string>("video");
  const tracks = timelineTracks(value);
  const lane = tracks.find((t) => t.id === laneId) || tracks[0];
  const track = lane?.kind || "video";
  const chooseTrack = (id: string) => setLaneId(id);
  const addTrack = (kind: Track, name: string) => {
    const row = {
      id: crypto.randomUUID(),
      kind,
      name:
        name ||
        `${labels[kind][en ? 1 : 0]} ${tracks.filter((t) => t.kind === kind).length + 1}`,
    };
    commit({ ...value, tracks: [...tracks, row] });
    setLaneId(row.id);
  };
  const targetTrack = (kind: Track): EditorTrack =>
    lane?.kind === kind
      ? lane
      : tracks.find((t) => t.kind === kind) || {
          id: crypto.randomUUID(),
          kind,
        };
  const [playhead, setPlayhead] = useState(0),
    [playing, setPlaying] = useState(false),
    [zoom, setZoom] = useState(60),
    [snap, setSnap] = useState(true);
  const [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState("");
  const [uploading, setUploading] = useState(false);
  const [assetImportOpen, setAssetImportOpen] = useState(false),
    [assetImportTarget, setAssetImportTarget] = useState<"media" | "stickers">("media"),
    [importNotice, setImportNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const stickerFileInput = useRef<HTMLInputElement>(null);
  const [libraryMode, setLibraryMode] = useState<LibraryMode>("media");
  const [effectDuration, setEffectDuration] = useState(500);
  const [inspectorFocus, setInspectorFocus] = useState(0);
  const [mobilePanel, setMobilePanel] = useState<"media" | "properties">(
    "media",
  );
  const lanesRef = useRef<HTMLDivElement>(null),
    previewRef = useRef<HTMLDivElement>(null);
  const [timelineHeight, setTimelineHeight] = useState(350);
  useEffect(() => {
    if (window.innerWidth > 700) {
      setTimelineHeight(Math.min(520, Math.max(300, Math.round(window.innerHeight * 0.4))));
    }
  }, []);
  useEffect(() => {
    const viewport = lanesRef.current;
    const row = viewport?.querySelector<HTMLElement>(
      `[data-track-id="${CSS.escape(lane?.id || "")}"]`,
    );
    if (
      viewport &&
      row &&
      (row.offsetTop < viewport.scrollTop + 55 ||
        row.offsetTop + row.offsetHeight >
          viewport.scrollTop + viewport.clientHeight)
    )
      viewport.scrollTop = Math.max(0, row.offsetTop - 55);
  }, [lane?.id]);
  const dragOffset = useRef(0);
  const previewDragOrigin = useRef<Timeline | undefined>(undefined);
  const [versions, setVersions] = useState<
    Array<{ at: string; value: Timeline }>
  >([]);
  const current = useRef(value);
  current.current = value;
  const saveLock = useRef(false),
    savedRef = useRef(""),
    revision = useRef(0);
  const selectedClip = value.clips.find((c) => c.id === selected);
  const assetMap = useMemo(
    () => new Map(assets.map((a) => [a.id, a])),
    [assets],
  );
  const previews = useWorkstationPreviews(value.clips, assetMap);
  const selectedSource = selectedClip ? assetMap.get(selectedClip.sourceAssetId) : undefined;
  const selectedAsset = selectedSource ? {...selectedSource, hasAudio: previews[selectedSource.id]?.hasAudio ?? selectedSource.hasAudio} : undefined;
  const total = endTime(value),
    dirty = loaded && JSON.stringify(value) !== saved;
  const localKey = `gen-workstation:v1:${projectId}`;
  const commit = useCallback(
    (next: Timeline) => {
      try {
        const checked = edit(
          { past: [], present: current.current, future: [] },
          next,
        );
        setError("");
        setHistory((h) => edit(h, checked.present));
      } catch {
        setError(
          locale === "en"
            ? "Check clip timing and timeline name."
            : "请检查片段时间和时间线名称；调整转场边界前请先移除转场。",
        );
      }
    },
    [locale],
  );
  const patch = (update: Partial<Clip>) => {
    if (!selectedClip) return;
    try {
      if (update.track !== undefined) {
        const moved = moveClipToTrack(selectedClip, update.track, update.trackId ?? update.track, selectedAsset);
        commit({...value, clips:value.clips.map(c => c.id === selectedClip.id ? moved : c)});
        return;
      }
      if (
        update.transition !== undefined ||
        update.transitionDuration !== undefined
      ) {
        commit(
          setClipTransition(
            value,
            selectedClip.id,
            update.transition ?? selectedClip.transition,
            update.transitionDuration ?? selectedClip.transitionDuration ?? 500,
          ),
        );
      } else if (update.blendMode !== undefined)
        commit(setOverlayBlendMode(value, selectedClip.id, update.blendMode));
      else
        commit({
          ...value,
          clips: value.clips.map((c) =>
            c.id === selected ? { ...c, ...update } : c,
          ),
        });
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "timeline_track_source_incompatible"
          ? say("此素材不能放入所选轨道。", "This media cannot be placed on the selected track.")
          : cause instanceof Error && cause.message === "timeline_blend_mode_invalid"
          ? say("相连叠加片段使用不同混合模式。请先统一该转场组的混合模式。", "Connected overlay clips use different blend modes. Sync the group before adding this transition.")
          : locale === "en"
          ? "Place two clips edge to edge on the same video or overlay lane. Each must be at least twice the transition duration."
          : "请先让同一视频或叠加轨道的两个片段首尾相接，每段长度至少为转场时长的两倍。",
      );
    }
  };
  const positionClip = (id: string, x: number, y: number) => {
    setHistory((history) => previewEdit(history, {
      ...history.present,
      clips: history.present.clips.map((clip) =>
        clip.id === id ? (clip.track === "caption" ? { ...clip, captionX: x, captionY: y } : { ...clip, x, y }) : clip,
      ),
    }));
  };
  const finishPositionClip = () => {
    const origin = previewDragOrigin.current;
    previewDragOrigin.current = undefined;
    if (origin) setHistory((history) => commitPreviewEdit(history, origin));
  };

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const init = { signal: controller.signal };
    void Promise.all([
      api<Project & { assets: Asset[] }>(
        `/api/v1/projects/${encodeURIComponent(projectId)}`,
        init,
      ),
      api<Asset[]>("/api/v1/assets", init),
      api<Parameters<typeof fromApi>[0]>(
        `/api/v1/projects/${encodeURIComponent(projectId)}/timeline`,
        init,
      ).catch((e) => {
        if (e instanceof ApiError && e.code === "timeline_not_found")
          return null;
        throw e;
      }),
    ])
      .then(([p, library, savedTimeline]) => {
        if (disposed) return;
        const next = savedTimeline
          ? fromApi(savedTimeline)
          : { ...emptyTimeline(), name: p.name };
        void api<EditorAsset[]>(
          `/api/v1/projects/${encodeURIComponent(projectId)}/timeline/uploads`,
          init,
        )
          .then((items) => {
            if (!disposed)
              setAssets((a) => [
                ...new Map([...a, ...items].map((i) => [i.id, i])).values(),
              ]);
          })
          .catch((e) => {
            if (!disposed) setError(readableError(e, locale));
          });
        setProject(p);
        setAssets([
          ...new Map(
            [
              ...library.filter((a) =>
                next.clips.some((c) => c.sourceAssetId === a.id),
              ),
              ...p.assets,
            ].map((a) => [a.id, a]),
          ).values(),
        ]);
        setHistory({ past: [], present: next, future: [] });
        revision.current = Number(
          (savedTimeline as { revision?: number } | null)?.revision ?? 0,
        );
        const serialized = JSON.stringify(next);
        setSaved(serialized);
        savedRef.current = serialized;
        setLoaded(true);
        try {
          const local = JSON.parse(localStorage.getItem(localKey) || "null");
          if (
            local?.schema === 1 &&
            JSON.stringify(local.value) !== serialized
          ) {
            toApi(local.value);
            setVersions([{ at: local.at, value: local.value }]);
          }
        } catch {
          /* Invalid local cache must not replace the server draft. */
        }
        void api<
          Array<{ created_at: string; snapshot: ReturnType<typeof toApi> }>
        >(
          `/api/v1/projects/${encodeURIComponent(projectId)}/timeline/versions`,
          init,
        )
          .then((rows) => {
            if (disposed) return;
            setVersions((items) => [
              ...items,
              ...rows.map((row) => ({
                at: row.created_at,
                value: fromApi({
                  name: row.snapshot.name,
                  aspect_ratio: row.snapshot.aspectRatio,
                  resolution: row.snapshot.resolution,
                  tracks: row.snapshot.tracks,
                  clips: row.snapshot.clips.map((c) => ({
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
                }),
              })),
            ]);
          })
          .catch((e) => {
            if (!disposed) setError(readableError(e, locale));
          });
      })
      .catch((e) => {
        if (!disposed) setError(readableError(e, locale));
      });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [projectId, locale]);

  const save = useCallback(async () => {
    if (saveLock.current || !loaded) return;
    const snapshot = current.current,
      serialized = JSON.stringify(snapshot);
    if (serialized === savedRef.current) return;
    saveLock.current = true;
    setSaving(true);
    try {
      const result = await api<{ revision: number }>(
        `/api/v1/projects/${encodeURIComponent(projectId)}/timeline`,
        {
          method: "PUT",
          body: JSON.stringify({
            ...toApi(snapshot),
            expectedRevision: revision.current,
          }),
        },
      );
      revision.current = result.revision;
      savedRef.current = serialized;
      setSaved(serialized);
      if (JSON.stringify(current.current) === serialized) {
        try {
          localStorage.removeItem(`gen-workstation:v1:${projectId}`);
        } catch {
          // A browser storage restriction must not turn a successful cloud save into an error.
        }
      }
      setVersions((items) =>
        [{ at: new Date().toISOString(), value: snapshot }, ...items].slice(
          0,
          20,
        ),
      );
      setError("");
    } catch (e) {
      setError(readableError(e, locale));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }, [loaded, projectId, locale]);
  useEffect(() => {
    if (!loaded || !dirty) return;
    try {
      localStorage.setItem(
        localKey,
        JSON.stringify({ schema: 1, at: new Date().toISOString(), value }),
      );
    } catch {
      /* Cloud save and the unload guard remain available if browser storage is full. */
    }
  }, [loaded, dirty, localKey, value]);
  useEffect(() => {
    if (!dirty || saving || error) return;
    const timer = setTimeout(() => void save(), 1200);
    return () => clearTimeout(timer);
  }, [dirty, value, saving, error, save]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty || uploading) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, uploading]);
  useEffect(() => {
    if (!playing) return;
    let previous = performance.now(),
      frame = 0;
    const tick = (now: number) => {
      const delta = Math.min(now - previous, 150);
      previous = now;
      setPlayhead((p) => {
        if (p + delta >= total) {
          setPlaying(false);
          return total;
        }
        return p + delta;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, total]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.defaultPrevented || target.closest('[role="dialog"]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
        return;
      }
      if (
        (event.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setHistory(event.shiftKey ? redo : undo);
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        void save();
      } else if (event.code === "Space") {
        if (target.closest("button,a") || !total) return;
        event.preventDefault();
        if (playhead >= total) setPlayhead(0);
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [save, total, playhead]);

  async function add(asset: EditorAsset, forcedTrack?: Track, initialScale = 1) {
    try {
      if (asset.sourceKind !== "upload")
        await api(`/api/v1/projects/${encodeURIComponent(projectId)}/assets`, {
          method: "POST",
          body: JSON.stringify({ assetId: asset.id }),
        });
      const audioTrack = ["voice", "music", "sfx"].includes(track);
      const target: Track = forcedTrack ?? (
        asset.kind === "audio" && !audioTrack
          ? "voice"
          : asset.kind === "image" && audioTrack
            ? "overlay"
            : track);
      const destination = targetTrack(target);
      const clip = {
        trackId: destination.id,
        ...makeClip(
          asset.id,
          target,
          asset.kind === "image" ? 5000 : asset.duration_ms || 5000,
          playhead,
          current.current.aspectRatio,
        ),
        ...(asset.sourceKind === "upload"
          ? { sourceKind: "upload" as const }
          : {}),
        ...(target === "caption"
          ? { text: say("输入字幕", "Your caption") }
          : {}),
        scale: initialScale,
      };
      setSelected(clip.id);
      setMobilePanel("properties");
      commit({
        ...current.current,
        tracks: tracks.some((t) => t.id === destination.id)
          ? tracks
          : [...tracks, destination],
        clips: [...current.current.clips, clip],
      });
    } catch (e) {
      setError(readableError(e, locale));
    }
  }
  async function upload(file?: File, sticker = false) {
    if (!file || uploading) return;
    if (file.size > (sticker ? 5 : file.type.startsWith("image/") ? 15 : 500) * 1024 * 1024) {
      setError(say("文件过大", "File is too large"));
      return;
    }
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await api<{
        id: string;
        contentType: string;
        byteSize: number;
        width: number;
        height: number;
        durationMs?: number;
        signedUrl: string;
      }>(
        sticker
          ? "/api/v1/uploads/sticker"
          : file.type.startsWith("audio/")
          ? "/api/v1/uploads/video?audio=1"
          : file.type.startsWith("video/")
            ? "/api/v1/uploads/video"
            : "/api/v1/uploads/reference",
        { method: "POST", body },
      );
      const item: EditorAsset = {
        id: result.id,
        sourceKind: "upload",
        kind: file.type.startsWith("audio/")
          ? "audio"
          : file.type.startsWith("video/")
            ? "video"
            : "image",
        content_type: result.contentType,
        byte_size: result.byteSize,
        width: result.width,
        height: result.height,
        duration_ms: result.durationMs,
        signedUrl: result.signedUrl,
        created_at: new Date().toISOString(),
      };
      setAssets((a) => [item, ...a]);
      await add(item, sticker ? "overlay" : undefined, sticker ? 0.3 : 1);
    } catch (e) {
      setError(readableError(e, locale));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
      if (stickerFileInput.current) stickerFileInput.current.value = "";
    }
  }
  const addCaption = () => {
    const source = selectedClip || value.clips[0];
    const asset = source ? assetMap.get(source.sourceAssetId) : assets[0];
    if (!asset) return;
    const destination = targetTrack("caption");
    const caption = {
      trackId: destination.id,
      ...makeClip(asset.id, "caption", 3000, playhead),
      sourceKind: source?.sourceKind || asset.sourceKind,
      text: say("输入字幕", "Your caption"),
    };
    commit({
      ...value,
      tracks: tracks.some((t) => t.id === destination.id)
        ? tracks
        : [...tracks, destination],
      clips: [...value.clips, caption],
    });
    setSelected(caption.id);
    setMobilePanel("properties");
  };
  const leave = () => {
    if (
      (!dirty && !uploading) ||
      window.confirm(
        say("尚有未保存修改，确定离开？", "Leave with unsaved changes?"),
      )
    )
      window.location.assign("/?view=projects");
  };
  const previewTime = Math.min(playhead, Math.max(0, total - 1));
  const active = renderClips(value).filter(
    (c) => previewTime >= c.start && previewTime < c.start + duration(c),
  );
  const laneWidth = Math.max(900, Math.ceil((total / 1000 + 10) * zoom));
  return (
    <main className="vw" aria-label={say("剪辑工坊", "Edit Studio")}>
      <WorkstationEffectPreviewFilters />
      <header className="vw-header">
        <button
          className="vw-back"
          aria-label={say("返回剪辑工坊", "Back to Edit Studio")}
          title={say("返回剪辑工坊", "Back to Edit Studio")}
          onClick={leave}
        >
          <ArrowLeft />
        </button>
        <span className="vw-brand">
          GEN<span>STUDIO</span>
        </span>
        <ChevronRight className="vw-breadcrumb" />
        <div className="vw-document">
          <small>{say("剪辑工坊", "Edit Studio")}</small>
          <input
            aria-label={say("时间线名称", "Timeline name")}
            maxLength={120}
            value={value.name}
            onChange={(e) => commit({ ...value, name: e.target.value || " " })}
          />
        </div>
        <div className="vw-header-actions">
          <GuideLink topic="edit-timeline" compact />
          <CaptionFiles timeline={value} onChange={commit} en={en} />
          <span
            className={`vw-save-state ${dirty ? "dirty" : ""}`}
            role="status"
          >
            {saving ? <Loader2 className="vw-spinning" /> : <CloudCheck />}
            {saving
              ? say("保存中…", "Saving…")
              : dirty
                ? say("未保存", "Unsaved")
                : say("已保存", "Saved")}
          </span>
          <button
            className="vw-save-button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            title="Ctrl / ⌘ S"
          >
            <Save />
            {say("保存", "Save")}
          </button>
          {loaded && (
            <WorkstationExport timeline={value} projectId={projectId} en={en} />
          )}
        </div>
      </header>
      {assetImportOpen && (
        <WorkstationAssetImport
          projectId={projectId}
          en={en}
          importedIds={assets
            .filter((a) => a.sourceKind !== "upload")
            .map((a) => a.id)}
          initialKind={assetImportTarget === "stickers" ? "image" : "all"}
          onClose={() => setAssetImportOpen(false)}
          onImported={(items) => {
            setAssets((current) => [
              ...new Map([...current, ...items].map((a) => [a.id, a])).values(),
            ]);
            setImportNotice(
              `${say("已导入", "Imported")} ${items.length} ${say("个素材，点击素材即可加入轨道。", "items. Click media to add it to a track.")}`,
            );
            setLibraryMode(assetImportTarget);
            setMobilePanel("media");
          }}
        />
      )}
      {error && (
        <div role="alert" className="vw-error">
          {error}
          <button onClick={() => void save()} disabled={!loaded || saving}>
            {say("重试保存", "Retry save")}
          </button>
        </div>
      )}
      {!loaded ? (
        <section className="vw-loading">
          {error
            ? say(
                "无法加载项目，未修改草稿。",
                "Project unavailable. Draft unchanged.",
              )
            : say("正在加载项目…", "Loading project…")}
        </section>
      ) : (
        <>
          <div
            className="vw-mobile-panels"
            role="group"
            aria-label={say("工作区面板", "Workspace panel")}
          >
            <button
              aria-pressed={mobilePanel === "media"}
              onClick={() => setMobilePanel("media")}
            >
              <FolderOpen />
              {say("素材与工具", "Media & tools")}
            </button>
            <button
              aria-pressed={mobilePanel === "properties"}
              onClick={() => setMobilePanel("properties")}
            >
              <SlidersHorizontal />
              {say("片段属性", "Clip properties")}
            </button>
          </div>
          <section className="vw-body" data-mobile-panel={mobilePanel}>
            <WorkstationLibrary
              selectedClip={selectedClip}
              effectDuration={effectDuration}
              onEffectDuration={setEffectDuration}
              onApplyEffect={patch}
              assets={assets}
              en={en}
              tracks={tracks}
              track={lane?.id || ""}
              setTrack={chooseTrack}
              onAdd={(asset) => void add(asset)}
              onUpload={(file) => void upload(file)}
              onUploadSticker={(file) => void upload(file, true)}
              onAddSticker={(asset) => void add(asset, "overlay", 0.3)}
              onImportLibrary={(target = "media") => {
                setPlaying(false);
                setAssetImportTarget(target);
                setAssetImportOpen(true);
              }}
              importNotice={importNotice}
              uploading={uploading}
              fileInput={fileInput}
              stickerFileInput={stickerFileInput}
              mode={libraryMode}
              setMode={(mode) => {
                setLibraryMode(mode);
                setMobilePanel("media");
              }}
              onRefresh={() =>
                void api<Project & { assets: Asset[] }>(
                  `/api/v1/projects/${encodeURIComponent(projectId)}`,
                )
                  .then(({ assets: items }) =>
                    setAssets((current) => [
                      ...current.filter((a) => a.sourceKind === "upload"),
                      ...items,
                    ]),
                  )
                  .catch((e) => setError(readableError(e, locale)))
              }
              onCaption={addCaption}
              versions={versions}
              onRestore={commit}
            />
            <section className="vw-preview">
              <div className="vw-preview-toolbar">
                <span className="vw-panel-title">
                  {say("播放器", "Player")}
                  <small>{value.resolution}</small>
                </span>
                <select
                  aria-label={say("画布比例", "Canvas ratio")}
                  value={value.aspectRatio}
                  onChange={(e) => {
                    commit(setCanvasRatio(value, e.target.value));
                  }}
                >
                  {["16:9", "9:16", "1:1", "4:5", "4:3", "3:4", "21:9"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="vw-screen-area" ref={previewRef}>
                <div
                  className="vw-screen"
                  style={{
                    aspectRatio: value.aspectRatio.replace(":", "/"),
                    width: `min(100cqw, calc(100cqh * ${value.aspectRatio.replace(":", " / ")}))`,
                  }}
                >
                  {active
                    .filter((c) => c.track !== "caption")
                    .map((c) => {
                      const asset = assetMap.get(c.sourceAssetId);
                      return asset ? (
                        <PreviewMedia
                          key={c.id}
                          clip={c}
                          clips={value.clips}
                          asset={
                            previews[asset.id]?.proxyUrl
                              ? {
                                  ...asset,
                                  signedUrl: previews[asset.id].proxyUrl!,
                                }
                              : asset
                          }
                          playhead={previewTime}
                          canvasRatio={value.aspectRatio}
                          playing={playing}
                          selected={selected === c.id}
                          onPositionStart={c.track === "overlay" ? () => {
                            setPlaying(false);
                            previewDragOrigin.current = current.current;
                          } : undefined}
                          onPosition={c.track === "overlay" ? (x, y) => {
                            setSelected(c.id);
                            positionClip(c.id, x, y);
                          } : undefined}
                          onPositionEnd={c.track === "overlay" ? finishPositionClip : undefined}
                          onError={() => {
                            setPlaying(false);
                            setError(
                              say(
                                "素材预览失败，请刷新素材链接后重试。",
                                "Media preview failed. Refresh the asset link and retry.",
                              ),
                            );
                          }}
                        />
                      ) : null;
                    })}
                  {active
                    .filter((c) => c.track === "caption")
                    .map((c) => (
                      <WorkstationCaption key={c.id} clip={c} selected={selected === c.id}
                        label={say("拖动字幕，方向键微调", "Drag caption, arrow keys to adjust")}
                        onStart={() => { setPlaying(false); setSelected(c.id); previewDragOrigin.current = current.current; }}
                        onPosition={(x, y) => positionClip(c.id, x, y)} onEnd={finishPositionClip} />
                    ))}
                  {!value.clips.length && (
                    <div className="vw-canvas-empty">
                      <Film />
                      <strong>
                        {say(
                          "开始你的下一部作品",
                          "Your next story starts here",
                        )}
                      </strong>
                      <p>
                        {say(
                          "从素材库添加片段，开始剪辑",
                          "Add media to begin editing",
                        )}
                      </p>
                      <button onClick={() => fileInput.current?.click()}>
                        <Plus />
                        {say("导入素材", "Import media")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="vw-transport">
                <button
                  className="vw-icon-button"
                  aria-label={say("跳到开头", "Go to start")}
                  onClick={() => setPlayhead(0)}
                  disabled={!total}
                >
                  <SkipBack />
                </button>
                <button
                  className="vw-play-button"
                  aria-label={
                    playing ? say("暂停", "Pause") : say("播放", "Play")
                  }
                  onClick={() => {
                    if (playhead >= total) setPlayhead(0);
                    setPlaying((p) => !p);
                  }}
                  disabled={!total}
                >
                  {playing ? <Pause /> : <Play />}
                </button>
                <button
                  className="vw-icon-button"
                  aria-label={say("跳到结尾", "Go to end")}
                  onClick={() => {
                    setPlaying(false);
                    setPlayhead(total);
                  }}
                  disabled={!total}
                >
                  <SkipForward />
                </button>
                <output>
                  <strong>{time(playhead)}</strong>
                  <span>/ {time(total)}</span>
                </output>
                <input
                  aria-label={say("播放头", "Playhead")}
                  type="range"
                  min="0"
                  max={Math.max(1, total)}
                  step="10"
                  value={playhead}
                  onChange={(e) => setPlayhead(Number(e.target.value))}
                />
                <button
                  className="vw-icon-button"
                  aria-label={say("全屏预览", "Fullscreen preview")}
                  title={say("全屏预览", "Fullscreen preview")}
                  onClick={() => {
                    if (document.fullscreenElement)
                      void document.exitFullscreen();
                    else
                      void previewRef.current
                        ?.requestFullscreen()
                        .catch(() => undefined);
                  }}
                >
                  <Maximize2 />
                </button>
              </div>
            </section>
            <WorkstationInspector
              effectDuration={effectDuration}
              onEffectDuration={setEffectDuration}
              focusRequest={inspectorFocus}
              tracks={tracks}
              clip={selectedClip}
              asset={selectedAsset}
              en={en}
              onPatch={patch}
              onCaption={addCaption}
              onClose={() => {
                setSelected("");
                setMobilePanel("media");
              }}
            />
          </section>
          <section className="vw-timeline" style={{ height: timelineHeight }}>
            <div
              className="vw-panel-resizer"
              role="separator"
              aria-label={say("调整时间线高度", "Resize timeline")}
              aria-orientation="horizontal"
              aria-valuenow={timelineHeight}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                  e.preventDefault();
                  setTimelineHeight((h) =>
                    Math.max(
                      260,
                      Math.min(
                        innerHeight * 0.65,
                        h + (e.key === "ArrowUp" ? 20 : -20),
                      ),
                    ),
                  );
                }
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                const start = e.clientY,
                  initial = timelineHeight;
                const move = (event: PointerEvent) =>
                  setTimelineHeight(
                    Math.max(
                      260,
                      Math.min(
                        innerHeight * 0.65,
                        initial + start - event.clientY,
                      ),
                    ),
                  );
                const stop = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", stop);
                  window.removeEventListener("pointercancel", stop);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", stop, { once: true });
                window.addEventListener("pointercancel", stop, { once: true });
              }}
            >
              <GripHorizontal />
            </div>
            <div className="vw-tools">
              <span
                className="vw-tool-mode"
                title={say("选择工具", "Select tool")}
              >
                <MousePointer2 />
              </span>
              <i className="vw-tool-divider" />
              <button
                aria-label={say("撤销", "Undo")}
                disabled={!history.past.length}
                onClick={() => setHistory(undo)}
              >
                <Undo2 />
              </button>
              <button
                aria-label={say("重做", "Redo")}
                disabled={!history.future.length}
                onClick={() => setHistory(redo)}
              >
                <Redo2 />
              </button>
              <button
                disabled={!selectedClip}
                onClick={() => commit(splitClip(value, selected, playhead))}
              >
                <Scissors />
                {say("分割", "Split")}
              </button>
              <button
                aria-label={say("复制片段", "Duplicate clip")}
                disabled={!selectedClip}
                onClick={() => {
                  if (selectedClip)
                    commit({
                      ...value,
                      clips: [
                        ...value.clips,
                        {
                          ...selectedClip,
                          id: crypto.randomUUID(),
                          start: selectedClip.start + duration(selectedClip),
                        },
                      ],
                    });
                }}
              >
                <Copy />
              </button>
              <button
                aria-label={say("删除片段", "Delete clip")}
                disabled={!selectedClip}
                onClick={() =>
                  commit({
                    ...value,
                    clips: value.clips.filter((c) => c.id !== selected),
                  })
                }
              >
                <Trash2 />
              </button>
              <i className="vw-tool-divider" />
              <button
                className={snap ? "vw-snap active" : "vw-snap"}
                aria-pressed={snap}
                aria-label={say("吸附", "Snap")}
                onClick={() => setSnap(!snap)}
              >
                <Magnet />
                <span>{say("吸附", "Snap")}</span>
              </button>
              <AddWorkstationTrack
                en={en}
                disabled={tracks.length >= 32}
                onAdd={addTrack}
              />
              <div className="vw-zoom-tools">
                <button
                  aria-label={say("适应时间线", "Fit timeline")}
                  title={say("适应时间线", "Fit timeline")}
                  onClick={() =>
                    setZoom(
                      Math.max(
                        10,
                        Math.min(
                          160,
                          ((lanesRef.current?.clientWidth || 900) -
                            (lanesRef.current?.querySelector<HTMLElement>(".vw-track-heading")?.offsetWidth || 180) - 26) /
                            Math.max(5, total / 1000 + 1),
                        ),
                      ),
                    )
                  }
                >
                  <ScanLine />
                </button>
                <button
                  aria-label={say("缩小时间线", "Zoom out")}
                  onClick={() => setZoom((z) => Math.max(10, z - 10))}
                >
                  <Minus />
                </button>
                <label>
                  {say("缩放", "Zoom")}
                  <input
                    type="range"
                    min="10"
                    max="160"
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                  />
                </label>
                <button
                  aria-label={say("放大时间线", "Zoom in")}
                  onClick={() => setZoom((z) => Math.min(160, z + 10))}
                >
                  <ZoomIn />
                </button>
              </div>
            </div>
            <div className="vw-lanes" ref={lanesRef}>
              <div className="vw-ruler" style={{ width: `calc(${laneWidth}px + var(--vw-track-heading-width))` }}>
                {Array.from(
                  { length: Math.ceil(laneWidth / zoom / 5) },
                  (_, i) => (
                    <button
                      key={i}
                      style={{ left: `calc(var(--vw-track-heading-width) + ${i * zoom * 5}px)` }}
                      onClick={() => {
                        setPlaying(false);
                        setPlayhead(Math.min(total, i * 5000));
                      }}
                    >
                      {time(i * 5000)}
                    </button>
                  ),
                )}
                <WorkstationPlayhead
                  position={playhead}
                  total={total}
                  zoom={zoom}
                  en={en}
                  onSeek={setPlayhead}
                  onPause={() => setPlaying(false)}
                />
              </div>
              {tracks.map((row) => {
                const t = row.kind;
                return (
                  <div
                    className={`vw-track vw-track-${t}`}
                    key={row.id}
                    data-track-id={row.id}
                    style={{ width: `calc(${laneWidth}px + var(--vw-track-heading-width))` }}
                  >
                    <WorkstationTrackHeading
                      track={row}
                      en={en}
                      selected={lane?.id === row.id}
                      occupied={value.clips.some(
                        (c) => clipTrackId(c) === row.id,
                      )}
                      onSelect={() => {
                        setLaneId(row.id);
                        setLibraryMode(
                          t === "caption"
                            ? "text"
                            : ["voice", "music", "sfx"].includes(t)
                              ? "audio"
                              : "media",
                        );
                        setMobilePanel("media");
                      }}
                      onRename={(name) =>
                        commit({
                          ...value,
                          tracks: tracks.map((r) =>
                            r.id === row.id ? { ...r, name } : r,
                          ),
                        })
                      }
                      onDelete={() => {
                        if (!value.clips.some((c) => clipTrackId(c) === row.id))
                          commit({
                            ...value,
                            tracks: tracks.filter((r) => r.id !== row.id),
                          });
                      }}
                    />
                    <div
                      className="vw-lane"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData(
                          "application/x-gen-clip",
                        );
                        const c = value.clips.find((c) => c.id === id);
                        if (!c) return;
                        const raw =
                          ((e.clientX -
                            e.currentTarget.getBoundingClientRect().left -
                            dragOffset.current) /
                            zoom) *
                          1000;
                        const start = snap
                          ? snapTime(raw, value, id, playhead, 8000 / zoom)
                          : Math.max(0, raw);
                        commit({
                          ...value,
                          clips: value.clips.map((c) =>
                            c.id === id
                              ? { ...c, track: t, trackId: row.id, start }
                              : c,
                          ),
                        });
                      }}
                    >
                      {value.clips
                        .filter((c) => clipTrackId(c) === row.id)
                        .map((c) => (
                          <WorkstationClip
                            canAddTransition={["video", "overlay"].includes(c.track) && value.clips.some(p =>
                              p.id !== c.id && clipTrackId(p) === clipTrackId(c) &&
                              Math.abs(p.start + duration(p) - c.start) < 1 &&
                              duration(p) >= 600 && duration(c) >= 600)}
                            onTransition={() => {
                              setSelected(c.id);
                              setLibraryMode("transitions");
                              setEffectDuration(c.transitionDuration ?? 500);
                              setInspectorFocus(n => n + 1);
                              setMobilePanel("media");
                            }}
                            key={c.id}
                            clip={c}
                            asset={assetMap.get(c.sourceAssetId)}
                            selected={c.id === selected}
                            zoom={zoom}
                            en={en}
                            framesUrl={
                              previews[c.sourceAssetId]?.state === "ready"
                                ? previews[c.sourceAssetId].framesUrl
                                : undefined
                            }
                            waveformUrl={
                              previews[c.sourceAssetId]?.state === "ready"
                                ? previews[c.sourceAssetId].waveformUrl
                                : undefined
                            }
                            onSelect={() => {
                              setSelected(c.id);
                              setPlayhead(c.start);
                              setMobilePanel("properties");
                            }}
                            onDragStart={(e) => {
                              dragOffset.current =
                                e.clientX -
                                e.currentTarget.getBoundingClientRect().left;
                              e.dataTransfer.setData(
                                "application/x-gen-clip",
                                c.id,
                              );
                            }}
                            onTrim={(edge, delta) => {
                              const limit =
                                c.track === "caption" ||
                                assetMap.get(c.sourceAssetId)?.kind === "image"
                                  ? 7200000
                                  : assetMap.get(c.sourceAssetId)
                                      ?.duration_ms || c.out;
                              commit(trimClip(value, c.id, edge, delta, limit));
                            }}
                            onTrimStart={() => setPlaying(false)}
                          />
                        ))}
                      <div
                        className="vw-playhead"
                        style={{ left: (playhead / 1000) * zoom }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <footer className="vw-timeline-footer">
              <span>
                {value.clips.length} {say("个片段", "clips")}
                <i /> {time(total)}
              </span>
              <span>
                <kbd>Space</kbd> {say("播放 / 暂停", "Play / pause")}{" "}
                <kbd>Ctrl Z</kbd> {say("撤销", "Undo")}
              </span>
              <span>
                {value.aspectRatio} · {value.resolution}
              </span>
            </footer>
          </section>
        </>
      )}
    </main>
  );
}

export function PreviewMedia({
  clip,
  clips,
  asset,
  playhead,
  canvasRatio,
  playing,
  selected,
  onPositionStart,
  onPosition,
  onPositionEnd,
  onError,
}: {
  clip: Clip;
  clips: Clip[];
  asset: Asset;
  playhead: number;
  canvasRatio: string;
  playing: boolean;
  selected: boolean;
  onPositionStart?: () => void;
  onPosition?: (x: number, y: number) => void;
  onPositionEnd?: () => void;
  onError: () => void;
}) {
  const media = useRef<HTMLMediaElement | null>(null);
  const backgroundMedia = useRef<HTMLMediaElement | null>(null);
  const pointerDrag = useRef<{ clientX: number; clientY: number; x: number; y: number; rect: DOMRect } | undefined>(undefined);
  useEffect(() => {
    const el = media.current;
    if (!el) return;
    const position = (clip.in + (playhead - clip.start) * clip.speed) / 1000;
    if (Math.abs(el.currentTime - position) > 0.18) el.currentTime = position;
    el.playbackRate = clip.speed;
    const envelope = audioEnvelope(clip, clips),
      elapsed = playhead - clip.start,
      remaining = duration(clip) - elapsed;
    const gain = Math.min(
      1,
      envelope.fadeIn ? elapsed / envelope.fadeIn : 1,
      envelope.fadeOut ? remaining / envelope.fadeOut : 1,
    );
    el.volume = Math.max(0, Math.min(1, clip.volume * gain));
    el.muted = clip.muted;
    if (playing && el.paused) void el.play().catch(onError);
    else if (!playing && !el.paused) el.pause();
    const background = backgroundMedia.current;
    if (background) {
      if (Math.abs(background.currentTime - position) > 0.18)
        background.currentTime = position;
      background.playbackRate = clip.speed;
      background.muted = true;
      if (playing && background.paused) void background.play().catch(onError);
      else if (!playing && !background.paused) background.pause();
    }
  }, [clip, clips, playhead, playing, onError]);
  const overlay = clip.track === "overlay";
  const [canvasWidth, canvasHeight] = canvasRatio.split(":").map(Number);
  const canvasAspect = canvasWidth / canvasHeight;
  const assetAspect = (asset.width || canvasWidth) / (asset.height || canvasHeight);
  const blurred = clip.track === "video" && clip.canvasBackground === "blur";
  const effectiveFit = blurred ? "contain" : clip.fit;
  const overlayWidth = clip.scale * 100 * (effectiveFit === "cover"
    ? Math.max(1, assetAspect / canvasAspect)
    : Math.min(1, assetAspect / canvasAspect));
  const overlayHeight = clip.scale * 100 * (effectiveFit === "cover"
    ? Math.max(1, canvasAspect / assetAspect)
    : Math.min(1, canvasAspect / assetAspect));
  const styleEffect = effectPreview(clip.effectPreset ?? "normal");
  const previewFilter = [previewFilters[clip.filterPreset ?? "normal"], styleEffect.filter]
    .filter((value) => value !== "none")
    .join(" ") || "none";
  const style = {
    filter: previewFilter,
    objectFit: effectiveFit,
    objectPosition: `${clip.x}% ${clip.y}%`,
    ...(overlay ? {
      width: `${overlayWidth}%`,
      height: `${overlayHeight}%`,
      left: `${(100 - overlayWidth) * clip.x / 100}%`,
      top: `${(100 - overlayHeight) * clip.y / 100}%`,
      right: "auto",
      bottom: "auto",
    } : {
      transform: `scale(${clip.scale})`,
      transformOrigin: `${clip.x}% ${clip.y}%`,
    }),
    opacity:
      clip.transition === "fade" || isCrossTransition(clip.transition)
        ? Math.min(
            1,
            (playhead - clip.start) /
              Math.min(clip.transition === "fade" ? 500 : clip.transitionDuration ?? 500, duration(clip) / 2),
          )
        : 1,
    zIndex: overlay ? 2 : 1,
    mixBlendMode: overlay ? (clip.blendMode === "softlight" ? "soft-light" : clip.blendMode ?? "normal") : "normal",
  } as const;
  const updatePosition = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = pointerDrag.current;
    if (!onPosition || !drag) return;
    const position = previewDragPosition(
      { x: drag.x, y: drag.y },
      { x: event.clientX - drag.clientX, y: event.clientY - drag.clientY },
      drag.rect,
      { widthPercent: overlayWidth, heightPercent: overlayHeight },
    );
    onPosition(position.x, position.y);
  };
  const dragProps = onPosition ? {
    className: `vw-draggable-overlay${selected ? " selected" : ""}${styleEffect.className ? ` ${styleEffect.className}` : ""}`,
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      onPositionStart?.();
      const screen = event.currentTarget.closest<HTMLElement>(".vw-screen");
      if (!screen) return;
      pointerDrag.current = { clientX: event.clientX, clientY: event.clientY, x: clip.x, y: clip.y, rect: screen.getBoundingClientRect() };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) updatePosition(event);
    },
    onPointerUp: () => { pointerDrag.current = undefined; onPositionEnd?.(); },
    onPointerCancel: () => { pointerDrag.current = undefined; onPositionEnd?.(); },
  } : { className: styleEffect.className || undefined };
  const backgroundStyle = {
    objectFit: "cover",
    filter: `blur(24px) brightness(${1 - (clip.canvasBackgroundDarkening ?? 0.25)})${styleEffect.filter === "none" ? "" : ` ${styleEffect.filter}`}`,
    transform: "scale(1.08)",
    zIndex: 0,
  } as const;
  if (asset.kind === "image")
    return (
      <>
        {blurred && (
          <img src={asset.signedUrl} alt="" aria-hidden="true" className={styleEffect.className} style={backgroundStyle} />
        )}
        <img src={asset.signedUrl} alt="" style={style} onError={onError} {...dragProps} />
      </>
    );
  if (asset.kind === "audio")
    return (
      <audio
        ref={(el) => {
          media.current = el;
        }}
        src={asset.signedUrl}
        preload="metadata"
        onError={onError}
      />
    );
  return (
    <>
      {blurred && (
        <video
          ref={(el) => {
            backgroundMedia.current = el;
          }}
          src={asset.signedUrl}
          preload="metadata"
          playsInline
          muted
          aria-hidden="true"
          className={styleEffect.className}
          style={backgroundStyle}
        />
      )}
      <video
        ref={(el) => {
          media.current = el;
        }}
        src={asset.signedUrl}
        preload="metadata"
        playsInline
        style={style}
        {...dragProps}
        onError={onError}
      />
    </>
  );
}
