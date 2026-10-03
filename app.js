const sections = {
  overview: { title: '总览', icon: '⌂' },
  tasks: { title: '任务列表', icon: '▤' },
  board: { title: '任务看板', icon: '▥' },
  calendar: { title: '任务日历', icon: '▦' },
  growth: { title: '角色成长', icon: '✳' },
  rewards: { title: '奖励商店', icon: '◇' },
  daily: { title: '每日奖励', icon: '☼' },
  achievements: { title: '成就收藏', icon: '⚑' },
};
const LEGACY_STORAGE_KEY = 'research-rpg.tasks.v1';
const STORAGE_KEY = 'research-rpg.state.v2';
const statusLabels = { todo: '待办', in_progress: '进行中', paused: '搁置', completed: '已完成' };
const categoryLabels = { main: '主线', side: '支线' };
const branchLabels = { research: '科研', study: '学业', career: '找工' };
const priorityLabels = { normal: '普通优先级', high: '高优先级', low: '低优先级' };
const rarityLabels = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' };
const recurrenceLabels = { once: '一次性', daily: '日常', weekly: '周常' };
const moodOptions = ['😀', '😊', '😌', '😐', '😔', '😣', '😴', '🤩', '🥰'];
const page = document.querySelector('#page-content');
const pageTitle = document.querySelector('#current-section');
const navLinks = [...document.querySelectorAll('.nav-link')];
const taskDialog = document.querySelector('#task-dialog');
const detailDialog = document.querySelector('#detail-dialog');
const taskForm = document.querySelector('#task-form');
const completionDialog = document.querySelector('#completion-dialog');
const completionForm = document.querySelector('#completion-form');
const rewardDialog = document.querySelector('#reward-dialog');
const rewardForm = document.querySelector('#reward-form');
const achievementDialog = document.querySelector('#achievement-dialog');
const achievementForm = document.querySelector('#achievement-form');
const toast = document.querySelector('#toast');
let storageLoadFailed = false;
let state = loadState();
let tasks = state.tasks;
let economy = state.economy;
let calendarMoods = state.calendarMoods;
let rewards = state.rewards;
let dailyRewardClaims = state.dailyRewardClaims;
let customAchievements = state.customAchievements;
let achievementUnlocks = state.achievementUnlocks;
let soundEnabled = state.soundEnabled;
let activeDetailId = null;
let returnToDetailAfterTaskDialog = null;
let toastTimer;
let dailyPageTimer;
let suggestionTouched = { xp: false, gold: false };
const taskFilters = { status: '', category: '', branch: '', rarity: '', recurrence: '', boss: '', priority: '', tag: '', dateFrom: '', dateTo: '', sort: 'planned-asc' };
let taskFiltersAdvancedOpen = false;
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let calendarSelectedDate = localDateKey(new Date());

function normaliseTasks(inputTasks, isLegacy = false) {
  if (!Array.isArray(inputTasks)) return [];
  const normalized = inputTasks.filter((task) => task && typeof task.id === 'string' && typeof task.title === 'string').map((task) => {
    const preservedTask = { ...task };
    delete preservedTask.difficulty;
    const legacyCompleted = isLegacy && task.status === 'completed';
    return {
      ...preservedTask,
      parentId: typeof task.parentId === 'string' ? task.parentId : '',
      recurrence: task.recurrence === 'monthly' ? 'once' : (task.recurrence || 'once'),
      completionPercent: task.completionPercent == null ? null : (Number.isSafeInteger(Number(task.completionPercent)) && Number(task.completionPercent) >= 0 ? Number(task.completionPercent) : null),
      xpReward: task.xpReward ?? 0,
      goldReward: task.goldReward ?? 0,
      logs: Array.isArray(task.logs) ? task.logs : [],
      rewardGrantedAt: task.rewardGrantedAt ?? (legacyCompleted ? (task.completedAt || task.updatedAt || task.createdAt || null) : null),
      rewardSkippedLegacy: task.rewardSkippedLegacy ?? legacyCompleted,
    };
  });
  const byId = new Map(normalized.map((task) => [task.id, task]));
  return normalized.map((task) => {
    const parent = byId.get(task.parentId);
    return task.parentId && (!parent || !parent.isBoss || parent.parentId || parent.id === task.id)
      ? { ...task, parentId: '' }
      : task;
  });
}

function normaliseCalendarMoods(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input).filter(([date, mood]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !moodOptions.includes(mood)) return false;
    const [year, month, day] = date.split('-').map(Number);
    return localDateKey(new Date(year, month - 1, day)) === date;
  }));
}

function normaliseRewards(input) {
  if (!Array.isArray(input)) return [];
  return input.filter((reward) => reward && typeof reward.id === 'string' && typeof reward.name === 'string').map((reward) => ({
    id: reward.id,
    name: reward.name.trim(),
    description: typeof reward.description === 'string' ? reward.description : '',
    price: Number.isSafeInteger(Number(reward.price)) && Number(reward.price) > 0 ? Number(reward.price) : 1,
    enabled: reward.enabled !== false,
    createdAt: reward.createdAt || new Date().toISOString(),
    updatedAt: reward.updatedAt || reward.createdAt || new Date().toISOString(),
  })).filter((reward) => reward.name);
}

function normaliseDailyRewardClaims(input) {
  if (!Array.isArray(input)) return [];
  const seenDates = new Set();
  return input.filter((claim) => {
    if (!claim || typeof claim.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(claim.date) || seenDates.has(claim.date)) return false;
    const [year, month, day] = claim.date.split('-').map(Number);
    if (localDateKey(new Date(year, month - 1, day)) !== claim.date) return false;
    if (typeof claim.claimedAt !== 'string' || typeof claim.rewardName !== 'string' || !Number.isFinite(Number(claim.amount)) || typeof claim.unit !== 'string') return false;
    seenDates.add(claim.date);
    return true;
  }).map((claim) => ({ id: claim.id || `daily-${claim.date}`, date: claim.date, rewardName: claim.rewardName, amount: Number(claim.amount), unit: claim.unit, completionPercent: Number(claim.completionPercent) || 0, claimedAt: claim.claimedAt }));
}

function normaliseCustomAchievements(input) {
  if (!Array.isArray(input)) return [];
  const reservedIds = new Set(AchievementRules.defaultDefinitions.map((item) => item.id));
  const knownKinds = new Set(AchievementRules.conditionKinds.map((item) => item.id));
  const seenIds = new Set(reservedIds);
  return input.filter((item) => {
    if (!item || typeof item.id !== 'string' || !item.id.startsWith('custom-') || seenIds.has(item.id)) return false;
    if (!String(item.title || '').trim() || !String(item.category || '').trim() || !knownKinds.has(item.kind)) return false;
    if (!AchievementRules.icons.includes(item.icon) || !Number.isSafeInteger(Number(item.target)) || Number(item.target) < 1 || Number(item.target) > 1000000) return false;
    if (item.kind === 'tagged-tasks' && (!Array.isArray(item.tags) || !item.tags.some((tag) => String(tag).trim()))) return false;
    seenIds.add(item.id);
    return true;
  }).map((item) => ({
    id: item.id,
    title: String(item.title).trim().slice(0, 60),
    category: String(item.category).trim().slice(0, 30),
    description: String(item.description || '').trim().slice(0, 180),
    icon: item.icon,
    kind: item.kind,
    target: Number(item.target),
    tags: item.kind === 'tagged-tasks' ? [...new Set(item.tags.map((tag) => String(tag).trim().toLocaleLowerCase('zh-CN')).filter(Boolean))] : [],
    isCustom: true,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
  }));
}

function allAchievementDefinitions(custom = customAchievements) {
  return [...AchievementRules.defaultDefinitions, ...custom];
}

function normaliseAchievementUnlocks(input, custom = []) {
  if (!Array.isArray(input)) return [];
  const knownIds = new Set(allAchievementDefinitions(custom).map((item) => item.id));
  const legacyIds = { 'research-notes': 'research-five', 'code-practice': 'code-five', 'boss-victory': 'boss-first', 'first-redemption': 'reward-first' };
  const seenIds = new Set();
  return input.map((entry) => ({ ...entry, achievementId: legacyIds[entry?.achievementId] || entry?.achievementId })).filter((entry) => {
    if (!entry || !knownIds.has(entry.achievementId) || typeof entry.unlockedAt !== 'string' || seenIds.has(entry.achievementId)) return false;
    seenIds.add(entry.achievementId);
    return true;
  }).map((entry) => ({ achievementId: entry.achievementId, unlockedAt: entry.unlockedAt }));
}

function normaliseLedger(inputLedger) {
  if (!Array.isArray(inputLedger)) return [];
  return inputLedger.filter((entry) => entry && typeof entry === 'object').map((entry) => ({
    ...entry,
    legacyUnweighted: entry.completionPercent == null ? (entry.legacyUnweighted ?? true) : Boolean(entry.legacyUnweighted),
  }));
}

function loadState() {
  try {
    const projectData = LocalDataStore.read();
    if (projectData.available && projectData.error) {
      storageLoadFailed = true;
      showToast(`${projectData.error}，已暂停写入以保护数据。`);
      return { tasks: [], economy: { ledger: [] }, calendarMoods: {}, rewards: [], dailyRewardClaims: [], customAchievements: [], achievementUnlocks: [], soundEnabled: false };
    }
    if (projectData.available && projectData.state) {
      const parsed = projectData.state;
      if (Array.isArray(parsed.tasks)) {
        const savedCustom = normaliseCustomAchievements(parsed.customAchievements);
        return { tasks: normaliseTasks(parsed.tasks), economy: { ledger: normaliseLedger(parsed.economy?.ledger) }, calendarMoods: normaliseCalendarMoods(parsed.calendarMoods), rewards: normaliseRewards(parsed.rewards), dailyRewardClaims: normaliseDailyRewardClaims(parsed.dailyRewardClaims), customAchievements: savedCustom, achievementUnlocks: normaliseAchievementUnlocks(parsed.achievementUnlocks, savedCustom), soundEnabled: parsed.soundEnabled === true };
      }
      storageLoadFailed = true;
      showToast('项目目录中的数据结构无效，已暂停写入以保护数据。');
      return { tasks: [], economy: { ledger: [] }, calendarMoods: {}, rewards: [], dailyRewardClaims: [], customAchievements: [], achievementUnlocks: [], soundEnabled: false };
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.tasks)) {
        const savedCustom = normaliseCustomAchievements(parsed.customAchievements);
        return { tasks: normaliseTasks(parsed.tasks), economy: { ledger: normaliseLedger(parsed.economy?.ledger) }, calendarMoods: normaliseCalendarMoods(parsed.calendarMoods), rewards: normaliseRewards(parsed.rewards), dailyRewardClaims: normaliseDailyRewardClaims(parsed.dailyRewardClaims), customAchievements: savedCustom, achievementUnlocks: normaliseAchievementUnlocks(parsed.achievementUnlocks, savedCustom), soundEnabled: parsed.soundEnabled === true };
      }
      throw new Error('Invalid saved application state');
    }
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '[]');
    return { tasks: normaliseTasks(legacy, true), economy: { ledger: [] }, calendarMoods: {}, rewards: [], dailyRewardClaims: [], customAchievements: [], achievementUnlocks: [], soundEnabled: false };
  } catch {
    storageLoadFailed = true;
    showToast('本地任务数据无法读取，请检查浏览器存储空间。');
    return { tasks: [], economy: { ledger: [] }, calendarMoods: {}, rewards: [], dailyRewardClaims: [], customAchievements: [], achievementUnlocks: [], soundEnabled: false };
  }
}

