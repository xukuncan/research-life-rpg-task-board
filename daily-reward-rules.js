/* Daily reward defaults are deliberately centralized and easy to adjust. */
window.DailyRewardRules = Object.freeze({
  requiredCompletionPercent: 500,
  reward: Object.freeze({
    name: '游戏时间',
    amount: 1,
    unit: '小时',
  }),
  candidateTasks: Object.freeze([
    Object.freeze({ id: 'research-hour', title: '主线科研任务 1h', category: 'main', branch: 'research', description: '投入一小时推进科研工作。' }),
    Object.freeze({ id: 'career-hour', title: '主线找工任务 1h', category: 'main', branch: 'career', description: '投入一小时推进找工准备。' }),
    Object.freeze({ id: 'study-hour', title: '主线学业任务 1h', category: 'main', branch: 'study', description: '投入一小时推进学业任务。' }),
    Object.freeze({ id: 'exercise-once', title: '支线运动任务一次', category: 'side', branch: '', description: '完成一次运动。' }),
    Object.freeze({ id: 'self-study-hour', title: '支线自学任务 1h', category: 'side', branch: '', description: '投入一小时进行自学。' }),
  ]),
});
