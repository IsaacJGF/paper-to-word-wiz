const SEL_KEY = "digitalizador.selecionadas";

export function loadSelectedQuestionIds(): string[] {
  return uniqueIds([
    ...readIdsFromUrl(),
    ...readIdsFromStorage(sessionStorage),
    ...readIdsFromStorage(localStorage),
  ]);
}

export function saveSelectedQuestionIds(ids: string[]) {
  const normalized = uniqueIds(ids);
  writeIdsToStorage(localStorage, normalized);
  writeIdsToStorage(sessionStorage, normalized);
}

function readIdsFromUrl() {
  try {
    const raw = new URLSearchParams(window.location.search).get("ids");
    return raw ? parseIds(raw) : [];
  } catch {
    return [];
  }
}

function readIdsFromStorage(storage: Storage) {
  try {
    return parseIds(JSON.parse(storage.getItem(SEL_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function writeIdsToStorage(storage: Storage, ids: string[]) {
  try {
    storage.setItem(SEL_KEY, JSON.stringify(ids));
  } catch {}
}

function parseIds(value: unknown) {
  if (Array.isArray(value)) return value.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  if (typeof value === "string") return value.split(",").map((id) => id.trim()).filter(Boolean);
  return [];
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}
