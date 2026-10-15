import { Router } from 'express';
import { getUsers, createUser, updateUserStatus, createUserSchema, updateUserStatusSchema } from '../controllers/userController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';

const router = Router();

// All user management routes require admin role
router.use(authenticate, authorize('admin'));

router.get('/', getUsers);
router.post('/', validate(createUserSchema), createUser);
router.patch('/:id/status', validate(updateUserStatusSchema), updateUserStatus);

export default router;
