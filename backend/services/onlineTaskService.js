import prisma from '../utils/prisma.js';
import { getTaskCounters } from './taskAlgorithms.js';

export async function getTaskSnapshot(userId) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const [tasks, total, completed, dueToday, overdue] = await Promise.all([
    prisma.task.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.task.count({ where: { userId } }),
    prisma.task.count({ where: { userId, isCompleted: true } }),
    prisma.task.count({ where: { userId, isCompleted: false, dueDate: { gte: today, lt: tomorrow } } }),
    prisma.task.count({ where: { userId, isCompleted: false, dueDate: { lt: today } } })
  ]);
  return {
    tasks: tasks.map((task) => ({ ...task, isOverdue: !task.isCompleted && task.dueDate < today })),
    counters: getTaskCounters({ total, completed, today: dueToday, overdue })
  };
}
