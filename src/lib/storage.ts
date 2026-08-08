import { emptyProfile } from "@/lib/tax/calculate";
import { sanitizeProfile } from "@/lib/tax/sanitize";
import type { TaxProfile } from "@/lib/tax/types";

const STORAGE_KEY = "tax-maxxing:profile:v1";

export function loadProfile(): TaxProfile {
  if (typeof window === "undefined") return emptyProfile();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw) as TaxProfile;
    if (parsed?.version !== 1) return emptyProfile();
    return sanitizeProfile({
      ...emptyProfile(parsed.taxYear),
      ...parsed,
      version: 1,
    });
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(profile: TaxProfile) {
  const next = sanitizeProfile({
    ...profile,
    updatedAt: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

function filenameSlug(name: string) {
  const slug = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "tax-maxxing";
}

export function exportProfileJson(profile: TaxProfile) {
  const clean = sanitizeProfile(profile);
  const blob = new Blob([JSON.stringify(clean, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameSlug(clean.name)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseProfileJson(text: string): TaxProfile {
  const parsed = JSON.parse(text) as TaxProfile;
  if (parsed?.version !== 1) {
    throw new Error("รูปแบบไฟล์ไม่รองรับ (ต้องการ version: 1)");
  }
  return sanitizeProfile({
    ...emptyProfile(parsed.taxYear ?? 2568),
    ...parsed,
    version: 1,
  });
}
