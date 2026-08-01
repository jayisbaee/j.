// riggedLuck.js
//
// Hidden per-user luck override, set only through the owner-only /luck command.
// Stored directly on the user's economy record under an unremarkable key
// (`_sysFlag`) so it never surfaces in /balance, /inventory, or any other
// user-facing display — those commands only ever read specific known fields
// (wallet, bank, inventory, xp, etc.), never dump the raw record.

export const LUCK_MODES = ['off', 'boosted', 'insane'];

const BOOST_WIN_BONUS = 0.35; // added on top of a game's normal win chance
const BOOSTED_MAX_CHANCE = 0.97;

/**
 * Reads the active rig, if any, honoring optional expiry.
 * Returns null when there's no active override (including 'off' or expired).
 */
export function getRiggedLuck(userData) {
  const rig = userData?._sysFlag;
  if (!rig || !LUCK_MODES.includes(rig.mode) || rig.mode === 'off') {
    return null;
  }
  if (rig.expiresAt && Date.now() > rig.expiresAt) {
    return null;
  }
  return rig;
}

/** Adjusts a base win-chance (0-1) for gambling-style commands. */
export function applyRiggedWinChance(userData, baseWinChance) {
  const rig = getRiggedLuck(userData);
  if (!rig) return baseWinChance;
  if (rig.mode === 'insane') return 1;
  if (rig.mode === 'boosted') return Math.min(BOOSTED_MAX_CHANCE, baseWinChance + BOOST_WIN_BONUS);
  return baseWinChance;
}

/** Whether a card/dice-based game should be forced to a win outright. */
export function shouldForceWin(userData) {
  return getRiggedLuck(userData)?.mode === 'insane';
}

/** Whether a card/dice-based game should get a soft advantage (e.g. re-deal bad hands). */
export function shouldBoost(userData) {
  return getRiggedLuck(userData)?.mode === 'boosted';
}

/** Sets or clears the rig on a userData object. Caller is responsible for persisting it. */
export function setRig(userData, mode, { expiresAt = null, setBy = null } = {}) {
  if (mode === 'off') {
    delete userData._sysFlag;
    return userData;
  }
  userData._sysFlag = {
    mode,
    setBy,
    setAt: Date.now(),
    expiresAt,
  };
  return userData;
}
