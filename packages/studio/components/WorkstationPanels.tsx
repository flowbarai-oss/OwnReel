"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Film,
  ImageIcon,
  Music2,
  Type,
  History,
  Search,
  Upload,
  Library,
  RefreshCw,
  Plus,
  SlidersHorizontal,
  RotateCcw,
  ChevronDown,
  Mic2,
  AudioLines,
  Layers,
  Sticker,
  Check,
  X,
  ArrowRightLeft,
  Sparkles,
} from "lucide-react";
import type { Asset } from "@/lib/api";
import {
  TRANSITIONS,
  FILTER_PRESETS,
  BLEND_MODES,
  EFFECT_PRESETS,
  type EditorTrack,
  clipTrackId,
  duration,
  type Clip,
  type Timeline,
  type Track,
} from "@/lib/video-timeline";
import { EffectDuration, WorkstationEffectLibrary } from "./WorkstationEffectLibrary";
import { WorkstationStickers } from "./WorkstationStickers";
import { CaptionAppearanceControls } from "./CaptionAppearanceControls";
import { WorkstationStyleEffects } from "./WorkstationStyleEffects";
import { canPlaceClip, clipCapabilities } from "@/lib/clip-capabilities";
export type LibraryMode = "media" | "stickers" | "text" | "audio" | "history" | "transitions" | "filters" | "effects";

export type EditorAsset = Asset & { sourceKind?: "upload" };
export const trackNames: Record<Track, [string, string]> = {
  video: ["主视频", "Video"],
  overlay: ["叠加素材", "Overlay"],
  caption: ["字幕 / 标题", "Captions"],
  voice: ["配音", "Voice"],
  music: ["背景音乐", "Music"],
  sfx: ["音效", "Sound effects"],
};
export const trackIcons = {
  video: Film,
  overlay: Layers,
  caption: Type,
  voice: Mic2,
  music: Music2,
  sfx: AudioLines,
};
export const mediaName = (asset: Asset | undefined, en: boolean) =>
  asset
    ? asset.tags?.[0] ||
      `${{ video: en ? "Video" : "视频", image: en ? "Image" : "图片", audio: en ? "Audio" : "音频" }[asset.kind]} ${asset.id.slice(0, 6)}`
    : en
      ? "Media unavailable"
      : "素材不可用";
const shortTime = (ms = 0) =>
  `${Math.floor(ms / 60000)
    .toString()
    .padStart(2, "0")}:${Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, "0")}`;

export function MediaThumbnail({ asset }: { asset: Asset }) {
  const holder = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "60px" },
    );
    if (holder.current) observer.observe(holder.current);
    return () => observer.disconnect();
  }, []);
  const Icon =
    asset.kind === "audio"
      ? AudioLines
      : asset.kind === "image"
        ? ImageIcon
        : Film;
  const url =
    asset.thumbnailUrl ||
    (asset.kind === "image" ? asset.signedUrl : undefined);
  return (
    <span ref={holder} className={`vw-thumbnail vw-thumbnail-${asset.kind}`}>
      {!failed && url ? (
        <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : !failed && visible && asset.kind === "video" ? (
        <video
          src={asset.signedUrl}
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => {
            e.currentTarget.currentTime = Math.min(
              0.1,
              e.currentTarget.duration || 0,
            );
          }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon aria-hidden="true" />
      )}
    </span>
  );
}

