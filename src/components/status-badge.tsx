import type { TestStepStatus } from "@/lib/test-types";

const MAP: Record<TestStepStatus | "verified-true" | "verified-false", { label: string; cls: string }> = {
  pass: { label: "PASS", cls: "bg-green-100 text-green-800" },
  fail: { label: "FAIL", cls: "bg-red-100 text-red-800" },
  skip: { label: "SKIP", cls: "bg-gray-100 text-gray-600" },
  idle: { label: "—", cls: "bg-gray-100 text-gray-500" },
  running: { label: "…", cls: "bg-amber-100 text-amber-800 animate-pulse" },
  "verified-true": { label: "مؤكد ✓", cls: "bg-green-100 text-green-800" },
  "verified-false": { label: "غير مؤكد", cls: "bg-amber-100 text-amber-800" },
};

export function StatusBadge({ status }: { status: TestStepStatus | "verified-true" | "verified-false" }) {
  const m = MAP[status] ?? MAP.idle;
  return (
    <span className={`inline-flex min-w-14 justify-center rounded-full px-2.5 py-1 text-xs font-bold tracking-wide ${m.cls}`} dir="ltr">
      {m.label}
    </span>
  );
}