function achievementProgress(definition, sourceTasks, sourceEconomy, sourceDailyClaims = dailyRewardClaims) {
  const completed = sourceTasks.filter((task) => task.status === 'completed');
  if (definition.kind === 'completed-tasks') return completed.length;
  if (definition.kind === 'research-tasks') return completed.filter((task) => task.category === 'main' && task.branch === 'research').length;
  if (definition.kind === 'study-tasks') return completed.filter((task) => task.category === 'main' && task.branch === 'study').length;
  if (definition.kind === 'career-tasks') return completed.filter((task) => task.category === 'main' && task.branch === 'career').length;
  if (definition.kind === 'tagged-tasks') return completed.filter((task) => (Array.isArray(task.tags) ? task.tags : []).some((tag) => definition.tags.includes(String(tag).trim().toLocaleLowerCase('zh-CN')))).length;
  if (definition.kind === 'completed-bosses') return completed.filter((task) => task.isBoss).length;
  if (definition.kind === 'completed-subtasks') return completed.filter((task) => Boolean(task.parentId)).length;
  if (definition.kind === 'completed-days') return new Set(completed.filter((task) => task.completedAt && !Number.isNaN(new Date(task.completedAt).getTime())).map((task) => localDateKey(new Date(task.completedAt)))).size;
  if (definition.kind === 'redemptions') return (sourceEconomy.ledger || []).filter((entry) => entry.type === 'reward_redemption').length;
  if (definition.kind === 'daily-claims') return sourceDailyClaims.length;
  return 0;
}

function reconcileAchievementUnlocks(existingUnlocks, sourceTasks, sourceEconomy, sourceCustomAchievements = customAchievements, sourceDailyClaims = dailyRewardClaims) {
  const definitions = allAchievementDefinitions(sourceCustomAchievements);
  const unlocks = normaliseAchievementUnlocks(existingUnlocks, sourceCustomAchievements);
  const unlockedIds = new Set(unlocks.map((entry) => entry.achievementId));
  const newlyUnlocked = [];
  for (const definition of definitions) {
    if (unlockedIds.has(definition.id) || achievementProgress(definition, sourceTasks, sourceEconomy, sourceDailyClaims) < definition.target) continue;
    unlocks.push({ achievementId: definition.id, unlockedAt: new Date().toISOString() });
    unlockedIds.add(definition.id);
    newlyUnlocked.push(definition);
  }
  return { unlocks, newlyUnlocked };
}

function persistTasks(nextTasks, nextEconomy = economy, nextCalendarMoods = calendarMoods, nextRewards = rewards, nextDailyRewardClaims = dailyRewardClaims, nextAchievementUnlocks = achievementUnlocks, nextCustomAchievements = customAchievements, nextSoundEnabled = soundEnabled) {
  if (storageLoadFailed) {
    showToast('本地数据读取异常，已暂停写入，避免覆盖原有内容。');
    return false;
  }
  try {
    const achievementResult = reconcileAchievementUnlocks(nextAchievementUnlocks, nextTasks, nextEconomy, nextCustomAchievements, nextDailyRewardClaims);
    const nextState = { version: 8, tasks: nextTasks, economy: nextEconomy, calendarMoods: nextCalendarMoods, rewards: nextRewards, dailyRewardClaims: nextDailyRewardClaims, customAchievements: nextCustomAchievements, achievementUnlocks: achievementResult.unlocks, soundEnabled: nextSoundEnabled };
    if (LocalDataStore.active) {
      const result = LocalDataStore.write(nextState);
      if (!result.saved) {
        showToast('项目数据文件保存失败；本次更改未应用，请确认启动窗口仍在运行。');
        return false;
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState)); } catch { /* The project file is authoritative in local-server mode. */ }
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    }
    tasks = nextTasks;
    economy = nextEconomy;
    calendarMoods = nextCalendarMoods;
    rewards = nextRewards;
    dailyRewardClaims = nextDailyRewardClaims;
    customAchievements = nextCustomAchievements;
    achievementUnlocks = achievementResult.unlocks;
    soundEnabled = nextSoundEnabled;
    state = { tasks, economy, calendarMoods, rewards, dailyRewardClaims, customAchievements, achievementUnlocks, soundEnabled };
    if (achievementResult.newlyUnlocked.length) {
      const names = achievementResult.newlyUnlocked.map((item) => item.title).join('、');
      window.setTimeout(() => showToast(`解锁新成就：${names}`), 80);
      if (soundEnabled) PixelUI.play('unlock');
    }
    return true;
  } catch {
    showToast('保存失败：浏览器无法写入本地存储。请检查存储空间或隐私设置。');
    return false;
  }
}

function economyTotals(source = economy) {
  const ledger = source.ledger || [];
  return ledger.reduce((totals, entry) => ({
    xp: totals.xp + (Number(entry.xpDelta) || 0),
    gold: totals.gold + (Number(entry.goldDelta) || 0),
  }), { xp: 0, gold: 0 });
}

function displayLevel(level) {
  return level > 999 ? '999+' : String(level);
}

function showLevelDetails() {
  const total = economyTotals();
  const level = RewardRules.levelInfo(total.xp);
  if (level.level <= 999) return;
  document.querySelector('#level-detail-content').innerHTML = `
    <div class="dialog-heading"><div><p class="eyebrow">角色档案 · 等级详情</p><h2 id="level-detail-title">显示等级：999+</h2></div><button class="icon-button" type="button" data-close-dialog="level-dialog" aria-label="关闭">×</button></div>
    <div class="actual-level-card"><span>实际等级</span><strong>${level.level.toLocaleString('zh-CN')}</strong></div>
    <div class="actual-level-stats"><p>累计经验 <strong>${total.xp.toLocaleString('zh-CN')} XP</strong></p><p>当前等级进度 <strong>${level.progressXp.toLocaleString('zh-CN')} / ${level.rangeXp.toLocaleString('zh-CN')} XP</strong></p><p>升至下一级还需 <strong>${(level.rangeXp - level.progressXp).toLocaleString('zh-CN')} XP</strong></p></div>`;
  document.querySelector('#level-dialog').showModal();
}

function updateOverviewProgress() {
  const total = economyTotals();
  const level = RewardRules.levelInfo(total.xp);
  const levelNode = document.querySelector('#overview-level');
  if (!levelNode) return;
  levelNode.textContent = displayLevel(level.level);
  document.querySelector('#overview-level-detail').hidden = level.level <= 999;
  document.querySelector('#overview-xp').textContent = `${level.progressXp} / ${level.rangeXp} XP`;
  const progressTrack = document.querySelector('#overview-progress-fill').parentElement;
  progressTrack.setAttribute('aria-valuemax', level.rangeXp);
  progressTrack.setAttribute('aria-valuenow', level.progressXp);
  document.querySelector('#overview-progress-fill').style.width = `${level.percent}%`;
  document.querySelector('#overview-gold').textContent = new Intl.NumberFormat('zh-CN').format(total.gold);
}

function renderGrowthPage() {
  const total = economyTotals();
  const level = RewardRules.levelInfo(total.xp);
  const history = [...(economy.ledger || [])].reverse().slice(0, 20);
  page.innerHTML = `
    <div class="growth-page-heading"><div><p class="eyebrow">角色档案 · 成长记录</p><h1>角色成长</h1><p class="welcome-copy">XP 累积成长，金币记录可用余额。</p></div></div>
    <section class="growth-hero">
      <div class="growth-level-badge"><span>LV</span><strong>${displayLevel(level.level)}</strong>${level.level > 999 ? '<button class="level-detail-button" type="button" data-action="show-level-detail">查看详细等级</button>' : ''}</div>
      <div class="growth-progress-info"><div class="growth-progress-heading"><strong>等级 ${level.level}</strong><span>${total.xp} XP 累计经验</span></div><div class="growth-track" role="progressbar" aria-label="当前等级经验进度" aria-valuemin="0" aria-valuemax="${level.rangeXp}" aria-valuenow="${level.progressXp}"><span style="width:${level.percent}%"></span></div><p>距离下一级还需 ${level.rangeXp - level.progressXp} XP（${level.progressXp} / ${level.rangeXp}）</p></div>
      <div class="growth-gold"><span class="gold-emblem" aria-hidden="true">币</span><div><span>金币余额</span><strong>${new Intl.NumberFormat('zh-CN').format(total.gold)}</strong></div></div>
    </section>
    <section class="history-section"><div class="section-heading"><div><p class="eyebrow">奖励流水</p><h2>最近的成长与金币变动</h2></div></div>
      ${history.length ? `<div class="ledger-list">${history.map((entry) => `<article class="ledger-row"><span class="ledger-mark" aria-hidden="true">${entry.type === 'reward_redemption' ? '◇' : '✦'}</span><div class="ledger-description"><strong>${escapeHtml(entry.title || '任务奖励')}</strong><span>${entry.type === 'reward_redemption' ? '商店兑换 · ' : ''}${escapeHtml(formatDate(entry.createdAt, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</span></div>${Number(entry.xpDelta) ? `<span class="ledger-xp">+${Number(entry.xpDelta)} XP</span>` : ''}<span class="ledger-gold">${Number(entry.goldDelta) < 0 ? '−' : '+'}${Math.abs(Number(entry.goldDelta) || 0)} 金币</span></article>`).join('')}</div>` : '<div class="task-empty growth-empty"><span class="empty-icon" aria-hidden="true">✳</span><h2>成长记录从第一条任务开始</h2><p>完成任务或兑换商店奖励后，这里会显示对应流水。</p><a class="pixel-button" href="#tasks">查看任务列表</a></div>'}
    </section>`;
}

function renderRewardsPage() {
  const total = economyTotals();
  const sortedRewards = [...rewards].sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name, 'zh-CN'));
  const history = [...(economy.ledger || [])].filter((entry) => entry.type === 'reward_redemption').reverse();
  page.innerHTML = `
    <div class="task-page-heading reward-page-heading"><div><p class="eyebrow">现实奖励 · 金币兑换</p><h1>奖励商店</h1><p class="welcome-copy">添加你想兑换的现实奖励，兑换记录会保留当时的名称与价格。</p></div><button class="pixel-button" type="button" data-action="new-reward">＋ 添加奖励</button></div>
    <section class="shop-balance"><span class="gold-emblem" aria-hidden="true">币</span><div><span>当前金币余额</span><strong>${new Intl.NumberFormat('zh-CN').format(total.gold)} 金币</strong></div><a class="pixel-button button-muted" href="#growth">查看流水</a></section>
    <section class="reward-shop-list" aria-label="可兑换奖励">${sortedRewards.length ? sortedRewards.map((reward) => `<article class="reward-shop-card ${reward.enabled ? '' : 'is-disabled'}"><div class="reward-shop-copy"><h2>${escapeHtml(reward.name)}${reward.enabled ? '' : '<span class="reward-disabled-label">已停用</span>'}</h2><p>${escapeHtml(reward.description || '未填写描述。')}</p></div><strong class="reward-shop-price">${new Intl.NumberFormat('zh-CN').format(reward.price)} <span>金币</span></strong><div class="reward-shop-actions">${reward.enabled ? `<button class="pixel-button" type="button" data-action="redeem-reward" data-id="${escapeHtml(reward.id)}" data-redemption-key="${escapeHtml(`${reward.id}-${createUniqueId()}`)}">兑换</button>` : ''}<button class="pixel-button button-muted" type="button" data-action="edit-reward" data-id="${escapeHtml(reward.id)}">编辑</button><button class="pixel-button button-muted" type="button" data-action="toggle-reward" data-id="${escapeHtml(reward.id)}">${reward.enabled ? '停用' : '重新启用'}</button></div></article>`).join('') : '<div class="task-empty shop-empty"><span class="empty-icon" aria-hidden="true">◇</span><h2>商店还没有奖励</h2><p>添加你认可的现实奖励，并自行设置金币价格。</p><button class="pixel-button" type="button" data-action="new-reward">添加第一项奖励</button></div>'}</section>
    <section class="history-section redemption-history"><div class="section-heading"><div><p class="eyebrow">兑换流水</p><h2>最近的兑换记录</h2></div><span>${history.length} 笔</span></div>${history.length ? `<div class="redemption-list">${history.slice(0, 30).map((entry) => `<article class="redemption-row"><div><strong>${escapeHtml(entry.title || '已兑换奖励')}</strong><span>${escapeHtml(formatDate(entry.createdAt, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</span></div><b>−${new Intl.NumberFormat('zh-CN').format(Math.abs(Number(entry.goldDelta) || 0))} 金币</b></article>`).join('')}</div>` : '<div class="calendar-day-empty"><strong>还没有兑换记录</strong><span>完成兑换后，会在这里保留名称、花费和时间。</span></div>'}</section>
    <footer class="page-footer"><span>兑换只消耗金币，不会扣除 XP</span><span>每日奖励与此商店分开</span></footer>`;
}

