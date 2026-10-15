import { Router } from 'express';
import {
  getStockMovements,
  createManualAdjustment,
  adjustmentSchema,
} from '../controllers/stockMovementController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';

const router = Router();

router.use(authenticate);

router.get('/', getStockMovements);
router.post('/adjust', authorize('admin'), validate(adjustmentSchema), createManualAdjustment);

export default router;
