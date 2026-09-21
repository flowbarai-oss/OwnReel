"use client";
import { useEffect, useRef, useState } from "react";
import { Library, Search, X, Check, Eye, Loader2 } from "lucide-react";
import { api, readableError, type Asset, type AssetPage } from "@/lib/api";
import { MediaThumbnail, mediaName } from "./WorkstationPanels";

export function WorkstationAssetImport({
  projectId,
  en,
  importedIds,
  initialKind = "all",
  onImported,
  onClose,
}: {
  projectId: string;
  en: boolean;
  importedIds: string[];
  initialKind?: "all" | "image";
  onImported: (assets: Asset[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState<string>(initialKind),
    [offset, setOffset] = useState(0),
    [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<AssetPage>({
      items: [],
      total: 0,
      nextOffset: null,
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [selected, setSelected] = useState<Asset[]>([]),
    [preview, setPreview] = useState<Asset>(),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0);
  const panel = useRef<HTMLElement>(null),
    lock = useRef(false);
  const say = (zh: string, english: string) => (en ? english : zh);
  const imported = new Set(importedIds);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        paginated: "1",
        q: query.trim(),
        sort: "newest",
        limit: "24",
        offset: String(offset),
      });
      if (kind !== "all") params.set("kind", kind);
      void api<AssetPage>(`/api/v1/assets?${params}`, {
        signal: controller.signal,
      })
        .then((result) => {
          if (!controller.signal.aborted) setPage(result);
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(readableError(e, en ? "en" : "zh-CN"));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, kind, offset, attempt, en]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => previous?.focus();
  }, []);
  async function importSelected() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setProgress(0);
    const pending = selected.filter((a) => !imported.has(a.id)),
      succeeded: Asset[] = [],
      failed: Asset[] = [];
    let lastError = "";
    for (const asset of pending) {
      try {
        await api(`/api/v1/projects/${encodeURIComponent(projectId)}/assets`, {
          method: "POST",
          body: JSON.stringify({ assetId: asset.id }),
        });
        succeeded.push(asset);
      } catch (e) {
        failed.push(asset);
        lastError = readableError(e, en ? "en" : "zh-CN");
      }
      setProgress(succeeded.length + failed.length);
    }
    if (succeeded.length) onImported(succeeded);
    setSelected(failed);
    lock.current = false;
    setBusy(false);
    if (failed.length)
      setError(
        `${say("未能导入", "Could not import")} ${failed.length} ${say("个素材。已成功导入", "items. Imported")} ${succeeded.length}。${lastError}`,
      );
    else onClose();
  }
  return (
    <div
      className="vw-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="vw-asset-import"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vw-import-title"
        tabIndex={-1}
        ref={panel}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            if (!busy) onClose();
          }
          if (e.key === "Tab") {
            const nodes = [
              ...panel.current!.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input:not(:disabled),select:not(:disabled),audio[controls],video[controls]",
              ),
            ].filter((el) => el.getClientRects().length);
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === panel.current)
            ) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <div>
            <h2 id="vw-import-title">
              <Library />
              {say("从站内资产库导入", "Import from asset library")}
            </h2>
            <p>
              {say(
                "选择已有的视频、图片或音频，加入当前项目。",
                "Choose existing videos, images or audio for this project.",
              )}
            </p>
          </div>
          <button
            aria-label={say("关闭资产库", "Close asset library")}
            disabled={busy}
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <div className="vw-import-filters">
          <label className="vw-search">
            <Search />
            <input
              aria-label={say("搜索站内资产", "Search library assets")}
              placeholder={say("搜索名称或关键词", "Search names or keywords")}
              value={query}
              disabled={busy}
              onChange={(e) => {
                setQuery(e.target.value);
                setOffset(0);
              }}
            />
          </label>
          <select
            aria-label={say("站内资产类型", "Library asset type")}
            value={kind}
            disabled={busy}
            onChange={(e) => {
              setKind(e.target.value);
              setOffset(0);
            }}
          >
            {[
              ["all", say("全部类型", "All types")],
              ["video", say("视频", "Video")],
              ["image", say("图片", "Image")],
              ["audio", say("音频", "Audio")],
            ].map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <div className="vw-import-error" role="alert">
            {error}
            <button disabled={busy} onClick={() => setAttempt((n) => n + 1)}>
              {say("重新加载", "Reload")}
            </button>
          </div>
        )}
        <div className={`vw-import-body${preview ? " has-preview" : ""}`}>
          <div className="vw-import-results" aria-busy={loading}>
            {loading ? (
              <p role="status">
                <Loader2 className="vw-spinning" />
                {say("正在加载资产…", "Loading assets…")}
              </p>
            ) : page.items.length ? (
              <div className="vw-import-grid">
                {page.items.map((asset) => {
                  const checked = selected.some((a) => a.id === asset.id),
                    exists = imported.has(asset.id);
                  return (
                    <article key={asset.id}>
                      <button
                        className={`vw-import-card${checked ? " selected" : ""}`}
                        aria-pressed={checked}
                        aria-label={`${say("选择素材", "Select asset")} ${mediaName(asset, en)}`}
                        disabled={
                          busy || exists || (!checked && selected.length >= 100)
                        }
                        onClick={() =>
                          setSelected((items) =>
                            checked
                              ? items.filter((a) => a.id !== asset.id)
                              : [...items, asset],
                          )
                        }
                      >
                        <div className="vw-import-thumbnail">
                          <MediaThumbnail asset={asset} />
                          <span className="vw-import-check">
                            {(checked || exists) && <Check />}
                          </span>
                          {exists && (
                            <small>{say("已在项目中", "In project")}</small>
                          )}
                        </div>
                        <strong>{mediaName(asset, en)}</strong>
                        <small>
                          {asset.kind === "audio"
                            ? say("音频", "Audio")
                            : `${asset.width || "—"} × ${asset.height || "—"}`}
                          {asset.duration_ms
                            ? ` · ${(asset.duration_ms / 1000).toFixed(1)}s`
                            : ""}
                        </small>
                      </button>
                      <button
                        className="vw-import-preview-button"
                        aria-label={`${say("预览素材", "Preview asset")} ${mediaName(asset, en)}`}
                        onClick={() => setPreview(asset)}
                      >
                        <Eye />
                        {say("预览", "Preview")}
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="vw-empty-panel">
                <Library />
                <strong>
                  {say("没有符合条件的素材", "No matching assets")}
                </strong>
                <p>
                  {say(
                    "尝试其他关键词，或先在站内创作并保存素材。",
                    "Try another search or create and save assets in GEN first.",
                  )}
                </p>
              </div>
            )}
          </div>
          {preview && (
            <aside className="vw-import-preview">
              <div>
                <strong>{mediaName(preview, en)}</strong>
                <button
                  aria-label={say("关闭素材预览", "Close asset preview")}
                  onClick={() => setPreview(undefined)}
                >
                  <X />
                </button>
              </div>
              {preview.kind === "image" ? (
                <img src={preview.signedUrl} alt={mediaName(preview, en)} />
              ) : preview.kind === "video" ? (
                <video
                  key={preview.id}
                  src={preview.signedUrl}
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : (
                <audio
                  key={preview.id}
                  src={preview.signedUrl}
                  controls
                  preload="metadata"
                />
              )}
            </aside>
          )}
        </div>
        <div className="vw-import-pagination">
          <button
            disabled={busy || loading || offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 24))}
          >
            {say("上一页", "Previous")}
          </button>
          <span>
            {page.total ? offset + 1 : 0}–{offset + page.items.length} /{" "}
            {page.total} {say("个素材", "items")}
          </span>
          <button
            disabled={busy || loading || page.nextOffset === null}
            onClick={() => setOffset(page.nextOffset!)}
          >
            {say("下一页", "Next")}
          </button>
        </div>
        <footer>
          <span role="status">
            {busy
              ? `${say("导入中", "Importing")} ${progress}/${selected.length}`
              : `${say("已选择", "Selected")} ${selected.length} / 100`}
          </span>
          <button
            disabled={busy || !selected.length}
            onClick={() => setSelected([])}
          >
            {say("清空选择", "Clear selection")}
          </button>
          <button disabled={busy} onClick={onClose}>
            {say("取消", "Cancel")}
          </button>
          <button
            className="vw-export-trigger"
            disabled={busy || !selected.length}
            onClick={() => void importSelected()}
          >
            {busy ? <Loader2 className="vw-spinning" /> : <Library />}
            {say("导入到项目", "Import to project")}
            {!busy && ` (${selected.length})`}
          </button>
        </footer>
      </section>
    </div>
  );
}