function getTodayCompletedTasks(dateKey = localDateKey(new Date())) {
  return tasks.filter((task) => task.dailyRewardDate === dateKey && task.status === 'completed' && task.completedAt && localDateKey(new Date(task.completedAt)) === dateKey);
}

function getDailyCompletionPercent(dateKey = localDateKey(new Date())) {
  return getTodayCompletedTasks(dateKey).reduce((total, task) => total + (Number.isSafeInteger(Number(task.completionPercent)) ? Math.max(0, Number(task.completionPercent)) : 0), 0);
}

function renderDailyRewardPage() {
  if (dailyPageTimer) window.clearTimeout(dailyPageTimer);
  const now = new Date();
  const nextLocalDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  dailyPageTimer = window.setTimeout(() => {
    if (location.hash === '#daily') renderDailyRewardPage();
  }, Math.max(1000, nextLocalDay.getTime() - now.getTime() + 100));

  const today = localDateKey(now);
  const completedPercent = getDailyCompletionPercent(today);
  const required = DailyRewardRules.requiredCompletionPercent;
  const claim = dailyRewardClaims.find((entry) => entry.date === today);
  const ready = completedPercent >= required;
  const progress = Math.min(100, Math.round(completedPercent / required * 100));
  const reward = DailyRewardRules.reward;
  const history = [...dailyRewardClaims].sort((a, b) => b.claimedAt.localeCompare(a.claimedAt));
  const status = claim ? '今日奖励已领取' : ready ? '今日条件已达成' : '继续完成任务';
  page.innerHTML = `
    <div class="task-page-heading"><div><p class="eyebrow">每日仪式 · 本地日历日</p><h1>每日奖励</h1><p class="welcome-copy">完成当天目标后领取奖励。每日奖励独立于金币商店，不扣金币。</p></div></div>
    <section class="daily-reward-card" aria-labelledby="daily-status-heading"><div class="daily-reward-heading"><div><p class="eyebrow">${escapeHtml(formatDate(today, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }))}</p><h2 id="daily-status-heading">${status}</h2></div><span class="daily-reward-icon" aria-hidden="true">☼</span></div>
      <div class="daily-reward-prize"><span>今日奖励</span><strong>${escapeHtml(reward.name)} ${reward.amount} ${escapeHtml(reward.unit)}</strong></div>
      <div class="daily-progress-label"><span>今日候选任务完成度</span><strong>${completedPercent}% / ${required}%</strong></div><div class="daily-progress-track" role="progressbar" aria-label="每日奖励完成度进度" aria-valuemin="0" aria-valuemax="${required}" aria-valuenow="${Math.min(completedPercent, required)}"><span style="width:${progress}%"></span></div>
      ${claim ? `<p class="daily-reward-message" role="status">已于 ${escapeHtml(formatDate(claim.claimedAt, { hour: '2-digit', minute: '2-digit' }))} 领取：${escapeHtml(claim.rewardName)} ${claim.amount} ${escapeHtml(claim.unit)}。</p>` : ready ? '<p class="daily-reward-message">完成度已达标，可以领取今日奖励。</p>' : `<p class="daily-reward-message">还差 ${required - completedPercent}% 完成度。任务完成度可超过 200%；超额部分计入每日进度，但 XP/金币奖励最高按 200% 加权。</p>`}
      <div class="daily-reward-actions"><button class="pixel-button daily-claim-button" type="button" data-action="claim-daily-reward" ${claim || !ready ? 'disabled' : ''}>${claim ? '今日已领取' : ready ? '领取今日奖励' : '尚未达成'}</button>${!claim && !ready ? '<a class="pixel-button button-muted" href="#tasks">去任务列表</a>' : ''}</div>
    </section>
    <section class="daily-candidate-section"><div class="section-heading"><div><p class="eyebrow">常驻候选任务</p><h2>选择今天要做的任务</h2></div><span>所选任务会加入普通任务列表</span></div><div class="daily-candidate-grid">${DailyRewardRules.candidateTasks.map((preset) => {
      const currentTask = tasks.find((task) => task.dailyRewardDate === today && task.dailyRewardTemplateId === preset.id);
      return `<article class="daily-candidate-card"><div><h3>${escapeHtml(preset.title)}</h3><p>${escapeHtml(preset.description)}</p></div>${currentTask ? `<div class="daily-candidate-current"><span class="status-pill status-${escapeHtml(currentTask.status)}">${escapeHtml(statusLabels[currentTask.status] || '待办')}</span><span>${currentTask.status === 'completed' ? `完成度 ${currentTask.completionPercent ?? 0}%` : '已加入今日任务'}</span><button class="pixel-button button-muted" type="button" data-action="open-detail" data-id="${escapeHtml(currentTask.id)}">查看任务</button></div>` : `<button class="pixel-button button-muted" type="button" data-action="add-daily-template" data-id="${escapeHtml(preset.id)}">加入今日任务</button>`}</article>`;
    }).join('')}</div><p class="field-hint">每日进度只累计今天从候选池加入且今天完成的任务。已选择的任务仍可在任务列表中正常查看、编辑和领取任务奖励。</p></section>
    <section class="history-section daily-history"><div class="section-heading"><div><p class="eyebrow">领取记录</p><h2>每日奖励历史</h2></div><span>${dailyRewardClaims.length} 次</span></div>${history.length ? `<div class="redemption-list">${history.slice(0, 30).map((entry) => `<article class="redemption-row"><div><strong>${escapeHtml(entry.rewardName)} ${entry.amount} ${escapeHtml(entry.unit)}</strong><span>${escapeHtml(formatDate(entry.date, { year: 'numeric', month: 'long', day: 'numeric' }))} · ${escapeHtml(formatDate(entry.claimedAt, { hour: '2-digit', minute: '2-digit' }))}</span></div><b>已领取</b></article>`).join('')}</div>` : '<div class="calendar-day-empty"><strong>还没有领取记录</strong><span>达成当日条件并领取后，记录会保存在这里。</span></div>'}</section>
    <footer class="page-footer"><span>每日条件：候选任务完成度累计 ${required}%</span><span>领取不扣金币、不发 XP</span></footer>`;
}

function claimDailyReward() {
  const today = localDateKey(new Date());
  let savedClaims = [];
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    savedClaims = normaliseDailyRewardClaims(saved.dailyRewardClaims);
  } catch { /* Keep the current in-memory state if saved data is unavailable. */ }
  if (dailyRewardClaims.some((entry) => entry.date === today) || savedClaims.some((entry) => entry.date === today)) {
    dailyRewardClaims = normaliseDailyRewardClaims([...dailyRewardClaims, ...savedClaims]);
    renderDailyRewardPage();
    showToast('今天的每日奖励已经领取过了。');
    return;
  }
  const completedPercent = getDailyCompletionPercent(today);
  if (completedPercent < DailyRewardRules.requiredCompletionPercent) {
    showToast(`每日候选任务还差 ${DailyRewardRules.requiredCompletionPercent - completedPercent}% 完成度。`);
    renderDailyRewardPage();
    return;
  }
  const reward = DailyRewardRules.reward;
  if (!window.confirm(`确认领取今日奖励：${reward.name} ${reward.amount} ${reward.unit}？此奖励不会扣除金币。`)) return;
  const claimedAt = new Date().toISOString();
  const claim = { id: `daily-${today}`, date: today, rewardName: reward.name, amount: reward.amount, unit: reward.unit, completionPercent: completedPercent, claimedAt };
  const nextClaims = normaliseDailyRewardClaims([...dailyRewardClaims, claim]);
  if (!persistTasks(tasks, economy, calendarMoods, rewards, nextClaims)) return;
  renderDailyRewardPage();
  playUiSound('reward');
  showToast(`已领取今日奖励：${reward.name} ${reward.amount} ${reward.unit}。`);
}

function renderAchievementsPage() {
  const definitions = allAchievementDefinitions();
  const unlockById = new Map(achievementUnlocks.map((entry) => [entry.achievementId, entry]));
  const unlockedCount = unlockById.size;
  const groups = [...new Set(definitions.map((item) => item.category))];
  page.innerHTML = `
    <div class="task-page-heading"><div><p class="eyebrow">旅途纪念 · 真实行动</p><h1>成就收藏</h1><p class="welcome-copy">记录由任务进展和奖励兑换解锁的里程碑。</p></div><button class="pixel-button" type="button" data-action="new-achievement">＋ 添加成就</button></div>
    <section class="achievement-summary"><span class="achievement-summary-icon" aria-hidden="true">${PixelUI.icon('achievements')}</span><div><strong>已解锁 ${unlockedCount} / ${definitions.length}</strong><span>解锁记录保存在当前本地数据中，且只会记录一次。</span></div></section>
    ${groups.map((category) => `<section class="achievement-group"><div class="section-heading"><div><p class="eyebrow">成就分类</p><h2>${escapeHtml(category)}</h2></div><span>${definitions.filter((item) => item.category === category && unlockById.has(item.id)).length} / ${definitions.filter((item) => item.category === category).length} 已解锁</span></div><div class="achievement-grid">${definitions.filter((item) => item.category === category).map((item) => {
      const unlock = unlockById.get(item.id);
      const progress = achievementProgress(item, tasks, economy);
      return `<article class="achievement-card ${unlock ? 'is-unlocked' : 'is-locked'}"><span class="achievement-icon" aria-hidden="true">${PixelUI.icon(item.icon)}</span><div class="achievement-copy"><p class="eyebrow">${escapeHtml(item.category)}${item.isCustom ? ' · 自定义' : ''}</p><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p>${unlock ? `<span class="achievement-unlocked-date">已于 ${escapeHtml(formatDate(unlock.unlockedAt, { year: 'numeric', month: 'long', day: 'numeric' }))} 解锁</span>` : `<div class="achievement-progress-label"><span>进度</span><strong>${Math.min(progress, item.target)} / ${item.target}</strong></div><div class="achievement-progress-track" role="progressbar" aria-label="${escapeHtml(item.title)}进度" aria-valuemin="0" aria-valuemax="${item.target}" aria-valuenow="${Math.min(progress, item.target)}"><span style="width:${Math.min(100, Math.round(progress / item.target * 100))}%"></span></div>`}</div><span class="achievement-state">${unlock ? '已解锁' : '未解锁'}</span></article>`;
    }).join('')}</div></section>`).join('')}
    <footer class="page-footer"><span>可按预设条件添加自定义成就</span><span>预设门槛集中配置于 achievement-rules.js</span></footer>`;
}

function updateAchievementTagField() {
  const isTagged = achievementForm.elements.namedItem('kind').value === 'tagged-tasks';
  const tagField = document.querySelector('#achievement-tags-field');
  const tagInput = achievementForm.elements.namedItem('tags');
  tagField.hidden = !isTagged;
  tagInput.required = isTagged;
}

function openNewAchievement() {
  achievementForm.reset();
  const categoryList = document.querySelector('#achievement-category-options');
  categoryList.innerHTML = [...new Set(allAchievementDefinitions().map((item) => item.category))].map((name) => `<option value="${escapeHtml(name)}"></option>`).join('');
  const kindSelect = achievementForm.elements.namedItem('kind');
  kindSelect.innerHTML = AchievementRules.conditionKinds.map((condition) => `<option value="${escapeHtml(condition.id)}">${escapeHtml(condition.label)}</option>`).join('');
  document.querySelector('#achievement-form-error').hidden = true;
  updateAchievementTagField();
  achievementDialog.showModal();
  playUiSound('open');
  achievementForm.elements.namedItem('title').focus();
}