export function WorkstationLibrary({
  assets,
  tracks,
  en,
  track,
  setTrack,
  onAdd,
  onUpload,
  onUploadSticker,
  onAddSticker,
  onImportLibrary,
  importNotice,
  uploading,
  fileInput,
  stickerFileInput,
  onRefresh,
  onCaption,
  versions,
  onRestore,
  mode,
  setMode,
  selectedClip,
  effectDuration,
  onEffectDuration,
  onApplyEffect,
}: {
  assets: EditorAsset[];
  en: boolean;
  tracks: EditorTrack[];
  track: string;
  setTrack: (track: string) => void;
  onAdd: (asset: EditorAsset) => void;
  onUpload: (file?: File) => void;
  onUploadSticker: (file?: File) => void;
  onAddSticker: (asset: EditorAsset) => void;
  onImportLibrary: (target?: "media" | "stickers") => void;
  importNotice: string;
  uploading: boolean;
  fileInput: RefObject<HTMLInputElement | null>;
  stickerFileInput: RefObject<HTMLInputElement | null>;
  onRefresh: () => void;
  onCaption: () => void;
  versions: Array<{ at: string; value: Timeline }>;
  onRestore: (value: Timeline) => void;
  mode: LibraryMode;
  setMode: (mode: LibraryMode) => void;
  selectedClip?: Clip;
  effectDuration: number;
  onEffectDuration: (value: number) => void;
  onApplyEffect: (patch: Partial<Clip>) => void;
}) {
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [limit, setLimit] = useState(24);
  const say = (zh: string, english: string) => (en ? english : zh);
  const modes = [
    { key: "media", icon: Film, label: say("素材", "Media") },
    { key: "stickers", icon: Sticker, label: say("贴纸", "Stickers") },
    { key: "text", icon: Type, label: say("文字", "Text") },
    { key: "audio", icon: Music2, label: say("音频", "Audio") },
    { key: "transitions", icon: ArrowRightLeft, label: say("转场", "Transitions") },
    { key: "filters", icon: SlidersHorizontal, label: say("滤镜", "Filters") },
    { key: "effects", icon: Sparkles, label: say("特效", "Effects") },
    { key: "history", icon: History, label: say("历史", "History") },
  ] as const;
  const filtered = assets.filter(
    (asset) =>
      (mode !== "audio" || asset.kind === "audio") &&
      (filter === "all" || asset.kind === filter) &&
      `${mediaName(asset, en)} ${asset.tags?.join(" ") || ""} ${asset.id}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  return (
    <div className="vw-browser">
      <nav
        className="vw-rail"
        aria-label={say("工作台工具", "Workstation tools")}
      >
        {modes.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            className={mode === key ? "active" : ""}
            aria-pressed={mode === key}
            onClick={() => {
              setMode(key);
              setFilter("all");
              setSearch("");
            }}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <aside className="vw-library">
        <div className="vw-panel-heading">
          <h2>
            {mode === "media"
              ? say("素材库", "Media library")
              : modes.find((m) => m.key === mode)?.label}
          </h2>
          <button
            className="vw-icon-button"
            title={say("刷新素材", "Refresh media")}
            aria-label={say("刷新素材", "Refresh media")}
            onClick={onRefresh}
          >
            <RefreshCw />
          </button>
        </div>
        <input
          ref={fileInput}
          hidden
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/wav,audio/flac"
          onChange={(e) => onUpload(e.target.files?.[0])}
        />
        {(mode === "transitions" || mode === "filters") && (
          <WorkstationEffectLibrary mode={mode} clip={selectedClip} en={en}
            duration={effectDuration} onDuration={onEffectDuration} onApply={onApplyEffect} />
        )}
        {mode === "effects" && (
          <WorkstationStyleEffects
            en={en}
            activePreset={selectedClip?.effectPreset ?? "normal"}
            disabled={!selectedClip || !["video", "overlay"].includes(selectedClip.track)}
            onSelect={(effectPreset) => onApplyEffect({ effectPreset: effectPreset as Clip["effectPreset"] })}
          />
        )}
        {mode === "stickers" && (
          <WorkstationStickers
            assets={assets}
            en={en}
            uploading={uploading}
            fileInput={stickerFileInput}
            onUpload={onUploadSticker}
            onImportLibrary={() => onImportLibrary("stickers")}
            onAdd={onAddSticker}
          />
        )}
        {(mode === "media" || mode === "audio") && (
          <>
            <div className="vw-import-actions">
              <button
                className="vw-upload"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                <Upload />
                {uploading
                  ? say("上传中…", "Uploading…")
                  : say("本地上传", "Upload file")}
              </button>
              <button className="vw-upload" onClick={() => onImportLibrary("media")}>
                <Library />
                {say("站内资产库", "Asset library")}
              </button>
            </div>
            {importNotice && (
              <p className="vw-import-notice" role="status">
                {importNotice}
              </p>
            )}
            <label className="vw-search">
              <Search />
              <input
                aria-label={say("搜索素材", "Search media")}
                placeholder={say("搜索素材", "Search media")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setLimit(24);
                }}
              />
              {search && (
                <button
                  aria-label={say("清除搜索", "Clear search")}
                  onClick={() => setSearch("")}
                >
                  <X />
                </button>
              )}
            </label>
            {mode === "media" && (
              <div
                className="vw-tabs"
                role="group"
                aria-label={say("素材分类", "Media type")}
              >
                {[
                  ["all", say("全部", "All")],
                  ["video", say("视频", "Video")],
                  ["image", say("图片", "Images")],
                  ["audio", say("音频", "Audio")],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    aria-pressed={filter === key}
                    className={filter === key ? "active" : ""}
                    onClick={() => {
                      setFilter(key);
                      setLimit(24);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="vw-library-count">
              <span>
                {filtered.length} {say("个素材", "items")}
              </span>
              <span>{say("点击添加到轨道", "Click to add")}</span>
            </div>
            <div className="vw-assets">
              {filtered.slice(0, limit).map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => onAdd(asset)}
                  title={`${say("加入时间线", "Add to timeline")} · ${mediaName(asset, en)}`}
                  className="vw-asset-card"
                >
                  <div className="vw-asset-image">
                    <MediaThumbnail asset={asset} />
                    <span className="vw-duration">
                      {asset.kind === "image"
                        ? say("图片", "Image")
                        : shortTime(asset.duration_ms)}
                    </span>
                    <span className="vw-add-icon">
                      <Plus />
                    </span>
                  </div>
                  <strong>{mediaName(asset, en)}</strong>
                  <small>
                    {asset.kind === "audio"
                      ? say("音频素材", "Audio source")
                      : `${asset.width || "—"} × ${asset.height || "—"}`}
                  </small>
                </button>
              ))}
            </div>
            {!filtered.length && (
              <div className="vw-empty-panel">
                <Search />
                <strong>{say("未找到素材", "No matching media")}</strong>
                <p>
                  {say(
                    "导入文件，或尝试其他关键词。",
                    "Import a file or try another search.",
                  )}
                </p>
              </div>
            )}
            {filtered.length > limit && (
              <button
                className="vw-load-more"
                onClick={() => setLimit((n) => n + 24)}
              >
                {say("显示更多", "Show more")}
              </button>
            )}
            <label className="vw-target-track">
              <span>{say("加入轨道", "Target track")}</span>
              <select
                value={track}
                onChange={(e) => setTrack(e.target.value as Track)}
              >
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || trackNames[t.kind][en ? 1 : 0]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {mode === "text" && (
          <div className="vw-text-tools">
            <div className="vw-text-sample">Aa</div>
            <h3>{say("让故事更清楚", "Give your story a voice")}</h3>
            <p>
              {say(
                "在播放头位置添加标题或字幕，再在右侧编辑文字与时长。",
                "Add a title at the playhead, then edit its text and timing in the inspector.",
              )}
            </p>
            <button
              className="vw-upload"
              onClick={onCaption}
              disabled={!assets.length}
            >
              <Plus />
              {say("添加字幕", "Add caption")}
            </button>
          </div>
        )}
        {mode === "history" && (
          <div className="vw-history-list">
            <p>
              {say(
                "自动保存的版本，可随时恢复。",
                "Restore an automatically saved version.",
              )}
            </p>
            {!versions.length && (
              <div className="vw-empty-panel">
                <History />
                <strong>{say("暂无历史版本", "No saved versions yet")}</strong>
              </div>
            )}
            {versions.map((v, i) => (
              <button key={`${v.at}-${i}`} onClick={() => onRestore(v.value)}>
                <History />
                <span>
                  <strong>
                    {new Date(v.at).toLocaleString(en ? "en-US" : "zh-CN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                  <small>
                    {v.value.clips.length} {say("个片段", "clips")} ·{" "}
                    {v.value.name}
                  </small>
                </span>
                <RotateCcw />
              </button>
            ))}
          </div>
        )}
        {["media", "text", "audio"].includes(mode) && (
          <div className="vw-ai-tools">
            <h3>{say("创作工具", "Creation tools")}</h3>
            {[
              {
                tool: "voiceover",
                href: "/?view=create&kind=tts",
                icon: Mic2,
                label: say("生成配音", "Create voiceover"),
              },
              {
                tool: "music",
                href: "/?view=assets",
                icon: Music2,
                label: say("上传配乐", "Upload music"),
              },
            ]
              .filter(() => mode !== "text")
              .map(({ tool, href, icon: Icon, label }) => (
                <a
                  key={tool}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon />
                  <span>{label}</span>
                  <Plus />
                </a>
              ))}
            <p>{say("字幕：使用顶部“导入 SRT”，或添加文字轨道。", "Captions: use Import SRT in the toolbar, or add a text track.")}</p>
          </div>
        )}
      </aside>
    </div>
  );
}

export function WorkstationInspector({
  tracks,
  clip,
  asset,
  en,
  onPatch,
  onCaption,
  onClose,
  effectDuration,
  onEffectDuration,
  focusRequest,
}: {
  clip?: Clip;
  asset?: Asset;
  en: boolean;
  tracks: EditorTrack[];
  onPatch: (patch: Partial<Clip>) => void;
  onCaption: () => void;
  onClose: () => void;
  effectDuration: number;
  onEffectDuration: (value: number) => void;
  focusRequest?: number;
}) {
  const capabilities = clip ? clipCapabilities(clip, asset) : {caption:false,visual:false,audio:false,audioUnknown:false};
  const preferredTab = capabilities.caption || capabilities.visual ? "picture" : capabilities.audio ? "audio" : "timing";
  const [requestedTab, setTab] = useState<"picture" | "color" | "audio" | "timing">(preferredTab);
  const tab = (requestedTab === "picture" && !(capabilities.caption || capabilities.visual)) ||
    (requestedTab === "color" && !capabilities.visual) || (requestedTab === "audio" && !capabilities.audio)
    ? preferredTab : requestedTab;
  const say = (zh: string, english: string) => (en ? english : zh);
  const blendNames = {
    normal: say("正常", "Normal"),
    screen: say("滤色", "Screen"),
    multiply: say("正片叠底", "Multiply"),
    overlay: say("叠加", "Overlay"),
    softlight: say("柔光", "Soft light"),
  };
  useEffect(() => {
    if (clip)
      setTab(preferredTab);
  }, [clip?.id, clip?.track, preferredTab]);
  useEffect(() => { if (focusRequest) setTab(preferredTab); }, [focusRequest, preferredTab]);
  const number = (
    key: "start" | "in" | "out" | "speed" | "volume" | "scale" | "x" | "y",
    label: string,
    min: number,
    max: number,
    factor = 1,
    suffix = "",
  ) =>
    clip && (
      <label className="vw-number-field">
        <span>{label}</span>
        <span className="vw-number-box">
          <input
            aria-label={label}
            type="number"
            min={min}
            max={max}
            step="any"
            value={Math.round(clip[key] * factor * 1000) / 1000}
            onChange={(e) => {
              if (e.target.value === "") return;
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= min && n <= max)
                onPatch({ [key]: n / factor });
            }}
          />
          {suffix && <small>{suffix}</small>}
        </span>
      </label>
    );
  return (
    <aside className="vw-inspector">
      <div className="vw-panel-heading">
        <h2>{say("片段属性", "Clip properties")}</h2>
        <button
          className="vw-icon-button"
          aria-label={say("取消选择", "Deselect clip")}
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {!clip ? (
        <div className="vw-empty-panel vw-inspector-empty">
          <SlidersHorizontal />
          <h3>{say("精调每一个镜头", "Fine-tune every shot")}</h3>
          <p>
            {say(
              "选择时间线中的片段，调整画面、声音和时间。",
              "Select a timeline clip to adjust its picture, audio and timing.",
            )}
          </p>
          <kbd>{say("点击片段以开始", "Select a clip to start")}</kbd>
        </div>
      ) : (
        <>
          <div className="vw-selected-media">
            {asset && <MediaThumbnail asset={asset} />}
            <div>
              <strong>
                {clip.track === "caption"
                  ? say("字幕 / 标题", "Caption / title")
                  : mediaName(asset, en)}
              </strong>
              <small>
                {trackNames[clip.track][en ? 1 : 0]} ·{" "}
                {(duration(clip) / 1000).toFixed(2)} s
              </small>
            </div>
          </div>
          <div
            className="vw-tabs vw-inspector-tabs"
            role="group"
            aria-label={say("属性分类", "Property group")}
          >
            {(
              [
                ...(capabilities.visual || capabilities.caption ? ([["picture", say("画面", "Picture")]] as const) : []),
                ...(capabilities.visual
                  ? ([["color", say("调色", "Color")]] as const)
                  : []),
                ...(capabilities.audio ? ([["audio", say("声音", "Audio")]] as const) : []),
                ["timing", say("时间", "Timing")],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={tab === key ? "active" : ""}
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "picture" && (
            <>
              {clip.track === "caption" && (
                <section className="vw-property-group">
                  <h3>
                    <Type />
                    {say("字幕文字", "Caption text")}
                  </h3>
                  <textarea
                    aria-label={say("字幕文字", "Caption")}
                    maxLength={1000}
                    value={clip.text}
                    onChange={(e) => onPatch({ text: e.target.value })}
                    placeholder={say("输入字幕内容", "Enter caption text")}
                  />
                  <CaptionAppearanceControls value={clip} onChange={onPatch} en={en} />
                  <p className="vw-help">{say("在画面中拖动字幕，方向键微调；预览字体以本机可用字体为准，导出使用所选字体。", "Drag captions in the canvas; use arrow keys to adjust. Preview fonts depend on this device; export uses the selected font.")}</p>
                  <div className="vw-field-pair">
                    <label>{say("水平位置", "Horizontal position")}<input aria-label={say("字幕水平位置", "Caption horizontal position")} type="range" min={0} max={100} value={clip.captionX ?? 50} onChange={e=>onPatch({captionX:Number(e.target.value),captionY:clip.captionY ?? 82})}/></label>
                    <label>{say("垂直位置", "Vertical position")}<input aria-label={say("字幕垂直位置", "Caption vertical position")} type="range" min={0} max={100} value={clip.captionY ?? 82} onChange={e=>onPatch({captionX:clip.captionX ?? 50,captionY:Number(e.target.value)})}/></label>
                  </div>
                  <button onClick={()=>onPatch({captionX:undefined,captionY:undefined})}>{say("重置字幕位置", "Reset caption position")}</button>
                </section>
              )}
              {clip.track !== "caption" && <details className="vw-property-group" open>
                <summary>
                  {say("画面变换", "Transform")}
                  <ChevronDown />
                </summary>
                {number(
                  "scale",
                  clip.track === "overlay" ? say("贴纸大小", "Sticker size") : say("画面放大", "Crop scale"),
                  clip.track === "overlay" ? 10 : 100,
                  300,
                  100,
                  "%",
                )}
                <div className="vw-field-pair">
                  {number(
                    "x",
                    say("水平位置", "Horizontal position"),
                    0,
                    100,
                    1,
                    "%",
                  )}{" "}
                  {number(
                    "y",
                    say("垂直位置", "Vertical position"),
                    0,
                    100,
                    1,
                    "%",
                  )}
                </div>
                <span className="vw-field-label">{say("画面适配", "Fit")}</span>
                <div className="vw-segmented">
                  {(["contain", "cover"] as const).map((fit) => (
                    <button
                      key={fit}
                      aria-pressed={clip.fit === fit}
                      onClick={() => onPatch({ fit })}
                    >
                      {clip.fit === fit && <Check />}
                      {fit === "contain"
                        ? say("适应", "Fit")
                        : say("填充", "Fill")}
                    </button>
                  ))}
                </div>
                {clip.track === "video" && (
                  <div className="vw-canvas-background">
                    <label>
                      {say("画布背景", "Canvas background")}
                      <select
                        aria-label={say("画布背景", "Canvas background")}
                        value={clip.canvasBackground ?? "black"}
                        onChange={(event) =>
                          onPatch({
                            canvasBackground: event.target.value as
                              | "black"
                              | "blur",
                          })
                        }
                      >
                        <option value="black">{say("纯黑", "Solid black")}</option>
                        <option value="blur">{say("模糊填充", "Blurred fill")}</option>
                      </select>
                    </label>
                    {clip.canvasBackground === "blur" && (
                      <label>
                        {say("背景暗化", "Background darkening")} ·{" "}
                        {Math.round((clip.canvasBackgroundDarkening ?? 0.25) * 100)}%
                        <input
                          aria-label={say("背景暗化", "Background darkening")}
                          type="range"
                          min="0"
                          max="0.6"
                          step="0.05"
                          value={clip.canvasBackgroundDarkening ?? 0.25}
                          onChange={(event) =>
                            onPatch({
                              canvasBackgroundDarkening: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                    )}
                    <p className="vw-help">
                      {say(
                        "模糊背景为预览近似效果，最终以导出为准。",
                        "Blurred background is an approximate preview; export is definitive.",
                      )}
                    </p>
                  </div>
                )}
                {clip.track === "overlay" && (
                  <div className="vw-canvas-background">
                    <label>
                      {say("混合模式", "Blend mode")}
                      <select
                        aria-label={say("混合模式", "Blend mode")}
                        value={clip.blendMode ?? "normal"}
                        onChange={(event) => onPatch({ blendMode: event.target.value as Clip["blendMode"] })}
                      >
                        {BLEND_MODES.map((mode) => (
                          <option key={mode} value={mode}>{blendNames[mode]}</option>
                        ))}
                      </select>
                    </label>
                    <p className="vw-help">
                      {say("修改时会同步当前相连转场组；预览为近似效果，最终以导出为准。", "Changes sync this connected transition group. Preview is approximate; export is definitive.")}
                    </p>
                  </div>
                )}
                <button
                  className="vw-reset"
                  onClick={() =>
                    onPatch({
                      scale: 1,
                      x: 50,
                      y: 50,
                      fit: "contain",
                      ...(clip.track === "video"
                        ? {
                            canvasBackground: "black",
                            canvasBackgroundDarkening: 0.25,
                          }
                        : {}),
                    })
                  }
                >
                  <RotateCcw />
                  {say("重置画面", "Reset transform")}
                </button>
              </details>}
              {clip.track !== "caption" && <section className="vw-property-group">
                <h3>{say("镜头衔接", "Transition")}</h3>
                <select
                  aria-label={say("转场", "Transition")}
                  value={clip.transition}
                  onChange={(e) =>
                    onPatch({
                      transition: e.target.value as Clip["transition"],
                    })
                  }
                >
                  <option value="cut">{say("直接切换", "Cut")}</option>
                  <option value="fade">
                    {say("淡入（旧版）", "Fade in (legacy)")}
                  </option>
                  {["video", "overlay"].includes(clip.track) &&
                    TRANSITIONS.map((type) => (
                      <option key={type} value={type}>
                        {
                          {
                            crossfade: say("交叉淡化", "Crossfade"),
                            dissolve: say("溶解", "Dissolve"),
                            wipeleft: say("向左擦除", "Wipe left"),
                            wiperight: say("向右擦除", "Wipe right"),
                            slideleft: say("向左滑动", "Slide left"),
                            slideup: say("向上滑动", "Slide up"),
                            zoomin: say("缩放进入", "Zoom in"),
                          }[type]
                        }
                      </option>
                    ))}
                </select>
                {["video", "overlay"].includes(clip.track) && (
                  <label>
                    {say("转场时长", "Transition duration")}
                    <select
                      aria-label={say("转场时长", "Transition duration")}
                      disabled={clip.transition === "fade"}
                      value={clip.transitionDuration ?? 500}
                      onChange={(e) => {
                        onEffectDuration(Number(e.target.value));
                        onPatch({ transitionDuration: Number(e.target.value) });
                      }}
                    >
                      {[300, 500, 750, 1000].map((ms) => (
                        <option key={ms} value={ms}>
                          {ms / 1000} s
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="vw-help">
                  {say(
                    "转场会重叠同轨相邻片段，同轨后续片段随之移动；其他轨道保留原位置。预览为近似效果，最终以导出为准。",
                    "Transitions overlap adjacent clips on this video or overlay lane. Other lanes keep their positions. Preview is approximate; export is definitive.",
                  )}
                </p>
              </section>}
            </>
          )}
          {tab === "color" && ["video", "overlay"].includes(clip.track) && (
            <section className="vw-property-group">
              <h3>{say("调色预设", "Color preset")}</h3>
              <select
                aria-label={say("调色预设", "Color preset")}
                value={clip.filterPreset ?? "normal"}
                onChange={(e) =>
                  onPatch({ filterPreset: e.target.value as Clip["filterPreset"] })
                }
              >
                {FILTER_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {{
                      normal: say("原色", "Original"),
                      warm: say("暖调", "Warm"),
                      cool: say("冷调", "Cool"),
                      cinematic: say("电影", "Cinematic"),
                      bw: say("黑白", "Black & white"),
                      vivid: say("鲜明", "Vivid"),
                    }[p]}
                  </option>
                ))}
              </select>
              <label>
                {say("风格特效", "Style effect")}
                <select
                  aria-label={say("风格特效", "Style effect")}
                  value={clip.effectPreset ?? "normal"}
                  onChange={(e) =>
                    onPatch({ effectPreset: e.target.value as Clip["effectPreset"] })
                  }
                >
                  {EFFECT_PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {{
                        normal: say("无特效", "No effect"),
                        glitch: say("故障色差", "Glitch"),
                        vhs: say("录像带", "VHS"),
                        oldfilm: say("老电影", "Old film"),
                        grain: say("胶片颗粒", "Film grain"),
                        bloom: say("柔光", "Bloom"),
                        neon: say("霓虹", "Neon"),
                      }[p]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="vw-help">
                {say(
                  "预览为近似效果，最终以导出为准。",
                  "Preview is approximate; export is definitive.",
                )}
              </p>
            </section>
          )}
          {tab === "picture" && clip.track !== "caption" && (
            <button className="vw-add-caption" onClick={onCaption}>
              <Type />
              {say("添加字幕", "Add caption")}
            </button>
          )}
          {tab === "audio" && capabilities.audio && (
            <section className="vw-property-group">
              {capabilities.audioUnknown && <p role="status" className="vw-help">{say("尚未确认视频是否含音轨；声音设置仅对已有音轨生效。", "This video's audio track has not been confirmed. Sound settings apply only if an audio track exists.")}</p>}
              <h3>
                <AudioLines />
                {say("音频调整", "Audio settings")}
              </h3>
              {number("volume", say("音量", "Volume"), 0, 200, 100, "%")}
              <EffectDuration value={effectDuration} onChange={onEffectDuration} en={en} />
              <button className="vw-upload" onClick={() => onPatch({
                audioFadeIn: effectDuration, audioFadeOut: effectDuration,
              })}>{say("应用到声音首尾", "Apply to both audio ends")}</button>
              {(["audioFadeIn", "audioFadeOut"] as const).map((key) => (
                <label key={key}>
                  {key === "audioFadeIn"
                    ? say("声音淡入", "Audio fade in")
                    : say("声音淡出", "Audio fade out")}
                  <select
                    aria-label={
                      key === "audioFadeIn"
                        ? say("声音淡入", "Audio fade in")
                        : say("声音淡出", "Audio fade out")
                    }
                    value={clip[key] ?? 0}
                    onChange={(e) => onPatch({ [key]: Number(e.target.value) })}
                  >
                    {[0, 300, 500, 750, 1000].map((ms) => (
                      <option key={ms} value={ms}>
                        {ms ? `${ms / 1000} s` : say("关闭", "Off")}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="vw-switch-row">
                <span>{say("静音", "Mute")}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={clip.muted}
                  onChange={(e) => onPatch({ muted: e.target.checked })}
                />
              </label>
              <p className="vw-help">
                {say(
                  "预览音量最高为 100%，更高增益在导出时生效。",
                  "Preview volume is capped at 100%. Additional gain applies to export.",
                )}
              </p>
            </section>
          )}
          {tab === "timing" && (
            <>
              <section className="vw-property-group">
                <h3>{say("片段时间", "Clip timing")}</h3>
                {number(
                  "start",
                  say("开始时间（秒）", "Start (seconds)"),
                  0,
                  86400,
                  0.001,
                  "s",
                )}
                <div className="vw-field-pair">
                  {number(
                    "in",
                    say("入点（秒）", "In (seconds)"),
                    0,
                    clip.out / 1000 - 0.01,
                    0.001,
                    "s",
                  )}
                  {number(
                    "out",
                    say("出点（秒）", "Out (seconds)"),
                    clip.in / 1000 + 0.01,
                    clip.track === "caption" || asset?.kind === "image"
                      ? 7200
                      : (asset?.duration_ms || 7200000) / 1000,
                    0.001,
                    "s",
                  )}
                </div>
              </section>
              <section className="vw-property-group">
                <h3>{say("播放速度", "Playback speed")}</h3>
                {number("speed", say("速度", "Speed"), 0.25, 4, 1, "×")}
                <div className="vw-speed-presets">
                  {[0.5, 1, 1.5, 2].map((speed) => (
                    <button
                      key={speed}
                      aria-pressed={clip.speed === speed}
                      onClick={() => onPatch({ speed })}
                    >
                      {speed}×
                    </button>
                  ))}
                </div>
              </section>
              <section className="vw-property-group">
                <h3>{say("轨道位置", "Track placement")}</h3>
                <select
                  aria-label={say("轨道", "Track")}
                  value={clipTrackId(clip)}
                  onChange={(e) =>
                    onPatch({
                      track: tracks.find((t) => t.id === e.target.value)!.kind,
                      trackId: e.target.value,
                    })
                  }
                >
                  {tracks.filter((t) => canPlaceClip(clip, t.kind, asset)).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name || trackNames[t.kind][en ? 1 : 0]}
                    </option>
                  ))}
                </select>
              </section>
            </>
          )}
        </>
      )}
    </aside>
  );
}
