// Initial thresholds are configurable defaults; custom definitions are saved with application data.
window.AchievementRules = Object.freeze({
  icons: Object.freeze(['star', 'flask', 'book', 'briefcase', 'code', 'heart', 'boss', 'coin', 'calendar', 'leaf', 'target', 'medal']),
  conditionKinds: Object.freeze([
    Object.freeze({ id: 'completed-tasks', label: '完成任务总数' }),
    Object.freeze({ id: 'research-tasks', label: '完成科研主线任务数' }),
    Object.freeze({ id: 'study-tasks', label: '完成学业主线任务数' }),
    Object.freeze({ id: 'career-tasks', label: '完成找工主线任务数' }),
    Object.freeze({ id: 'tagged-tasks', label: '完成指定标签任务数' }),
    Object.freeze({ id: 'completed-subtasks', label: '完成 Boss 子任务数' }),
    Object.freeze({ id: 'completed-bosses', label: '完成 Boss 数' }),
    Object.freeze({ id: 'completed-days', label: '有任务完成记录的不同天数' }),
    Object.freeze({ id: 'redemptions', label: '奖励商店兑换次数' }),
    Object.freeze({ id: 'daily-claims', label: '每日奖励领取次数' }),
  ]),
  defaultDefinitions: Object.freeze([
    Object.freeze({ id: 'first-step', title: '初次出发', category: '成长启程', description: '完成你的第一项任务。', icon: 'star', kind: 'completed-tasks', target: 1 }),
    Object.freeze({ id: 'steady-five', title: '渐入佳境', category: '成长启程', description: '累计完成 5 项任务。', icon: 'medal', kind: 'completed-tasks', target: 5 }),
    Object.freeze({ id: 'long-road', title: '行者无疆', category: '成长启程', description: '累计完成 20 项任务。', icon: 'target', kind: 'completed-tasks', target: 20 }),
    Object.freeze({ id: 'seven-days', title: '日积月累', category: '成长启程', description: '在 7 个不同的日子完成过任务。', icon: 'calendar', kind: 'completed-days', target: 7 }),

    Object.freeze({ id: 'research-first', title: '研究启程', category: '科研', description: '完成第一项科研主线任务。', icon: 'flask', kind: 'research-tasks', target: 1 }),
    Object.freeze({ id: 'research-five', title: '论文猎人', category: '科研', description: '完成 5 项科研主线任务。', icon: 'book', kind: 'research-tasks', target: 5 }),
    Object.freeze({ id: 'research-twenty', title: '实验室常客', category: '科研', description: '完成 20 项科研主线任务。', icon: 'flask', kind: 'research-tasks', target: 20 }),

    Object.freeze({ id: 'study-first', title: '求知若渴', category: '学业', description: '完成第一项学业主线任务。', icon: 'book', kind: 'study-tasks', target: 1 }),
    Object.freeze({ id: 'study-five', title: '勤学不辍', category: '学业', description: '完成 5 项学业主线任务。', icon: 'medal', kind: 'study-tasks', target: 5 }),
    Object.freeze({ id: 'study-twenty', title: '学有所成', category: '学业', description: '完成 20 项学业主线任务。', icon: 'book', kind: 'study-tasks', target: 20 }),

    Object.freeze({ id: 'career-first', title: '新的航向', category: '求职', description: '完成第一项找工主线任务。', icon: 'briefcase', kind: 'career-tasks', target: 1 }),
    Object.freeze({ id: 'career-five', title: '求职准备中', category: '求职', description: '完成 5 项找工主线任务。', icon: 'briefcase', kind: 'career-tasks', target: 5 }),
    Object.freeze({ id: 'career-twenty', title: '机会捕手', category: '求职', description: '完成 20 项找工主线任务。', icon: 'target', kind: 'career-tasks', target: 20 }),

    Object.freeze({ id: 'code-first', title: 'Hello World', category: '编程与自学', description: '完成第一项带编程、算法或 LeetCode 标签的任务。', icon: 'code', kind: 'tagged-tasks', tags: Object.freeze(['编程', '算法', 'leetcode']), target: 1 }),
    Object.freeze({ id: 'code-five', title: '算法学徒', category: '编程与自学', description: '完成 5 项编程或算法标签任务。', icon: 'code', kind: 'tagged-tasks', tags: Object.freeze(['编程', '算法', 'leetcode']), target: 5 }),
    Object.freeze({ id: 'code-twenty', title: '代码修行者', category: '编程与自学', description: '完成 20 项编程或算法标签任务。', icon: 'code', kind: 'tagged-tasks', tags: Object.freeze(['编程', '算法', 'leetcode']), target: 20 }),
    Object.freeze({ id: 'self-study-five', title: '自学成才', category: '编程与自学', description: '完成 5 项带自学标签的任务。', icon: 'book', kind: 'tagged-tasks', tags: Object.freeze(['自学', '自修', 'self-study']), target: 5 }),

    Object.freeze({ id: 'life-first', title: '照顾好自己', category: '生活与习惯', description: '完成第一项生活、习惯或健康标签任务。', icon: 'heart', kind: 'tagged-tasks', tags: Object.freeze(['生活', '习惯', '健康', '运动', '家务']), target: 1 }),
    Object.freeze({ id: 'life-ten', title: '生活有序', category: '生活与习惯', description: '完成 10 项生活、习惯或健康标签任务。', icon: 'leaf', kind: 'tagged-tasks', tags: Object.freeze(['生活', '习惯', '健康', '运动', '家务']), target: 10 }),
    Object.freeze({ id: 'life-days', title: '细水长流', category: '生活与习惯', description: '在 30 个不同的日子完成过任务。', icon: 'calendar', kind: 'completed-days', target: 30 }),

    Object.freeze({ id: 'boss-first', title: '勇者归来', category: 'Boss 挑战', description: '完成一个 Boss 挑战。', icon: 'boss', kind: 'completed-bosses', target: 1 }),
    Object.freeze({ id: 'boss-three', title: '挑战常胜军', category: 'Boss 挑战', description: '完成 3 个 Boss 挑战。', icon: 'boss', kind: 'completed-bosses', target: 3 }),
    Object.freeze({ id: 'boss-ten', title: '传奇冒险者', category: 'Boss 挑战', description: '完成 10 个 Boss 挑战。', icon: 'medal', kind: 'completed-bosses', target: 10 }),
    Object.freeze({ id: 'subtasks-ten', title: '拆解大师', category: 'Boss 挑战', description: '完成 10 项 Boss 子任务。', icon: 'target', kind: 'completed-subtasks', target: 10 }),

    Object.freeze({ id: 'reward-first', title: '奖励收藏家', category: '奖励与探索', description: '在奖励商店完成首次兑换。', icon: 'coin', kind: 'redemptions', target: 1 }),
    Object.freeze({ id: 'reward-five', title: '犒赏有度', category: '奖励与探索', description: '累计完成 5 次商店兑换。', icon: 'coin', kind: 'redemptions', target: 5 }),
    Object.freeze({ id: 'reward-twenty', title: '现实体验家', category: '奖励与探索', description: '累计完成 20 次商店兑换。', icon: 'star', kind: 'redemptions', target: 20 }),
    Object.freeze({ id: 'daily-seven', title: '每日仪式', category: '奖励与探索', description: '领取 7 次每日奖励。', icon: 'calendar', kind: 'daily-claims', target: 7 }),
  ]),
});