function submitAchievement(event) {
  event.preventDefault();
  const fields = new FormData(achievementForm);
  const title = String(fields.get('title') || '').trim();
  const category = String(fields.get('category') || '').trim();
  const target = Number(fields.get('target'));
  const kind = String(fields.get('kind') || '');
  const tags = [...new Set(String(fields.get('tags') || '').split(/[,，]/).map((tag) => tag.trim().toLocaleLowerCase('zh-CN')).filter(Boolean))];
  const error = document.querySelector('#achievement-form-error');
  if (!title || !category || !Number.isSafeInteger(target) || target < 1 || target > 1000000 || (kind === 'tagged-tasks' && !tags.length)) {
    error.textContent = '请填写名称、分类和有效的达成数量；标签条件至少需要一个标签。';
    error.hidden = false;
    return;
  }
  if (allAchievementDefinitions().some((item) => item.title.toLocaleLowerCase('zh-CN') === title.toLocaleLowerCase('zh-CN'))) {
    error.textContent = '已有同名成就，请换一个名称。';
    error.hidden = false;
    achievementForm.elements.namedItem('title').focus();
    return;
  }
  const conditionLabel = AchievementRules.conditionKinds.find((item) => item.id === kind)?.label || '指定进度';
  const custom = {
    id: `custom-${createUniqueId()}`,
    title,
    category,
    description: String(fields.get('description') || '').trim() || `达到 ${target} 次${conditionLabel}。`,
    icon: AchievementRules.icons.includes(fields.get('icon')) ? fields.get('icon') : 'star',
    kind,
    target,
    tags,
    isCustom: true,
    createdAt: new Date().toISOString(),
  };
  const nextCustom = normaliseCustomAchievements([...customAchievements, custom]);
  if (!persistTasks(tasks, economy, calendarMoods, rewards, dailyRewardClaims, achievementUnlocks, nextCustom, soundEnabled)) return;
  achievementDialog.close();
  renderAchievementsPage();
  showToast(`已添加成就“${title}”。`);
}

function updateSoundToggle() {
  const button = document.querySelector('#sound-toggle');
  button.setAttribute('aria-pressed', String(soundEnabled));
  button.setAttribute('aria-label', soundEnabled ? '关闭像素音效' : '开启像素音效');
  document.querySelector('#sound-toggle-label').textContent = soundEnabled ? '音效开' : '音效关';
  document.querySelector('#sound-toggle-icon').innerHTML = PixelUI.icon(soundEnabled ? 'sound' : 'mute', 'pixel-svg');
}

function playUiSound(effect) {
  if (soundEnabled) PixelUI.play(effect);
}

function toggleSound() {
  const nextSetting = !soundEnabled;
  if (!persistTasks(tasks, economy, calendarMoods, rewards, dailyRewardClaims, achievementUnlocks, customAchievements, nextSetting)) return;
  updateSoundToggle();
  if (nextSetting) PixelUI.play('toggle');
  showToast(nextSetting ? '像素音效已开启。' : '像素音效已关闭。');
}

function openNewReward() {
  rewardForm.reset();
  rewardForm.elements.namedItem('id').value = '';
  document.querySelector('#reward-dialog-title').textContent = '添加奖励';
  document.querySelector('#reward-form-error').hidden = true;
  rewardDialog.showModal();
  playUiSound('open');
  rewardForm.elements.namedItem('name').focus();
}

function openEditReward(id) {
  const reward = rewards.find((item) => item.id === id);
  if (!reward) return;
  rewardForm.reset();
  rewardForm.elements.namedItem('id').value = reward.id;
  rewardForm.elements.namedItem('name').value = reward.name;
  rewardForm.elements.namedItem('description').value = reward.description;
  rewardForm.elements.namedItem('price').value = reward.price;
  rewardForm.elements.namedItem('template').value = '';
  document.querySelector('#reward-dialog-title').textContent = '编辑奖励';
  document.querySelector('#reward-form-error').hidden = true;
  rewardDialog.showModal();
  playUiSound('open');
  rewardForm.elements.namedItem('name').focus();
}

function applyRewardTemplate() {
  const templates = {
    tea: ['奶茶', '给自己买一杯喜欢的奶茶。'],
    game: ['游戏时间', '给自己安排一段额外的游戏时间。'],
    movie: ['看电影', '看一场自己期待的电影。'],
    outing: ['外出游玩', '安排一次外出活动。'],
  };
  const template = templates[rewardForm.elements.namedItem('template').value];
  if (!template) return;
  rewardForm.elements.namedItem('name').value = template[0];
  rewardForm.elements.namedItem('description').value = template[1];
  rewardForm.elements.namedItem('name').focus();
}

function submitReward(event) {
  event.preventDefault();
  const data = new FormData(rewardForm);
  const id = String(data.get('id') || '');
  const name = String(data.get('name') || '').trim();
  const rawPrice = String(data.get('price') || '');
  const price = Number(rawPrice);
  const error = document.querySelector('#reward-form-error');
  if (!name || !Number.isSafeInteger(price) || price < 1) {
    error.textContent = '请填写奖励名称，并输入至少 1 金币的整数价格。';
    error.hidden = false;
    (name ? rewardForm.elements.namedItem('price') : rewardForm.elements.namedItem('name')).focus();
    return;
  }
  const previous = rewards.find((reward) => reward.id === id);
  const now = new Date().toISOString();
  const reward = {
    ...(previous || {}),
    id: previous?.id || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    name,
    description: String(data.get('description') || '').trim(),
    price,
    enabled: previous?.enabled !== false,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };
  const nextRewards = previous ? rewards.map((item) => item.id === id ? reward : item) : [...rewards, reward];
  if (!persistTasks(tasks, economy, calendarMoods, nextRewards)) return;
  rewardDialog.close();
  playUiSound('save');
  renderRewardsPage();
  showToast(previous ? '奖励信息已更新；既有兑换记录保持不变。' : '奖励已添加到商店。');
}

function toggleReward(id) {
  const reward = rewards.find((item) => item.id === id);
  if (!reward) return;
  if (reward.enabled && !window.confirm(`确定停用“${reward.name}”吗？既有兑换记录会保留。`)) return;
  const nextRewards = rewards.map((item) => item.id === id ? { ...item, enabled: !item.enabled, updatedAt: new Date().toISOString() } : item);
  if (!persistTasks(tasks, economy, calendarMoods, nextRewards)) return;
  renderRewardsPage();
  showToast(reward.enabled ? '奖励已停用，历史记录已保留。' : '奖励已重新启用。');
}

