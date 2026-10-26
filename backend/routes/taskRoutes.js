import { Router } from 'express';
import { completeTask, createTask, deleteTask, estimateTasks, getTask, listTasks, recommendedOrder, updateTask } from '../controllers/taskController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();
router.use(protect);
router.get('/recommended-order', recommendedOrder);
router.post('/estimate', estimateTasks);
router.route('/').get(listTasks).post(createTask);
router.patch('/:id/complete', completeTask);
router.route('/:id').get(getTask).put(updateTask).patch(updateTask).delete(deleteTask);
export default router;
