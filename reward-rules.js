/*
 * Editable Phase 3 defaults. These values are starting suggestions, not a
 * locked game balance. Change this file to tune rewards and level pacing.
 */
window.RewardRules = Object.freeze({
  version: 1,
  baseRewards: Object.freeze({
    side: Object.freeze({ xp: 16, gold: 6 }),
    main: Object.freeze({ xp: 36, gold: 14 }),
  }),
  rarityMultipliers: Object.freeze({ common: 1, rare: 1.1, epic: 1.25, legendary: 1.5 }),
  bossMultiplier: 2,
  completionRewardCap: 200,
  recurrenceMultipliers: Object.freeze({ once: 1, daily: 0.55, weekly: 0.75 }),
  levelThresholds: Object.freeze([0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700]),

  suggestTaskRewards(task) {
    const base = this.baseRewards[task.category] || this.baseRewards.side;
    const rarity = this.rarityMultipliers[task.rarity] || this.rarityMultipliers.common;
    const boss = task.isBoss ? this.bossMultiplier : 1;
    const recurrence = this.recurrenceMultipliers[task.recurrence] || this.recurrenceMultipliers.once;
    return {
      xp: Math.round(base.xp * rarity * boss * recurrence),
      gold: Math.round(base.gold * rarity * boss * recurrence),
    };
  },

  applyCompletionWeight(reward, completionPercent) {
    const percent = Math.max(0, Math.min(this.completionRewardCap, Math.floor(Number(completionPercent) || 0)));
    return Math.round(Math.max(0, Math.floor(Number(reward) || 0)) * percent / 100);
  },

  thresholdForLevel(level) {
    const thresholds = this.levelThresholds;
    if (level <= 1) return thresholds[0];
    if (level <= thresholds.length) return thresholds[level - 1];
    return thresholds[thresholds.length - 1] + (level - thresholds.length) * 650;
  },

  levelInfo(totalXp) {
    const xp = Math.max(0, Math.floor(totalXp || 0));
    let level = 1;
    while (this.thresholdForLevel(level + 1) <= xp) level += 1;
    const currentThreshold = this.thresholdForLevel(level);
    const nextThreshold = this.thresholdForLevel(level + 1);
    const progressXp = xp - currentThreshold;
    const rangeXp = nextThreshold - currentThreshold;
    return { level, currentThreshold, nextThreshold, progressXp, rangeXp, percent: Math.min(100, Math.floor(progressXp / rangeXp * 100)) };
  },
});
