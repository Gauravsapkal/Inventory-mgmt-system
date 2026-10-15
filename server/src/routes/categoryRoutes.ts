import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  categorySchema,
} from '../controllers/categoryController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';

const router = Router();

router.use(authenticate);

// Both admin & staff can view categories
router.get('/', getCategories);

// Admin-only mutation routes
router.post('/', authorize('admin'), validate(categorySchema), createCategory);
router.put('/:id', authorize('admin'), validate(categorySchema), updateCategory);
router.delete('/:id', authorize('admin'), deleteCategory);

export default router;
