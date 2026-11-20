export const LIT_KEY = 'zqm-birthday-lit-v1';

export function loadLit(storage) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(LIT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((name) => typeof name === 'string');
  } catch {
    return [];
  }
}

export function saveLit(storage, names) {
  if (!storage) return;
  try {
    storage.setItem(LIT_KEY, JSON.stringify(names));
  } catch {
    // localStorage 不可用时静默降级
  }
}

export function clearLit(storage) {
  if (!storage) return;
  try {
    storage.removeItem(LIT_KEY);
  } catch {
    // localStorage 不可用时静默降级
  }
}
