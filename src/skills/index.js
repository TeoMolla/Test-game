/**
 * skills/index.js — Public interface of the skill system.
 *
 * Responsibilities:
 *   - report which skill slots a hero has unlocked (star rank + rarity gates)
 *   - resolve a loadout into concrete skill objects
 *
 * Applying a skill's effects to units is the battle engine's job
 * (battle/engine.js) — this module stays free of combat state so skills can be
 * inspected from the roster UI without spinning up a battle.
 */

import { SKILLS, getSkill } from './skills.js';
import { SKILL_SLOT_UNLOCK, SKILL_SLOTS, RESERVED_SLOTS, rarityOf } from '../config.js';

export { SKILLS, getSkill };

/** Star rank required for a slot, or null if the slot can never unlock. */
export function slotRequirement(slot, rarityId) {
  if (RESERVED_SLOTS.includes(slot)) return null; // transformation — future pass
  if (slot === 'passive' && !rarityOf(rarityId).hasPassive) return null;
  const req = SKILL_SLOT_UNLOCK[slot];
  return req === undefined ? null : req;
}

export function isSlotUnlocked(slot, rarityId, star) {
  const req = slotRequirement(slot, rarityId);
  return req !== null && star >= req;
}

/**
 * Human-readable reason a slot is locked, for the Stars tab.
 */
export function slotLockLabel(slot, rarityId) {
  if (RESERVED_SLOTS.includes(slot)) return 'Future';
  if (slot === 'passive' && !rarityOf(rarityId).hasPassive) return 'Epic+';
  const req = slotRequirement(slot, rarityId);
  return req === null ? '—' : `${req}★`;
}

/**
 * Every slot for a hero with its skill + lock state. Drives the Stars tab and
 * the skills list, and is also what the battle engine filters on.
 */
export function loadoutSlots(loadout, rarityId, star) {
  return SKILL_SLOTS.map((slot) => {
    const skill = loadout && loadout[slot] ? getSkill(loadout[slot]) : null;
    const requirement = slotRequirement(slot, rarityId);
    return {
      slot,
      skill,
      requirement,
      unlocked: requirement !== null && star >= requirement && !!skill,
      lockLabel: slotLockLabel(slot, rarityId),
      reserved: RESERVED_SLOTS.includes(slot),
    };
  });
}

/** The skills a unit can actually use in combat right now. */
export function activeSkills(loadout, rarityId, star) {
  const out = { attack: null, technique: null, ultimate: null, passive: null };
  for (const entry of loadoutSlots(loadout, rarityId, star)) {
    if (entry.unlocked && entry.slot in out) out[entry.slot] = entry.skill;
  }
  return out;
}
