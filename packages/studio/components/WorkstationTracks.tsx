"use client";
import { useState, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { TRACKS, type EditorTrack, type Track } from "@/lib/video-timeline";
import { trackNames, trackIcons } from "./WorkstationPanels";

export function AddWorkstationTrack({
  en,
  disabled,
  onAdd,
}: {
  en: boolean;
  disabled: boolean;
  onAdd: (kind: Track, name: string) => void;
}) {
  const [kind, setKind] = useState<Track>("video"),
    [name, setName] = useState("");
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <details className="vw-add-track-menu" ref={menu}>
      <summary>
        <Plus />
        {en ? "Add track" : "添加轨道"}
      </summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (disabled) return;
          onAdd(kind, name.trim());
          setName("");
          if (menu.current) menu.current.open = false;
        }}
      >
        <label>
          {en ? "Track type" : "轨道类型"}
          <select
            aria-label={en ? "New track type" : "新轨道类型"}
            value={kind}
            onChange={(e) => setKind(e.target.value as Track)}
          >
            {TRACKS.map((t) => (
              <option value={t} key={t}>
                {t === "voice"
                  ? en
                    ? "Audio / voice"
                    : "音频 / 配音"
                  : trackNames[t][en ? 1 : 0]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {en ? "Name (optional)" : "名称（可选）"}
          <input
            aria-label={en ? "New track name" : "新轨道名称"}
            value={name}
            maxLength={60}
            placeholder={trackNames[kind][en ? 1 : 0]}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p>
          {disabled
            ? en
              ? "Up to 32 tracks per project."
              : "每个项目最多支持 32 条轨道。"
            : en
              ? "Multiple tracks can use the same type."
              : "同一种类型可添加多条轨道。"}
        </p>
        <button type="submit" disabled={disabled}>
          <Plus />
          {en ? "Create track" : "创建轨道"}
        </button>
      </form>
    </details>
  );
}

export function WorkstationTrackHeading({
  track,
  en,
  selected,
  occupied,
  onSelect,
  onRename,
  onDelete,
}: {
  track: EditorTrack;
  en: boolean;
  selected: boolean;
  occupied: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const name = track.name || trackNames[track.kind][en ? 1 : 0],
    Icon = trackIcons[track.kind];
  return (
    <div className="vw-track-heading">
      <Icon />
      <input
        key={name}
        aria-label={`${en ? "Track name" : "轨道名称"} · ${name}`}
        title={en ? "Edit track name" : "编辑轨道名称"}
        defaultValue={name}
        maxLength={60}
        onBlur={(e) => {
          const next = e.target.value.trim();
          if (next && next !== name) onRename(next);
          else e.target.value = name;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = name;
            e.currentTarget.blur();
          }
        }}
      />
      <button
        aria-label={`${en ? "Select track" : "选择轨道"} ${name}`}
        aria-pressed={selected}
        title={en ? "Add media to this track" : "将素材添加到此轨道"}
        onClick={onSelect}
      >
        <Plus />
      </button>
      <button
        aria-label={`${en ? "Delete track" : "删除轨道"} ${name}`}
        title={
          occupied
            ? en
              ? "Move or delete clips first"
              : "请先移动或删除轨道中的片段"
            : en
              ? "Delete empty track"
              : "删除空轨道"
        }
        disabled={occupied}
        onClick={onDelete}
      >
        <Trash2 />
      </button>
    </div>
  );
}
