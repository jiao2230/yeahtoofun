export type SlotConflict = 'exact' | 'prefix' | 'overlap' | null;

/**
 * 两个词槽的相似度判定：
 * - exact: 完全相同
 * - prefix: 首字相同（紫极/紫霄、太上/太初、玄阴/玄关）
 * - overlap: 其他位置共享字
 */
export function slotConflict(a: string | null | undefined, b: string | null | undefined): SlotConflict {
  if (!a || !b) return null;
  if (a === b) return 'exact';
  if (a[0] === b[0]) return 'prefix';
  const left = new Set(Array.from(a));
  return Array.from(b).some((char) => left.has(char)) ? 'overlap' : null;
}

export function slotPenalty(conflict: SlotConflict): number {
  if (conflict === 'exact') return 0.2;
  if (conflict === 'prefix') return 0.15;
  if (conflict === 'overlap') return 0.06;
  return 0;
}

export function isBlockedConflict(conflict: SlotConflict): boolean {
  return conflict === 'exact' || conflict === 'prefix';
}
