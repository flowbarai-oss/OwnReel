"use client";

import { ImageIcon, Library, Plus, Upload } from "lucide-react";
import type { RefObject } from "react";
import type { Asset } from "@/lib/api";

type StickerAsset = Asset & { sourceKind?: "upload" };

export function WorkstationStickers({
  assets,
  en,
  uploading,
  fileInput,
  onUpload,
  onImportLibrary,
  onAdd,
}: {
  assets: StickerAsset[];
  en: boolean;
  uploading: boolean;
  fileInput: RefObject<HTMLInputElement | null>;
  onUpload: (file?: File) => void;
  onImportLibrary: () => void;
  onAdd: (asset: StickerAsset) => void;
}) {
  const say = (zh: string, english: string) => (en ? english : zh);
  const images = assets.filter((asset) => asset.kind === "image");
  const name = (asset: Asset) => asset.tags?.[0] || `${say("图片", "Image")} ${asset.id.slice(0, 6)}`;
  return (
    <section className="vw-stickers" aria-label={say("贴纸", "Stickers")}>
      <input
        ref={fileInput}
        hidden
        type="file"
        accept="image/png"
        onChange={(event) => onUpload(event.target.files?.[0])}
      />
      <div className="vw-import-actions">
        <button className="vw-upload" disabled={uploading} onClick={() => fileInput.current?.click()}>
          <Upload />
          {uploading ? say("上传中…", "Uploading…") : say("上传 PNG", "Upload PNG")}
        </button>
        <button className="vw-upload" onClick={onImportLibrary}>
          <Library />
          {say("站内资产库", "Asset library")}
        </button>
      </div>
      <p className="vw-sticker-help">
        {say(
          "仅支持 5MB 内 PNG；超过 2048px 会自动缩小。透明区域会保留；不含透明通道的 PNG 会按原有不透明像素显示。",
          "PNG only, up to 5 MB. Images over 2048px are reduced automatically. Transparency is preserved; PNGs without alpha keep their original opaque pixels.",
        )}
      </p>
      {images.length ? (
        <div className="vw-media-grid vw-sticker-grid">
          {images.map((asset) => (
            <button
              type="button"
              className="vw-media-card"
              key={asset.id}
              onClick={() => onAdd(asset)}
              aria-label={`${say("添加贴纸", "Add sticker")} ${name(asset)}`}
            >
              <span className="vw-thumbnail vw-thumbnail-image"><img src={asset.thumbnailUrl || asset.signedUrl} alt="" loading="lazy" /></span>
              <span>
                <strong>{name(asset)}</strong>
                <small><Plus />{say("添加到叠加轨", "Add to overlay")}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="vw-empty-panel">
          <ImageIcon />
          <strong>{say("还没有图片贴纸", "No image stickers yet")}</strong>
          <p>{say("上传 PNG，或从站内资产库导入图片。", "Upload a PNG or import an image from your asset library.")}</p>
        </div>
      )}
    </section>
  );
}
