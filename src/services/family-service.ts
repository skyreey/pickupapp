// ============================================================
// 家庭共享服务 — 成员管理 + 包裹分配
// ============================================================
import type { FamilyMember } from '../models';

const STORAGE_KEY = 'family_members';
const FAMILY_COLORS = ['#FF6B35', '#34C759', '#007AFF', '#FF9500', '#AF52DE', '#FF2D55', '#FFCC00', '#00C7BE'];

let cached: FamilyMember[] | null = null;

/** 获取所有家庭成员 */
export async function getMembers(): Promise<FamilyMember[]> {
  if (cached) return cached;
  try {
    const { getSetting } = require('../../modules/expo-notification-reader');
    const json = await getSetting(STORAGE_KEY);
    cached = json ? JSON.parse(json) : [];
    return cached!;
  } catch { return []; }
}

/** 添加成员 */
export async function addMember(name: string): Promise<FamilyMember> {
  const members = await getMembers();
  const usedColors = new Set(members.map(m => m.color));
  const color = FAMILY_COLORS.find(c => !usedColors.has(c)) || FAMILY_COLORS[members.length % FAMILY_COLORS.length];
  const member: FamilyMember = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    color,
  };
  members.push(member);
  await saveMembers(members);
  return member;
}

/** 删除成员 */
export async function removeMember(id: string): Promise<void> {
  const members = (await getMembers()).filter(m => m.id !== id);
  await saveMembers(members);
}

async function saveMembers(members: FamilyMember[]): Promise<void> {
  cached = members;
  try {
    const { setSetting } = require('../../modules/expo-notification-reader');
    await setSetting(STORAGE_KEY, JSON.stringify(members));
  } catch {}
}

/** 根据ID找成员 */
export function findMember(id: string | null | undefined, members: FamilyMember[]): FamilyMember | null {
  if (!id) return null;
  return members.find(m => m.id === id) || null;
}
