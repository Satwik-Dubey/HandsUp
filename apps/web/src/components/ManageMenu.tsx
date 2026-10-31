"use client";

import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { ManageResult } from "@/app/(teacher)/actions";

/** The "more" menu on a course or lecture page: rename (with an optional second field, the course term) and delete. */
export function ManageMenu({
  what,
  name,
  extra,
  rename,
  remove,
  deleteWarning,
  afterDelete,
}: {
  what: "course" | "lecture";
  name: string;
  /** A second field shown in the rename form, e.g. the course term. */
  extra?: { label: string; value: string; placeholder?: string };
  rename: (name: string, extra: string) => Promise<ManageResult>;
  remove: () => Promise<ManageResult>;
  deleteWarning: string;
  afterDelete: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function save(fd: FormData) {
    setError(null);
    start(async () => {
      const r = await rename(String(fd.get("name") ?? ""), String(fd.get("extra") ?? ""));
      if (!r.ok) return setError(r.error);
      setEditing(false);
      router.refresh();
    });
  }

  function del() {
    setOpen(false);
    if (!window.confirm(`Delete “${name}”? ${deleteWarning} This can't be undone.`)) return;
    start(async () => {
      const r = await remove();
      if (!r.ok) return window.alert(r.error);
      router.push(afterDelete);
    });
  }

  return (
    <div ref={box} className="relative">
      <button className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-soft" aria-label={`Manage this ${what}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Ellipsis size={20} strokeWidth={2.25} />
      </button>
      {open && (
        <div className="card absolute right-0 z-30 mt-2 flex w-48 flex-col p-1.5" role="menu">
          <button
            role="menuitem"
            className="flex items-center gap-2 rounded-2xl px-3 py-2 text-left hover:bg-paper"
            onClick={() => {
              setOpen(false);
              setEditing(true);
            }}
          >
            <Pencil size={16} strokeWidth={2.25} /> Rename
          </button>
          <button role="menuitem" className="flex items-center gap-2 rounded-2xl px-3 py-2 text-left text-coral hover:bg-paper" onClick={del} disabled={pending}>
            <Trash2 size={16} strokeWidth={2.25} /> Delete {what}
          </button>
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && setEditing(false)}>
          <form action={save} className="card flex w-full max-w-md flex-col gap-4 p-6">
            <h2 className="text-2xl font-semibold">Rename {what}</h2>
            <label className="flex flex-col gap-1">
              <span className="label">{what === "course" ? "Course name" : "Lecture title"}</span>
              <input name="name" className="field" defaultValue={name} autoFocus required minLength={2} maxLength={160} />
            </label>
            {extra && (
              <label className="flex flex-col gap-1">
                <span className="label">{extra.label}</span>
                <input name="extra" className="field" defaultValue={extra.value} placeholder={extra.placeholder} maxLength={40} />
              </label>
            )}
            {error && <p className="text-sm text-coral">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="pill-ghost" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="pill" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
