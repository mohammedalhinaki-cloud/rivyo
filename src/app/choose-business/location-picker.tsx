"use client";

import { useState } from "react";
import type { PickerGroup } from "./page";
import { RawJson } from "@/components/ui";

export function LocationPicker({ groups }: { groups: PickerGroup[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalLocations = groups.reduce((n, g) => n + g.locations.length, 0);
  const selectedGroup = groups.find((g) => g.locations.some((l) => l.name === selected));
  const selectedLocation = selectedGroup?.locations.find((l) => l.name === selected) ?? null;

  async function save() {
    if (!selectedLocation || !selectedGroup) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/business/select", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // اسم الحساب من مسار الموقع (accounts/{id})
          accountName: selectedLocation.name.split("/locations/")[0],
          locationName: selectedLocation.name,
          displayName: selectedLocation.title,
          address: selectedLocation.address,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      window.location.href = "/reviews";
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (totalLocations === 0) {
    return (
      <div className="card mt-6 border-amber-200 bg-amber-50 p-5">
        <h2 className="font-extrabold text-amber-900">لا توجد مواقع في حساباتك</h2>
        <p className="mt-1 text-sm leading-relaxed text-amber-800">
          حساب Google متصل، لكن لا يوجد أي نشاط تجاري (Business Profile) في حساباته. أنشئ أو اطلب إدارة نشاط
          تجاري على Google Business Profile ثم أعد المحاولة.
        </p>
        {groups.some((g) => g.errorPayload) && (
          <div className="mt-3">
            <p className="text-sm font-bold text-amber-900">تفاصيل أخطاء Google أثناء جلب المواقع:</p>
            {groups
              .filter((g) => g.errorPayload)
              .map((g) => (
                <RawJson key={g.accountName} data={g.errorPayload} label={`حساب: ${g.accountName}`} />
              ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6 pb-28">
      {groups.map((g) => (
        <section key={g.accountName} className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="font-bold">{g.accountName}</h2>
            {g.accountType && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-black/50">{g.accountType}</span>
            )}
          </div>
          {g.errorPayload ? (
            <div className="card border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-800">تعذّر جلب مواقع هذا الحساب — رسالة Google الأصلية:</p>
              <RawJson data={g.errorPayload} />
            </div>
          ) : g.locations.length === 0 ? (
            <p className="text-sm text-black/50">لا مواقع في هذا الحساب.</p>
          ) : (
            <div className="space-y-2">
              {g.locations.map((l) => {
                const active = selected === l.name;
                return (
                  <button
                    key={l.name}
                    type="button"
                    onClick={() => setSelected(l.name)}
                    className={`w-full rounded-2xl border-2 p-4 text-right transition ${
                      active
                        ? "border-brand-600 bg-brand-50 shadow-sm"
                        : "border-black/5 bg-white hover:border-brand-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold">{l.title}</span>
                      <span
                        className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          active ? "border-brand-600 bg-brand-600" : "border-black/20"
                        }`}
                        aria-hidden
                      >
                        {active && (
                          <svg viewBox="0 0 12 12" className="size-3 fill-white">
                            <path d="M2.5 6.5l2.2 2.2L9.5 3.9 8.4 2.8 4.7 6.5 3.6 5.4z" />
                          </svg>
                        )}
                      </span>
                    </div>
                    {l.address && <p className="mt-1 text-sm text-black/55">{l.address}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ))}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {/* شريط الحفظ الثابت للجوال */}
      <div className="fixed inset-x-0 bottom-0 border-t border-black/5 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              {selectedLocation ? selectedLocation.title : "لم تختر نشاطًا بعد"}
            </p>
            {selectedLocation?.address && (
              <p className="truncate text-xs text-black/50">{selectedLocation.address}</p>
            )}
          </div>
          <button type="button" className="btn-primary shrink-0" disabled={!selected || saving} onClick={save}>
            {saving ? "جارٍ الحفظ…" : "متابعة"}
          </button>
        </div>
      </div>
    </div>
  );
}
