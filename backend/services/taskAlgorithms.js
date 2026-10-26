const priorityPoints = { HIGH: 30, MEDIUM: 20, LOW: 10 };
const day = 24 * 60 * 60 * 1000;

export function getTaskCounters({ total, completed, today, overdue }) {
  return {
    total,
    completed,
    remaining: total - completed,
    today,
    overdue,
    progress: total ? Math.round((completed / total) * 100) : 0
  };
}

export function recommendTaskOrder(tasks, now = new Date()) {
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday.getTime() + day);
  return tasks.map((task) => {
    const overdue = task.dueDate < startOfToday;
    const dueToday = task.dueDate >= startOfToday && task.dueDate < startOfTomorrow;
    const priorityScore = priorityPoints[task.priority] + (overdue ? 40 : dueToday ? 25 : 0) - Math.floor(task.estimatedDuration / 60);
    return { ...task, isOverdue: overdue, priorityScore };
  }).sort((a, b) => b.priorityScore - a.priorityScore || a.dueDate - b.dueDate || a.estimatedDuration - b.estimatedDuration);
}

function readableMinutes(minutes) {
  const value = Math.round(minutes);
  const hours = Math.floor(value / 60);
  const remaining = value % 60;
  return [hours ? `${hours} hour${hours === 1 ? '' : 's'}` : '', remaining ? `${remaining} minute${remaining === 1 ? '' : 's'}` : ''].filter(Boolean).join(' ') || '0 minutes';
}

export function estimateCompletion(tasks, simulations = 1000) {
  const totals = Array.from({ length: Math.max(1000, simulations) }, () => tasks.reduce((sum, task) => sum + task.estimatedDuration * (0.8 + Math.random() * 0.4), 0));
  const minimumEstimatedTime = Math.round(Math.min(...totals));
  const maximumEstimatedTime = Math.round(Math.max(...totals));
  const averageEstimatedTime = Math.round(totals.reduce((sum, value) => sum + value, 0) / totals.length);
  return {
    simulations: totals.length,
    minimumEstimatedTime,
    averageEstimatedTime,
    maximumEstimatedTime,
    readable: {
      minimum: readableMinutes(minimumEstimatedTime),
      average: readableMinutes(averageEstimatedTime),
      maximum: readableMinutes(maximumEstimatedTime)
    }
  };
}
