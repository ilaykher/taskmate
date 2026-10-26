import prisma from '../utils/prisma.js';
import asyncHandler from '../utils/asyncHandler.js';
import { estimateCompletion, recommendTaskOrder } from '../services/taskAlgorithms.js';
import { getTaskSnapshot } from '../services/onlineTaskService.js';

const priorities = new Set(['LOW', 'MEDIUM', 'HIGH']);
const requiredFields = ['title', 'dueDate', 'priority', 'category', 'estimatedDuration'];

function taskInput(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'A task object is required.';
  if (!partial && requiredFields.some((key) => !Object.hasOwn(body, key))) return 'Title, due date, priority, category, and estimated duration are required.';
  if (Object.hasOwn(body, 'title') && (typeof body.title !== 'string' || !body.title.trim())) return 'Title is required.';
  if (Object.hasOwn(body, 'dueDate') && (typeof body.dueDate !== 'string' || !body.dueDate || Number.isNaN(Date.parse(body.dueDate)))) return 'A valid due date is required.';
  if (Object.hasOwn(body, 'priority') && !priorities.has(body.priority)) return 'Priority must be LOW, MEDIUM, or HIGH.';
  if (Object.hasOwn(body, 'category') && (typeof body.category !== 'string' || !body.category.trim())) return 'Category is required.';
  if (Object.hasOwn(body, 'estimatedDuration') && (!Number.isSafeInteger(body.estimatedDuration) || body.estimatedDuration < 1)) return 'Estimated duration must be a positive whole number of minutes.';
  if (Object.hasOwn(body, 'description') && body.description !== null && typeof body.description !== 'string') return 'Description must be text.';

  return Object.fromEntries(['title', 'description', 'dueDate', 'priority', 'category', 'estimatedDuration'].filter((key) => Object.hasOwn(body, key)).map((key) => [
    key,
    key === 'title' || key === 'category' ? body[key].trim() : key === 'description' && body[key] === '' ? null : key === 'dueDate' ? new Date(body[key]) : body[key]
  ]));
}

function taskId(rawId) {
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export const listTasks = asyncHandler(async (req, res) => { res.json(await getTaskSnapshot(req.user.id)); });

export const createTask = asyncHandler(async (req, res) => {
  const data = taskInput(req.body);
  if (typeof data === 'string') return res.status(400).json({ message: data });
  await prisma.task.create({ data: { ...data, userId: req.user.id } });
  res.status(201).json(await getTaskSnapshot(req.user.id));
});

export const getTask = asyncHandler(async (req, res) => {
  const id = taskId(req.params.id);
  const task = id && await prisma.task.findFirst({ where: { id, userId: req.user.id } });
  if (!task) return res.status(404).json({ message: 'Task not found.' });
  res.json(task);
});

export const updateTask = asyncHandler(async (req, res) => {
  const id = taskId(req.params.id);
  if (!id) return res.status(404).json({ message: 'Task not found.' });
  const data = taskInput(req.body, req.method === 'PATCH');
  if (typeof data === 'string') return res.status(400).json({ message: data });
  const result = await prisma.task.updateMany({ where: { id, userId: req.user.id }, data });
  if (!result.count) return res.status(404).json({ message: 'Task not found.' });
  res.json(await getTaskSnapshot(req.user.id));
});

export const deleteTask = asyncHandler(async (req, res) => {
  const id = taskId(req.params.id);
  if (!id) return res.status(404).json({ message: 'Task not found.' });
  const result = await prisma.task.deleteMany({ where: { id, userId: req.user.id } });
  if (!result.count) return res.status(404).json({ message: 'Task not found.' });
  res.json(await getTaskSnapshot(req.user.id));
});

export const completeTask = asyncHandler(async (req, res) => {
  const id = taskId(req.params.id);
  if (!id) return res.status(404).json({ message: 'Task not found.' });
  if (typeof req.body?.isCompleted !== 'boolean') return res.status(400).json({ message: 'isCompleted must be true or false.' });
  const result = await prisma.task.updateMany({
    where: { id, userId: req.user.id },
    data: { isCompleted: req.body.isCompleted, completedAt: req.body.isCompleted ? new Date() : null }
  });
  if (!result.count) return res.status(404).json({ message: 'Task not found.' });
  res.json(await getTaskSnapshot(req.user.id));
});

export const recommendedOrder = asyncHandler(async (req, res) => {
  const tasks = await prisma.task.findMany({ where: { userId: req.user.id, isCompleted: false } });
  res.json({ tasks: recommendTaskOrder(tasks) });
});

export const estimateTasks = asyncHandler(async (req, res) => {
  const ids = req.body?.taskIds;
  if (!Array.isArray(ids) || !ids.length || ids.some((id) => !Number.isSafeInteger(id) || id < 1) || new Set(ids).size !== ids.length) {
    return res.status(400).json({ message: 'Select one or more pending task IDs to estimate.' });
  }
  const tasks = await prisma.task.findMany({ where: { id: { in: ids }, userId: req.user.id, isCompleted: false } });
  if (!tasks.length) return res.status(400).json({ message: 'No valid pending tasks were selected.' });
  if (tasks.length !== ids.length) return res.status(400).json({ message: 'One or more selected tasks are unavailable or already completed.' });
  res.json(estimateCompletion(tasks));
});