function redeemReward(id, redemptionKey = '') {
  const reward = rewards.find((item) => item.id === id && item.enabled);
  if (!reward) return;
  if (redemptionKey && economy.ledger.some((entry) => entry.id === redemptionKey && entry.type === 'reward_redemption')) return;
  const balance = economyTotals().gold;
  if (balance < reward.price) {
    playUiSound('error');
    showToast(`金币不足，还差 ${new Intl.NumberFormat('zh-CN').format(reward.price - balance)} 金币。`);
    return;
  }
  if (!window.confirm(`兑换“${reward.name}”需要 ${new Intl.NumberFormat('zh-CN').format(reward.price)} 金币。确认兑换吗？`)) return;
  const redemption = {
    id: redemptionKey || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    type: 'reward_redemption',
    title: reward.name,
    rewardId: reward.id,
    rewardName: reward.name,
    goldDelta: -reward.price,
    xpDelta: 0,
    createdAt: new Date().toISOString(),
  };
  const nextEconomy = { ...economy, ledger: [...(economy.ledger || []), redemption] };
  if (!persistTasks(tasks, nextEconomy)) return;
  renderRewardsPage();
  playUiSound('reward');
  showToast(`已兑换“${reward.name}”，扣除 ${new Intl.NumberFormat('zh-CN').format(reward.price)} 金币。`);
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function createUniqueId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(value, options = { year: 'numeric', month: 'long', day: 'numeric' }) {
  if (!value) return '';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('zh-CN', options).format(date);
}

function formatDateTimeLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function renderRoute() {
  const key = location.hash.slice(1) || 'overview';
  const sectionKey = sections[key] ? key : 'overview';
  const { title, icon } = sections[sectionKey];
  pageTitle.textContent = title;
  navLinks.forEach((link) => {
    const active = link.hash === `#${sectionKey}`;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  if (sectionKey === 'overview') {
    page.innerHTML = page.dataset.overview;
    updateOverviewProgress();
    renderOverviewTasks();
  }
  else if (sectionKey === 'tasks') renderTaskPage();
  else if (sectionKey === 'board') renderBoardPage();
  else if (sectionKey === 'calendar') renderCalendarPage();
  else if (sectionKey === 'growth') renderGrowthPage();
  else if (sectionKey === 'rewards') renderRewardsPage();
  else if (sectionKey === 'daily') renderDailyRewardPage();
  else if (sectionKey === 'achievements') renderAchievementsPage();
  else page.innerHTML = `<div class="placeholder-page"><span class="placeholder-mark" aria-hidden="true">${icon}</span><p class="eyebrow">冒险地图 · ${title}</p><h1>${title}</h1><p>这个区域已为后续阶段准备好。功能会按计划逐步加入。</p><a class="placeholder-link" href="#overview">返回总览</a></div>`;
}

function refreshTaskView() {
  const route = location.hash.slice(1) || 'overview';
  if (route === 'overview') renderRoute();
  else if (route === 'tasks') renderTaskPage();
  else if (route === 'board') renderBoardPage();
  else if (route === 'calendar') renderCalendarPage();
  else if (route === 'growth') renderGrowthPage();
  else if (route === 'rewards') renderRewardsPage();
  else if (route === 'achievements') renderAchievementsPage();
  else if (route === 'daily') renderDailyRewardPage();
}

function taskMeta(task) {
  const values = [categoryLabels[task.category] || '支线'];
  if (task.category === 'main' && branchLabels[task.branch]) values.push(branchLabels[task.branch]);
  if (task.isBoss) values.push('Boss 挑战');
  if (recurrenceLabels[task.recurrence] && task.recurrence !== 'once') values.push(recurrenceLabels[task.recurrence]);
  if (task.priority && task.priority !== 'normal') values.push(priorityLabels[task.priority]);
  if (task.rarity && task.rarity !== 'common') values.push(`${rarityLabels[task.rarity]}稀有度`);
  if (task.plannedDate) values.push(`计划 ${formatDate(task.plannedDate)}`);
  if (task.dueAt) values.push(`截止 ${formatDate(task.dueAt, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
  if (task.status === 'completed' && task.completionPercent != null) values.push(`完成度 ${task.completionPercent}%`);
  (task.tags || []).forEach((tag) => values.push(`#${tag}`));
  return values.map((value) => `<span class="task-chip">${escapeHtml(value)}</span>`).join('');
}

function taskRewardEstimate(task) {
  const xp = new Intl.NumberFormat('zh-CN').format(Math.max(0, Math.floor(Number(task.xpReward) || 0)));
  const gold = new Intl.NumberFormat('zh-CN').format(Math.max(0, Math.floor(Number(task.goldReward) || 0)));
  return `<span class="task-reward-estimate"><span>完成预估奖励：</span><strong>+${xp} XP</strong><span aria-hidden="true">·</span><strong>+${gold} 金币</strong></span>`;
}

function renderTaskPage() {
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const visibleTasks = getVisibleTaskItems();
  page.innerHTML = `
    <div class="task-page-heading">
      <div><p class="eyebrow">任务档案 · 现实主线</p><h1>任务列表</h1><p class="welcome-copy">把要做的事整理好，一次推进一小步。</p></div>
      <button class="pixel-button" type="button" data-action="new-task"><span aria-hidden="true">＋</span> 新建任务</button>
    </div>
    <div class="task-summary"><span>任务记录 <strong>${tasks.length}</strong></span><span>已完成 <strong>${completed}</strong></span><span>当前显示 <strong>${visibleTasks.length}</strong></span></div>
    <form class="task-filters" id="task-filters" aria-label="筛选和排序任务">
      <div class="task-filter-primary">
        <label class="filter-field">状态<select name="status"><option value="">全部状态</option>${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${taskFilters.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label class="filter-field">类型<select name="category"><option value="">全部类型</option><option value="main" ${taskFilters.category === 'main' ? 'selected' : ''}>主线</option><option value="side" ${taskFilters.category === 'side' ? 'selected' : ''}>支线</option></select></label>
        <button class="pixel-button button-muted filter-reset" id="task-filter-reset" type="reset">清除筛选</button>
      </div>
      <details class="task-filter-advanced" id="advanced-task-filters" ${taskFiltersAdvancedOpen ? 'open' : ''}>
        <summary>更多筛选与排序</summary>
        <div class="task-filter-grid">
          <label class="filter-field">主线分支<select name="branch"><option value="">全部分支</option>${Object.entries(branchLabels).map(([value, label]) => `<option value="${value}" ${taskFilters.branch === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
          <label class="filter-field">稀有度<select name="rarity"><option value="">全部稀有度</option>${Object.entries(rarityLabels).map(([value, label]) => `<option value="${value}" ${taskFilters.rarity === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
          <label class="filter-field">重复周期<select name="recurrence"><option value="">全部周期</option>${Object.entries(recurrenceLabels).map(([value, label]) => `<option value="${value}" ${taskFilters.recurrence === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
          <label class="filter-field">Boss 挑战<select name="boss"><option value="">全部任务</option><option value="yes" ${taskFilters.boss === 'yes' ? 'selected' : ''}>仅 Boss</option><option value="no" ${taskFilters.boss === 'no' ? 'selected' : ''}>非 Boss</option></select></label>
          <label class="filter-field">优先级<select name="priority"><option value="">全部优先级</option><option value="high" ${taskFilters.priority === 'high' ? 'selected' : ''}>高</option><option value="normal" ${taskFilters.priority === 'normal' ? 'selected' : ''}>普通</option><option value="low" ${taskFilters.priority === 'low' ? 'selected' : ''}>低</option></select></label>
          <label class="filter-field">标签<select name="tag"><option value="">全部标签</option>${[...new Set(tasks.flatMap((task) => task.tags || []))].sort((a, b) => a.localeCompare(b, 'zh-CN')).map((tag) => `<option value="${escapeHtml(tag)}" ${taskFilters.tag === tag ? 'selected' : ''}>${escapeHtml(tag)}</option>`).join('')}</select></label>
          <label class="filter-field">计划日期起<input name="dateFrom" type="date" value="${escapeHtml(taskFilters.dateFrom)}" /></label>
          <label class="filter-field">计划日期止<input name="dateTo" type="date" value="${escapeHtml(taskFilters.dateTo)}" /></label>
          <label class="filter-field">排序<select name="sort"><option value="planned-asc" ${taskFilters.sort === 'planned-asc' ? 'selected' : ''}>计划日期：由早到晚</option><option value="planned-desc" ${taskFilters.sort === 'planned-desc' ? 'selected' : ''}>计划日期：由晚到早</option><option value="created-desc" ${taskFilters.sort === 'created-desc' ? 'selected' : ''}>最近创建</option><option value="priority-desc" ${taskFilters.sort === 'priority-desc' ? 'selected' : ''}>优先级</option><option value="title-asc" ${taskFilters.sort === 'title-asc' ? 'selected' : ''}>名称</option></select></label>
        </div>
      </details>
    </form>
    <div class="task-list" id="task-list">${renderTaskItems(visibleTasks)}</div>
    <footer class="page-footer"><span>资料保存在此浏览器</span><span>首次完成时发放一次任务奖励</span></footer>`;
}

function getVisibleTaskItems() {
  const priorityRank = { high: 0, normal: 1, low: 2 };
  return tasks.filter((task) => {
    if (taskFilters.status && task.status !== taskFilters.status) return false;
    if (taskFilters.category && task.category !== taskFilters.category) return false;
    if (taskFilters.branch && task.branch !== taskFilters.branch) return false;
    if (taskFilters.rarity && (task.rarity || 'common') !== taskFilters.rarity) return false;
    if (taskFilters.recurrence && (task.recurrence || 'once') !== taskFilters.recurrence) return false;
    if (taskFilters.boss === 'yes' && !task.isBoss) return false;
    if (taskFilters.boss === 'no' && task.isBoss) return false;
    if (taskFilters.priority && (task.priority || 'normal') !== taskFilters.priority) return false;
    if (taskFilters.tag && !(task.tags || []).includes(taskFilters.tag)) return false;
    if (taskFilters.dateFrom && (!task.plannedDate || task.plannedDate < taskFilters.dateFrom)) return false;
    if (taskFilters.dateTo && (!task.plannedDate || task.plannedDate > taskFilters.dateTo)) return false;
    return true;
  }).sort((a, b) => {
    if (taskFilters.sort === 'created-desc') return (b.createdAt || '').localeCompare(a.createdAt || '');
    if (taskFilters.sort === 'priority-desc') return (priorityRank[a.priority || 'normal'] ?? 1) - (priorityRank[b.priority || 'normal'] ?? 1);
    if (taskFilters.sort === 'title-asc') return a.title.localeCompare(b.title, 'zh-CN');
    const aDate = a.plannedDate || (taskFilters.sort === 'planned-asc' ? '9999-12-31' : '0000-01-01');
    const bDate = b.plannedDate || (taskFilters.sort === 'planned-asc' ? '9999-12-31' : '0000-01-01');
    const dateOrder = aDate.localeCompare(bDate) * (taskFilters.sort === 'planned-desc' ? -1 : 1);
    return dateOrder || (a.createdAt || '').localeCompare(b.createdAt || '');
  });
}

function renderTaskItems(sorted = getVisibleTaskItems()) {
  if (!tasks.length) return '<div class="task-empty"><span class="empty-icon" aria-hidden="true">▤</span><h2>任务板还是空的</h2><p>把最近想推进的一件事记下来，作为你的第一条任务。</p><button class="pixel-button" type="button" data-action="new-task">创建第一条任务</button></div>';
  if (!sorted.length) return '<div class="task-empty filter-empty"><span class="empty-icon" aria-hidden="true">⌕</span><h2>没有符合条件的任务</h2><p>试试放宽筛选条件，或清除筛选查看全部任务。</p><button class="pixel-button button-muted" type="reset" form="task-filters">清除筛选</button></div>';
  return sorted.map((task) => `
    <article class="task-row ${task.status === 'completed' ? 'is-completed' : ''}">
      <button class="task-state state-${escapeHtml(task.status)}" type="button" data-action="toggle-task" data-id="${escapeHtml(task.id)}" aria-label="${task.status === 'completed' ? '重新打开' : '完成'}：${escapeHtml(task.title)}">${task.status === 'completed' ? '✓' : '○'}</button>
      <button class="task-main" type="button" data-action="open-detail" data-id="${escapeHtml(task.id)}"><span class="task-title">${escapeHtml(task.title)}</span><span class="task-meta">${taskMeta(task)}</span>${taskRewardEstimate(task)}</button>
      <span class="status-pill status-${escapeHtml(task.status)}">${escapeHtml(statusLabels[task.status] || '待办')}</span>
      <button class="task-more" type="button" data-action="open-detail" data-id="${escapeHtml(task.id)}" aria-label="查看 ${escapeHtml(task.title)} 详情">›</button>
    </article>`).join('');
}

function renderBoardPage() {
  const counts = Object.fromEntries(Object.keys(statusLabels).map((status) => [status, tasks.filter((task) => task.status === status).length]));
  page.innerHTML = `
    <div class="task-page-heading board-page-heading">
      <div><p class="eyebrow">进度视图 · 状态追踪</p><h1>任务看板</h1><p class="welcome-copy">按当前进度整理任务；状态变化会同步到任务列表。</p></div>
      <button class="pixel-button" type="button" data-action="new-task"><span aria-hidden="true">＋</span> 新建任务</button>
    </div>
    <div class="task-summary"><span>全部任务 <strong>${tasks.length}</strong></span><span>已完成 <strong>${counts.completed}</strong></span></div>
    ${tasks.length ? `<div class="kanban-scroll" role="region" aria-label="任务看板，可左右滚动" tabindex="0"><div class="kanban-board">${Object.entries(statusLabels).map(([status, label]) => {
      const columnTasks = tasks.filter((task) => task.status === status).sort((a, b) => (a.plannedDate || '9999-12-31').localeCompare(b.plannedDate || '9999-12-31') || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      return `<section class="kanban-column kanban-${status}" aria-labelledby="board-column-${status}">
        <header class="kanban-column-heading"><h2 id="board-column-${status}">${escapeHtml(label)}</h2><span>${columnTasks.length}</span></header>
        <div class="kanban-card-list">${columnTasks.length ? columnTasks.map((task) => `
          <article class="kanban-card ${task.status === 'completed' ? 'is-completed' : ''}">
            <button class="kanban-card-title" type="button" data-action="open-detail" data-id="${escapeHtml(task.id)}">${escapeHtml(task.title)}</button>
            <div class="kanban-card-meta">${taskMeta(task)}</div>
            <label class="kanban-status-field">更改状态<select data-board-status data-id="${escapeHtml(task.id)}" aria-label="更改任务状态：${escapeHtml(task.title)}">${Object.entries(statusLabels).map(([value, statusLabel]) => `<option value="${value}" ${value === task.status ? 'selected' : ''}>${escapeHtml(statusLabel)}</option>`).join('')}</select></label>
          </article>`).join('') : '<div class="kanban-column-empty">此列暂无任务</div>'}</div>
      </section>`;
    }).join('')}</div></div>` : `<div class="task-empty board-empty"><span class="empty-icon" aria-hidden="true">▥</span><h2>看板还是空的</h2><p>创建第一条任务后，它会出现在待办列中。</p><button class="pixel-button" type="button" data-action="new-task">创建第一条任务</button></div>`}
    <footer class="page-footer"><span>状态与任务列表保持同步</span><span>完成任务时仍需填写完成度评分</span></footer>`;
}

function renderCalendarPage() {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayOffset);
  const today = localDateKey(new Date());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const key = localDateKey(date);
    const count = tasks.filter((task) => task.plannedDate === key).length;
    const classes = ['calendar-day'];
    if (date.getMonth() !== month) classes.push('is-outside-month');
    if (key === today) classes.push('is-today');
    if (key === calendarSelectedDate) classes.push('is-selected');
    const dateLabel = formatDate(key, { year: 'numeric', month: 'long', day: 'numeric' });
    const options = [`<option value="" ${calendarMoods[key] ? '' : 'selected'}>＋</option>`, ...moodOptions.map((mood) => `<option value="${mood}" ${calendarMoods[key] === mood ? 'selected' : ''}>${mood}</option>`)].join('');
    return `<div class="${classes.join(' ')}"><button class="calendar-day-select" type="button" data-action="calendar-select-date" data-date="${key}" aria-pressed="${key === calendarSelectedDate}" aria-label="${dateLabel}${count ? `，${count} 项任务` : '，无计划任务'}"><span class="calendar-day-top"><span class="calendar-day-number">${date.getDate()}</span>${key === today ? '<span class="calendar-today-mark">今天</span>' : ''}</span>${count ? `<span class="calendar-day-count">${count} 项</span>` : ''}</button><label class="calendar-mood-field"><span class="sr-only">${dateLabel}心情</span><select data-calendar-mood data-date="${key}" aria-label="${dateLabel}心情表情" title="标记当天心情">${options}</select></label></div>`;
  });
  const selectedTasks = tasks.filter((task) => task.plannedDate === calendarSelectedDate).sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || '') || a.title.localeCompare(b.title, 'zh-CN'));
  const scheduledTaskCount = tasks.filter((task) => task.plannedDate).length;
  const monthLabel = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(calendarMonth);
  const selectedLabel = formatDate(calendarSelectedDate, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  page.innerHTML = `
    <div class="task-page-heading calendar-page-heading">
      <div><p class="eyebrow">时间安排 · 计划日期</p><h1>任务日历</h1><p class="welcome-copy">按计划日期查看任务；选择日期可定位并打开任务详情。</p></div>
      <a class="pixel-button button-muted calendar-task-link" href="#tasks">查看全部任务</a>
    </div>
    <section class="calendar-panel" aria-label="月历">
      <div class="calendar-toolbar"><h2 id="calendar-month-title" aria-live="polite">${escapeHtml(monthLabel)}</h2><div class="calendar-navigation"><button class="pixel-button button-muted" type="button" data-action="calendar-prev" aria-label="上个月">←</button><button class="pixel-button button-muted calendar-today-button" type="button" data-action="calendar-today">今天</button><button class="pixel-button button-muted" type="button" data-action="calendar-next" aria-label="下个月">→</button></div></div>
      <div class="calendar-weekdays" aria-hidden="true">${['一', '二', '三', '四', '五', '六', '日'].map((day) => `<span>${day}</span>`).join('')}</div>
      <div class="calendar-grid" aria-labelledby="calendar-month-title">${days.join('')}</div>
    </section>
    <section class="calendar-selected-day" aria-labelledby="calendar-selected-title"><div class="section-heading"><div><p class="eyebrow">日期任务</p><h2 id="calendar-selected-title">${escapeHtml(selectedLabel)}</h2></div><span class="calendar-selected-count">${selectedTasks.length} 项任务</span></div>
      ${selectedTasks.length ? `<div class="calendar-task-list">${selectedTasks.map((task) => `<article class="calendar-task-row ${task.status === 'completed' ? 'is-completed' : ''}"><button class="calendar-task-title" type="button" data-action="open-detail" data-id="${escapeHtml(task.id)}">${escapeHtml(task.title)}</button><span class="status-pill status-${escapeHtml(task.status)}">${escapeHtml(statusLabels[task.status] || '待办')}</span><div class="calendar-task-meta">${taskMeta(task)}</div></article>`).join('')}</div>` : `<div class="calendar-day-empty"><strong>${scheduledTaskCount ? '这一天没有计划任务' : '还没有安排日历任务'}</strong><span>${scheduledTaskCount ? '未排期任务仍可在任务列表中查看。' : '可以在任务详情中设置计划日期；无计划日期的任务仍保留在任务列表。'}</span></div>`}
    </section>
    <footer class="page-footer"><span>日历按任务的计划日期显示</span><span>没有计划日期的任务不会从任务列表中隐藏</span></footer>`;
}

function selectCalendarDate(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (!year || !month || !day || localDateKey(date) !== dateKey) return;
  calendarSelectedDate = dateKey;
  calendarMonth = new Date(year, month - 1, 1);
  renderCalendarPage();
  [...document.querySelectorAll('[data-action="calendar-select-date"]')].find((button) => button.dataset.date === dateKey)?.focus();
}

function saveCalendarMood(dateKey, mood) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || (mood && !moodOptions.includes(mood))) return;
  const nextMoods = { ...calendarMoods };
  if (mood) nextMoods[dateKey] = mood;
  else delete nextMoods[dateKey];
  if (!persistTasks(tasks, economy, nextMoods)) return;
  renderCalendarPage();
  playUiSound('mood');
  document.querySelector(`[data-calendar-mood][data-date="${dateKey}"]`)?.focus();
  showToast(mood ? `${formatDate(dateKey, { month: 'numeric', day: 'numeric' })}心情标记已保存：${mood}` : '当天心情标记已清除。');
}

function navigateCalendarMonth(delta) {
  const day = Number(calendarSelectedDate.slice(-2));
  const targetMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + delta, 1);
  const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  calendarMonth = targetMonth;
  calendarSelectedDate = localDateKey(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(day || 1, lastDay)));
  renderCalendarPage();
  const action = delta < 0 ? 'calendar-prev' : 'calendar-next';
  document.querySelector(`[data-action="${action}"]`)?.focus();
}

function goToCalendarToday() {
  const today = new Date();
  calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  calendarSelectedDate = localDateKey(today);
  renderCalendarPage();
  document.querySelector('[data-action="calendar-today"]')?.focus();
}

function localDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function renderOverviewTasks() {
  const list = document.querySelector('#overview-task-list');
  if (!list) return;
  const today = localDateKey(new Date());
  const todayItems = tasks.filter((task) => task.plannedDate === today || (task.dueAt && localDateKey(new Date(task.dueAt)) === today) || (task.status === 'completed' && task.completedAt && localDateKey(new Date(task.completedAt)) === today));
  const todayIds = new Set(todayItems.map((task) => task.id));
  const outstanding = tasks.filter((task) => task.status !== 'completed' && !todayIds.has(task.id) && ((task.plannedDate && task.plannedDate < today) || (task.dueAt && localDateKey(new Date(task.dueAt)) < today)));
  const upcomingEnd = new Date();
  upcomingEnd.setDate(upcomingEnd.getDate() + 7);
  const upcomingEndKey = localDateKey(upcomingEnd);
  const upcoming = tasks.map((task) => {
    const dates = [task.plannedDate, task.dueAt ? localDateKey(new Date(task.dueAt)) : ''].filter((date) => date > today && date <= upcomingEndKey).sort();
    return { task, date: dates[0] || '' };
  }).filter(({ task, date }) => task.status !== 'completed' && date)
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const renderRows = (items, overdue = false, dateOverrides = {}) => items.map((task) => {
    const late = overdue && task.status !== 'completed';
    const overdueDates = [task.plannedDate, task.dueAt ? localDateKey(new Date(task.dueAt)) : ''].filter((value) => value && value < today).sort();
    const overdueDay = overdueDates[overdueDates.length - 1];
    const date = dateOverrides[task.id] || (late && overdueDay ? formatDate(overdueDay, { month: 'numeric', day: 'numeric' }) : (task.dueAt ? formatDate(task.dueAt, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (task.plannedDate ? formatDate(task.plannedDate, { month: 'numeric', day: 'numeric' }) : '')));
    const type = task.isBoss ? 'Boss' : `${categoryLabels[task.category] || '支线'}${task.category === 'main' && branchLabels[task.branch] ? ` · ${branchLabels[task.branch]}` : ''}`;
    return `<article class="overview-task-row ${task.status === 'completed' ? 'is-completed' : ''}">
      <button class="task-state state-${escapeHtml(task.status)}" type="button" data-action="toggle-task" data-id="${escapeHtml(task.id)}" aria-label="${task.status === 'completed' ? '重新打开' : '完成'}：${escapeHtml(task.title)}">${task.status === 'completed' ? '✓' : '○'}</button>
      <button class="overview-task-main" type="button" data-action="open-detail" data-id="${escapeHtml(task.id)}"><strong>${escapeHtml(task.title)}</strong><span>${date ? `${late ? '逾期 · ' : ''}${escapeHtml(date)} · ` : ''}${escapeHtml(statusLabels[task.status] || '待办')}</span></button>
      <span class="overview-task-type">${escapeHtml(type)}</span>
    </article>`;
  }).join('');
  const todayMarkup = todayItems.length ? renderRows(todayItems) : '<div class="overview-empty"><strong>今天还没有排期任务</strong><span>可以从创建入口添加一项，或查看全部任务。</span></div>';
  const overdueMarkup = outstanding.length ? `<section class="overview-subsection"><h3>需要留意的逾期任务 <span>${outstanding.length}</span></h3>${renderRows(outstanding, true)}</section>` : '';
  const upcomingMarkup = upcoming.length ? `<section class="overview-subsection"><h3>未来 7 天 <span>${upcoming.length}</span></h3>${renderRows(upcoming.map(({ task }) => task), false, Object.fromEntries(upcoming.map(({ task, date }) => [task.id, formatDate(date, { month: 'numeric', day: 'numeric' })])))}</section>` : '';
  list.innerHTML = `${todayMarkup}${overdueMarkup}${upcomingMarkup}`;
}

function updateTaskFilters(event) {
  const form = document.querySelector('#task-filters');
  if (!form) return;
  taskFiltersAdvancedOpen = Boolean(document.querySelector('#advanced-task-filters')?.open);
  if (event?.type === 'reset') {
    event.preventDefault();
    Object.assign(taskFilters, { status: '', category: '', branch: '', rarity: '', recurrence: '', boss: '', priority: '', tag: '', dateFrom: '', dateTo: '', sort: 'planned-asc' });
  } else {
    const fields = new FormData(form);
    Object.keys(taskFilters).forEach((key) => { taskFilters[key] = String(fields.get(key) || (key === 'sort' ? 'planned-asc' : '')); });
  }
  renderTaskPage();
  const focusName = event?.target?.name;
  if (focusName) document.querySelector(`#task-filters [name="${focusName}"]`)?.focus();
  else document.querySelector('#task-filter-reset')?.focus();
}

function openNewTask(parentId = '', returnDetailId = null) {
  taskForm.reset();
  taskForm.elements.namedItem('plannedDate').value = localDateKey(new Date());
  taskForm.elements.namedItem('id').value = '';
  taskForm.elements.namedItem('dailyRewardDate').value = '';
  taskForm.elements.namedItem('dailyRewardTemplateId').value = '';
  taskForm.elements.namedItem('parentId').value = parentId;
  taskForm.elements.namedItem('status').value = 'todo';
  taskForm.elements.namedItem('recurrence').value = 'once';
  taskForm.elements.namedItem('completionPercent').value = '';
  suggestionTouched = { xp: false, gold: false };
  document.querySelector('#task-dialog-title').textContent = '新建任务';
  document.querySelector('#task-form-error').hidden = true;
  returnToDetailAfterTaskDialog = returnDetailId;
  updateParentTaskField(parentId);
  updateBranchField();
  updateCompletionField();
  updateRewardSuggestions();
  taskDialog.showModal();
  playUiSound('open');
  taskForm.elements.namedItem('title').focus();
}

function openDailyCandidateTask(templateId) {
  const preset = DailyRewardRules.candidateTasks.find((item) => item.id === templateId);
  const today = localDateKey(new Date());
  if (!preset || tasks.some((task) => task.dailyRewardDate === today && task.dailyRewardTemplateId === templateId)) return;
  openNewTask();
  const fields = taskForm.elements;
  fields.namedItem('title').value = preset.title;
  fields.namedItem('description').value = preset.description;
  fields.namedItem('category').value = preset.category;
  fields.namedItem('branch').value = preset.branch;
  fields.namedItem('plannedDate').value = today;
  fields.namedItem('dailyRewardDate').value = today;
  fields.namedItem('dailyRewardTemplateId').value = preset.id;
  updateBranchField();
  updateRewardSuggestions();
  fields.namedItem('title').focus();
}

function openEditTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;
  const fields = taskForm.elements;
  fields.namedItem('id').value = task.id;
  fields.namedItem('dailyRewardDate').value = task.dailyRewardDate || '';
  fields.namedItem('dailyRewardTemplateId').value = task.dailyRewardTemplateId || '';
  fields.namedItem('parentId').value = task.parentId || '';
  fields.namedItem('title').value = task.title;
  fields.namedItem('description').value = task.description || '';
  fields.namedItem('category').value = task.category || 'side';
  fields.namedItem('branch').value = task.branch || '';
  fields.namedItem('status').value = task.status || 'todo';
  fields.namedItem('recurrence').value = task.recurrence || 'once';
  fields.namedItem('completionPercent').value = task.completionPercent ?? '';
  fields.namedItem('priority').value = task.priority || 'normal';
  fields.namedItem('rarity').value = task.rarity || 'common';
  fields.namedItem('isBoss').checked = Boolean(task.isBoss);
  fields.namedItem('plannedDate').value = task.plannedDate || '';
  fields.namedItem('dueAt').value = formatDateTimeLocalInput(task.dueAt);
  fields.namedItem('tags').value = (task.tags || []).join(', ');
  fields.namedItem('xpReward').value = task.xpReward ?? 0;
  fields.namedItem('goldReward').value = task.goldReward ?? 0;
  suggestionTouched = { xp: true, gold: true };
  document.querySelector('#task-dialog-title').textContent = '编辑任务';
  document.querySelector('#task-form-error').hidden = true;
  returnToDetailAfterTaskDialog = null;
  document.querySelector('#suggestion-note').textContent = '已保留任务现有奖励设置；调整任务属性不会改写已保存数值。';
  updateBranchField();
  updateParentTaskField(task.parentId || '');
  updateCompletionField();
  detailDialog.close();
  taskDialog.showModal();
  playUiSound('open');
  fields.namedItem('title').focus();
}

function updateParentTaskField(selectedParentId = '') {
  const select = taskForm.elements.namedItem('parentId');
  const currentId = taskForm.elements.namedItem('id').value;
  const parents = tasks.filter((task) => task.isBoss && !task.parentId && task.id !== currentId);
  select.innerHTML = `<option value="">独立任务</option>${parents.map((task) => `<option value="${escapeHtml(task.id)}">${escapeHtml(task.title)}</option>`).join('')}`;
  select.value = parents.some((task) => task.id === selectedParentId) ? selectedParentId : '';
  const isChild = Boolean(select.value);
  const bossCheck = taskForm.elements.namedItem('isBoss');
  bossCheck.disabled = isChild;
  if (isChild) bossCheck.checked = false;
  document.querySelector('#parent-task-hint').textContent = isChild
    ? '子任务可独立更新状态与领取奖励；不会自动完成所属 Boss。'
    : '关联顶层 Boss 可将此任务设为子任务；暂不支持子任务嵌套。';
  if (!suggestionTouched.xp || !suggestionTouched.gold) updateRewardSuggestions();
}

function updateCompletionField() {
  const status = taskForm.elements.namedItem('status').value;
  const taskId = taskForm.elements.namedItem('id').value;
  const existing = tasks.find((task) => task.id === taskId);
  const input = taskForm.elements.namedItem('completionPercent');
  document.querySelector('#completion-percent-field').hidden = status !== 'completed';
  input.required = status === 'completed' && existing?.status !== 'completed' && !existing?.rewardGrantedAt && !existing?.rewardSkippedLegacy;
  const hint = document.querySelector('#completion-field-hint');
  hint.textContent = existing?.rewardGrantedAt
    ? '可调整评分，但不会追溯修改已经发放的奖励。'
    : existing?.rewardSkippedLegacy
      ? '这是奖励系统启用前已完成的任务；评分不会触发补发。'
      : '每日进度按原始完成度累计；XP/金币奖励最高按 200% 加权。';
}

function updateBranchField() {
  const isMain = taskForm.elements.namedItem('category').value === 'main';
  const branchField = document.querySelector('#branch-field');
  branchField.hidden = !isMain;
  const branchSelect = taskForm.elements.namedItem('branch');
  branchSelect.required = isMain;
  if (!isMain) branchSelect.value = '';
}

function updateRewardSuggestions() {
  const fields = taskForm.elements;
  const suggestion = RewardRules.suggestTaskRewards({
    category: fields.namedItem('category').value,
    rarity: fields.namedItem('rarity').value,
    isBoss: fields.namedItem('isBoss').checked,
    recurrence: fields.namedItem('recurrence').value,
  });
  if (!suggestionTouched.xp) fields.namedItem('xpReward').value = suggestion.xp;
  if (!suggestionTouched.gold) fields.namedItem('goldReward').value = suggestion.gold;
  document.querySelector('#suggestion-note').textContent = `系统建议：${suggestion.xp} XP · ${suggestion.gold} 金币。你可以直接调整；建议规则集中在 reward-rules.js。`;
}

function collectTask(formData) {
  const existingId = formData.get('id');
  const existing = tasks.find((task) => task.id === existingId);
  const status = formData.get('status');
  const isCompleted = status === 'completed';
  return {
    ...(existing || {}),
    id: existingId || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    title: String(formData.get('title') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    category: formData.get('category') || 'side',
    branch: formData.get('category') === 'main' ? formData.get('branch') : '',
    status,
    recurrence: formData.get('recurrence') || 'once',
    priority: formData.get('priority') || 'normal',
    rarity: formData.get('rarity') || 'common',
    isBoss: !formData.get('parentId') && taskForm.elements.namedItem('isBoss').checked,
    parentId: String(formData.get('parentId') || ''),
    plannedDate: formData.get('plannedDate') || '',
    dueAt: formData.get('dueAt') ? new Date(formData.get('dueAt')).toISOString() : '',
    tags: String(formData.get('tags') || '').split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
    xpReward: Math.max(0, Math.floor(Number(formData.get('xpReward')) || 0)),
    goldReward: Math.max(0, Math.floor(Number(formData.get('goldReward')) || 0)),
    completionPercent: formData.get('completionPercent') === '' ? (existing?.completionPercent ?? null) : Number(formData.get('completionPercent')),
    dailyRewardDate: String(formData.get('dailyRewardDate') || existing?.dailyRewardDate || ''),
    dailyRewardTemplateId: String(formData.get('dailyRewardTemplateId') || existing?.dailyRewardTemplateId || ''),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: isCompleted ? (existing?.status === 'completed' ? existing.completedAt : new Date().toISOString()) : null,
    logs: existing?.logs || [],
  };
}

function submitTask(event) {
  event.preventDefault();
  const formData = new FormData(taskForm);
  const title = String(formData.get('title') || '').trim();
  const error = document.querySelector('#task-form-error');
  if (!title) {
    error.textContent = '请填写任务名称。';
    error.hidden = false;
    taskForm.elements.namedItem('title').focus();
    return;
  }
  if (formData.get('category') === 'main' && !formData.get('branch')) {
    error.textContent = '主线任务需要选择科研、学业或找工分支。';
    error.hidden = false;
    taskForm.elements.namedItem('branch').focus();
    return;
  }
  const id = formData.get('id');
  const previous = tasks.find((task) => task.id === id);
  const parentId = String(formData.get('parentId') || '');
  const parent = tasks.find((task) => task.id === parentId);
  if (parentId && (!parent?.isBoss || parent.parentId || parent.id === id)) {
    error.textContent = '请选择有效的顶层 Boss；子任务暂不支持嵌套。';
    error.hidden = false;
    taskForm.elements.namedItem('parentId').focus();
    return;
  }
  if (previous?.isBoss && !taskForm.elements.namedItem('isBoss').checked && tasks.some((task) => task.parentId === id)) {
    error.textContent = '请先解除所有子任务的关联，再取消 Boss 属性。';
    error.hidden = false;
    taskForm.elements.namedItem('isBoss').focus();
    return;
  }
  const completionValue = Number(formData.get('completionPercent'));
  if (formData.get('status') === 'completed' && previous?.status !== 'completed' && !previous?.rewardGrantedAt && !previous?.rewardSkippedLegacy && (formData.get('completionPercent') === '' || !Number.isSafeInteger(completionValue) || completionValue < 0)) {
    error.textContent = '首次完成任务时，请输入 0% 以上的整数完成度。';
    error.hidden = false;
    taskForm.elements.namedItem('completionPercent').focus();
    return;
  }
  let next = collectTask(formData);
  let nextEconomy = economy;
  let awardedNow = false;
  if (next.status === 'completed') {
    const outcome = registerFirstCompletion(next, previous, economy);
    next = outcome.task;
    nextEconomy = outcome.economy;
    awardedNow = outcome.awarded;
  }
  const nextTasks = id ? tasks.map((task) => task.id === id ? next : task) : [...tasks, next];
  if (!persistTasks(nextTasks, nextEconomy)) return;
  taskDialog.close();
  refreshTaskView();
  const award = nextEconomy.ledger.find((entry) => entry.taskId === next.id);
  if (awardedNow) playUiSound('complete');
  else playUiSound(id ? 'save' : 'create');
  showToast(awardedNow ? `任务已完成（${next.completionPercent}%），获得 ${award.xpDelta} XP 和 ${award.goldDelta} 金币。` : id ? '任务已保存，进展记录已保留。' : '任务已创建。');
}

function detailRows(task) {
  const award = (economy.ledger || []).find((entry) => entry.taskId === task.id);
  const completionLabel = task.completionPercent == null
    ? (task.rewardSkippedLegacy || award?.legacyUnweighted ? '历史完成未记录评分' : '尚未评分')
    : `${task.completionPercent}%`;
  const awardLabel = award
    ? award.legacyUnweighted
      ? `${award.xpDelta} XP · ${award.goldDelta} 金币 · 旧规则发放（未记录评分）`
      : `${award.xpDelta} XP · ${award.goldDelta} 金币（评分 ${award.completionPercent}%，奖励按 ${award.rewardWeightPercent ?? Math.min(RewardRules.completionRewardCap, award.completionPercent)}% 加权）`
    : task.rewardSkippedLegacy ? '在奖励系统启用前已完成，不补发' : task.rewardGrantedAt ? '此任务已领取过奖励' : '尚未发放';
  const rows = [
    ['类别', `${categoryLabels[task.category] || '支线'}${task.category === 'main' && branchLabels[task.branch] ? ` · ${branchLabels[task.branch]}` : ''}`],
    ['状态', statusLabels[task.status] || '待办'],
    ['挑战', task.isBoss ? 'Boss 挑战' : '普通任务'],
    ['重复周期', recurrenceLabels[task.recurrence] || '一次性'],
    ['优先级', priorityLabels[task.priority] || '普通优先级'],
    ['稀有度', rarityLabels[task.rarity] || '普通'],
    ['计划日期', formatDate(task.plannedDate) || '未安排'],
    ['截止时间', formatDate(task.dueAt, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || '未设置'],
    ['完成时间', formatDate(task.completedAt, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || '尚未完成'],
    ['完成度', completionLabel],
    ['标签', (task.tags || []).join('、') || '无'],
    ['奖励设置', `${task.xpReward ?? 0} XP · ${task.goldReward ?? 0} 金币`],
    ['奖励发放', award ? `${awardLabel} · ${formatDate(award.createdAt, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : awardLabel],
  ];
  return rows.map(([label, value]) => `<div class="detail-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
}

function renderTaskRelations(task) {
  if (task.isBoss && !task.parentId) {
    const children = tasks.filter((item) => item.parentId === task.id);
    const completed = children.filter((item) => item.status === 'completed').length;
    const progress = children.length ? Math.round(completed / children.length * 100) : 0;
    return `<section class="task-relations" aria-labelledby="child-tasks-heading"><div class="section-heading"><div><p class="eyebrow">挑战拆解</p><h3 id="child-tasks-heading">子任务进度 ${completed}/${children.length}</h3></div><button class="pixel-button button-muted" type="button" data-action="new-child-task" data-id="${escapeHtml(task.id)}">＋ 添加子任务</button></div>${children.length ? `<div class="boss-progress-track" role="progressbar" aria-label="子任务完成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div><div class="child-task-list">${children.map((child) => `<button class="child-task-row" type="button" data-action="open-detail" data-id="${escapeHtml(child.id)}"><span>${escapeHtml(child.title)}</span><span class="status-pill status-${escapeHtml(child.status)}">${escapeHtml(statusLabels[child.status] || '待办')}</span></button>`).join('')}</div>` : '<p class="log-empty">还没有子任务。拆分后可分别跟踪进展；父任务与子任务状态独立。</p>'}<p class="field-hint">状态与奖励分别记录；完成 Boss 不会自动完成子任务，完成子任务也不会自动完成 Boss。</p></section>`;
  }
  if (task.parentId) {
    const parent = tasks.find((item) => item.id === task.parentId);
    if (parent) return `<section class="task-relations"><p class="eyebrow">所属 Boss</p><button class="child-task-row" type="button" data-action="open-detail" data-id="${escapeHtml(parent.id)}"><span>${escapeHtml(parent.title)}</span><span class="status-pill status-${escapeHtml(parent.status)}">${escapeHtml(statusLabels[parent.status] || '待办')}</span></button><p class="field-hint">子任务状态与奖励独立记录，不会自动改变所属 Boss。</p></section>`;
  }
  return '';
}

function renderDetail(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;
  activeDetailId = id;
  document.querySelector('#detail-content').innerHTML = `
    <div class="dialog-heading"><div><p class="eyebrow">${escapeHtml(categoryLabels[task.category] || '支线')}${task.isBoss ? ' · BOSS 挑战' : ''}</p><h2 id="detail-title">${escapeHtml(task.title)}</h2></div><button class="icon-button" type="button" data-close-dialog="detail-dialog" aria-label="关闭">×</button></div>
    ${task.description ? `<p class="detail-description">${escapeHtml(task.description).replace(/\n/g, '<br>')}</p>` : '<p class="detail-description detail-empty-description">还没有填写描述。</p>'}
    <dl class="detail-list">${detailRows(task)}</dl>
    ${renderTaskRelations(task)}
    <section class="log-section" aria-labelledby="log-heading"><div class="log-heading"><h3 id="log-heading">进展记录</h3><span>${task.logs.length} 条</span></div>
      ${task.logs.length ? `<ol class="log-list">${[...task.logs].reverse().map((log) => `<li><time datetime="${escapeHtml(log.createdAt)}">${escapeHtml(formatDate(log.createdAt, { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</time><p>${escapeHtml(log.content).replace(/\n/g, '<br>')}</p></li>`).join('')}</ol>` : '<p class="log-empty">记录任务过程中的小进展，方便之后回顾。</p>'}
      <form class="log-form" data-log-form><label for="log-content">添加一条进展</label><textarea id="log-content" name="content" rows="2" required maxlength="1000" placeholder="今天推进了什么？"></textarea><button class="pixel-button" type="submit">保存记录</button></form>
    </section>
    <div class="dialog-actions detail-actions"><button class="pixel-button button-danger" type="button" data-action="delete-task" data-id="${escapeHtml(task.id)}">删除任务</button><span></span><button class="pixel-button button-muted" type="button" data-action="edit-task" data-id="${escapeHtml(task.id)}">编辑</button><button class="pixel-button" type="button" data-action="toggle-task" data-id="${escapeHtml(task.id)}">${task.status === 'completed' ? '重新打开' : '标记完成'}</button></div>`;
  if (!detailDialog.open) detailDialog.showModal();
}

function toggleTask(id) {
  const current = tasks.find((task) => task.id === id);
  if (!current) return;
  const reopening = current.status === 'completed';
  if (!reopening) {
    openCompletionDialog(id);
    return;
  }
  const now = new Date().toISOString();
  const updated = { ...current, status: 'todo', completedAt: null, updatedAt: now };
  const nextTasks = tasks.map((task) => task.id === id ? updated : task);
  if (!persistTasks(nextTasks)) return;
  playUiSound('status');
  refreshTaskView();
  if (detailDialog.open && activeDetailId === id) renderDetail(id);
  showToast('任务已重新打开；已发放奖励不会撤回。');
}

function setTaskStatus(id, status) {
  const current = tasks.find((task) => task.id === id);
  if (!current || !Object.prototype.hasOwnProperty.call(statusLabels, status) || current.status === status) return;
  if (status === 'completed') {
    const boardSelect = [...document.querySelectorAll('[data-board-status]')].find((select) => select.dataset.id === id);
    if (boardSelect) boardSelect.value = current.status;
    openCompletionDialog(id);
    return;
  }
  const reopening = current.status === 'completed';
  const updated = { ...current, status, completedAt: null, updatedAt: new Date().toISOString() };
  const nextTasks = tasks.map((task) => task.id === id ? updated : task);
  if (!persistTasks(nextTasks)) return;
  playUiSound('status');
  refreshTaskView();
  if (location.hash === '#board') [...document.querySelectorAll('[data-board-status]')].find((select) => select.dataset.id === id)?.focus();
  showToast(reopening ? '任务已重新打开；已发放奖励不会撤回。' : `任务状态已更新为“${statusLabels[status]}”。`);
}

function openCompletionDialog(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;
  completionForm.reset();
  completionForm.elements.namedItem('taskId').value = id;
  completionForm.elements.namedItem('completionPercent').value = '';
  document.querySelector('#completion-task-title').textContent = task.title;
  completionDialog.showModal();
  completionForm.elements.namedItem('completionPercent').focus();
}

function completeTask(id, completionPercent) {
  const previous = tasks.find((task) => task.id === id);
  if (!previous || previous.status === 'completed') return;
  const now = new Date().toISOString();
  const updated = { ...previous, status: 'completed', completionPercent, completedAt: now, updatedAt: now };
  const outcome = registerFirstCompletion(updated, previous, economy);
  const nextTasks = tasks.map((task) => task.id === id ? outcome.task : task);
  if (!persistTasks(nextTasks, outcome.economy)) return;
  completionDialog.close();
  refreshTaskView();
  if (location.hash === '#board') [...document.querySelectorAll('[data-board-status]')].find((select) => select.dataset.id === id)?.focus();
  if (detailDialog.open && activeDetailId === id) renderDetail(id);
  const award = outcome.economy.ledger.find((entry) => entry.taskId === id);
  if (outcome.awarded) playUiSound('complete');
  showToast(outcome.awarded ? `任务完成度 ${completionPercent}%，获得 ${award.xpDelta} XP 和 ${award.goldDelta} 金币。` : '任务已完成；此任务不会重复发放奖励。');
}

function submitCompletion(event) {
  event.preventDefault();
  const fields = new FormData(completionForm);
  const rawPercent = fields.get('completionPercent');
  const percent = Number(rawPercent);
  if (rawPercent === '' || !Number.isSafeInteger(percent) || percent < 0) {
    completionForm.elements.namedItem('completionPercent').setCustomValidity('请输入 0% 以上的整数。');
    completionForm.reportValidity();
    completionForm.elements.namedItem('completionPercent').setCustomValidity('');
    return;
  }
  completeTask(String(fields.get('taskId')), percent);
}

function registerFirstCompletion(task, previous, sourceEconomy) {
  const alreadyGranted = previous?.rewardGrantedAt || previous?.rewardSkippedLegacy || (sourceEconomy.ledger || []).some((entry) => entry.taskId === task.id);
  if (alreadyGranted) return { task: { ...task, rewardGrantedAt: previous?.rewardGrantedAt || null, rewardSkippedLegacy: Boolean(previous?.rewardSkippedLegacy) }, economy: sourceEconomy, awarded: false };
  const createdAt = task.completedAt || new Date().toISOString();
  const entry = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${task.id}`,
    type: 'task_reward',
    taskId: task.id,
    title: task.title,
    xpBase: Math.max(0, Math.floor(Number(task.xpReward) || 0)),
    goldBase: Math.max(0, Math.floor(Number(task.goldReward) || 0)),
    xpDelta: RewardRules.applyCompletionWeight(task.xpReward, task.completionPercent),
    goldDelta: RewardRules.applyCompletionWeight(task.goldReward, task.completionPercent),
    completionPercent: task.completionPercent,
    rewardWeightPercent: Math.min(RewardRules.completionRewardCap, task.completionPercent),
    createdAt,
  };
  return {
    task: { ...task, rewardGrantedAt: createdAt, rewardSkippedLegacy: false },
    economy: { ...sourceEconomy, ledger: [...(sourceEconomy.ledger || []), entry] },
    awarded: true,
    entry,
  };
}

function deleteTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;
  const children = tasks.filter((item) => item.parentId === id);
  const childNote = children.length ? `关联的 ${children.length} 个子任务将保留，但解除 Boss 关联。` : '';
  if (!window.confirm(`确定删除“${task.title}”吗？该任务及其进展记录会从此浏览器中移除。${childNote}`)) return;
  const now = new Date().toISOString();
  const nextTasks = tasks.filter((item) => item.id !== id).map((item) => item.parentId === id ? { ...item, parentId: '', updatedAt: now } : item);
  if (!persistTasks(nextTasks)) return;
  playUiSound('delete');
  detailDialog.close();
  activeDetailId = null;
  refreshTaskView();
  showToast('任务和相关进展记录已删除。');
}

function addLog(form) {
  const content = String(new FormData(form).get('content') || '').trim();
  if (!content || !activeDetailId) return;
  const timestamp = new Date().toISOString();
  const nextTasks = tasks.map((task) => task.id === activeDetailId ? { ...task, updatedAt: timestamp, logs: [...(task.logs || []), { id: globalThis.crypto?.randomUUID?.() || `${Date.now()}`, content, createdAt: timestamp }] } : task);
  if (!persistTasks(nextTasks)) return;
  playUiSound('save');
  renderDetail(activeDetailId);
  showToast('进展记录已保存。');
}

document.querySelector('#today-label').textContent = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date());
document.querySelector('#full-date').textContent = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
document.querySelector('#storage-mode-label').textContent = LocalDataStore.active ? '项目文件本地存储' : '浏览器本地存储';
document.querySelectorAll('[data-pixel-icon]').forEach((element) => { element.innerHTML = PixelUI.icon(element.dataset.pixelIcon); });
updateSoundToggle();
page.dataset.overview = page.innerHTML;
window.addEventListener('hashchange', renderRoute);
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) {
    state = loadState();
    tasks = state.tasks;
    economy = state.economy;
    calendarMoods = state.calendarMoods;
    rewards = state.rewards;
    dailyRewardClaims = state.dailyRewardClaims;
    customAchievements = state.customAchievements;
    achievementUnlocks = state.achievementUnlocks;
    soundEnabled = state.soundEnabled;
    updateSoundToggle();
    if (location.hash === '#tasks') renderTaskPage();
    if (location.hash === '#board') renderBoardPage();
    if (location.hash === '#calendar') renderCalendarPage();
    if (location.hash === '#growth') renderGrowthPage();
    if (location.hash === '#rewards') renderRewardsPage();
    if (location.hash === '#daily') renderDailyRewardPage();
    if (location.hash === '#achievements') renderAchievementsPage();
    if (location.hash === '#overview') renderRoute();
    if (detailDialog.open && activeDetailId) {
      if (tasks.some((task) => task.id === activeDetailId)) renderDetail(activeDetailId);
      else detailDialog.close();
    }
  }
});
document.addEventListener('click', (event) => {
  const closeButton = event.target.closest('[data-close-dialog]');
  if (closeButton) { document.querySelector(`#${closeButton.dataset.closeDialog}`).close(); return; }
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  const { action, id } = actionButton.dataset;
  if (action === 'new-task') openNewTask();
  if (action === 'new-reward') openNewReward();
  if (action === 'edit-reward') openEditReward(id);
  if (action === 'toggle-reward') toggleReward(id);
  if (action === 'redeem-reward') redeemReward(id, actionButton.dataset.redemptionKey);
  if (action === 'claim-daily-reward') claimDailyReward();
  if (action === 'add-daily-template') openDailyCandidateTask(id);
  if (action === 'new-achievement') openNewAchievement();
  if (action === 'toggle-audio') toggleSound();
  if (action === 'new-child-task') {
    const parent = tasks.find((task) => task.id === id);
    if (parent?.isBoss && !parent.parentId) {
      detailDialog.close();
      openNewTask(parent.id, parent.id);
    }
  }
  if (action === 'calendar-prev') navigateCalendarMonth(-1);
  if (action === 'calendar-next') navigateCalendarMonth(1);
  if (action === 'calendar-today') goToCalendarToday();
  if (action === 'calendar-select-date') selectCalendarDate(actionButton.dataset.date);
  if (action === 'show-level-detail') showLevelDetails();
  if (action === 'open-detail') renderDetail(id);
  if (action === 'edit-task') openEditTask(id);
  if (action === 'toggle-task') toggleTask(id);
  if (action === 'delete-task') deleteTask(id);
});
document.addEventListener('submit', (event) => {
  if (event.target === taskForm) submitTask(event);
  if (event.target === completionForm) submitCompletion(event);
  if (event.target === rewardForm) submitReward(event);
  if (event.target === achievementForm) submitAchievement(event);
  if (event.target.id === 'task-filters') event.preventDefault();
  if (event.target.matches('[data-log-form]')) { event.preventDefault(); addLog(event.target); }
});
document.addEventListener('change', (event) => {
  if (event.target === achievementForm.elements.namedItem('kind')) {
    updateAchievementTagField();
    return;
  }
  if (event.target.matches('[data-calendar-mood]')) {
    saveCalendarMood(event.target.dataset.date, event.target.value);
    return;
  }
  if (event.target.name === 'parentId') {
    updateParentTaskField(event.target.value);
    return;
  }
  if (event.target.matches('[data-board-status]')) {
    setTaskStatus(event.target.dataset.id, event.target.value);
    return;
  }
  if (event.target.closest('#task-filters')) updateTaskFilters(event);
});
taskDialog.addEventListener('close', () => {
  const parentId = returnToDetailAfterTaskDialog;
  returnToDetailAfterTaskDialog = null;
  if (parentId && tasks.some((task) => task.id === parentId)) renderDetail(parentId);
});
document.addEventListener('reset', (event) => {
  if (event.target.id === 'task-filters') updateTaskFilters(event);
});
rewardForm.elements.namedItem('template').addEventListener('change', applyRewardTemplate);
taskForm.elements.namedItem('category').addEventListener('change', () => { updateBranchField(); updateRewardSuggestions(); });
taskForm.elements.namedItem('isBoss').addEventListener('change', () => { updateRewardSuggestions(); });
['recurrence', 'rarity'].forEach((name) => taskForm.elements.namedItem(name).addEventListener('change', updateRewardSuggestions));
taskForm.elements.namedItem('status').addEventListener('change', updateCompletionField);
taskForm.elements.namedItem('xpReward').addEventListener('input', () => { suggestionTouched.xp = true; });
taskForm.elements.namedItem('goldReward').addEventListener('input', () => { suggestionTouched.gold = true; });
if (LocalDataStore.active || reconcileAchievementUnlocks(achievementUnlocks, tasks, economy).newlyUnlocked.length) {
  persistTasks(tasks, economy, calendarMoods, rewards, dailyRewardClaims);
}
renderRoute();
