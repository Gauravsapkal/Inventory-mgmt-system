import { Router } from 'express';
import {
  getPurchases,
  getPurchaseById,
  createPurchase,
  receivePurchase,
  cancelPurchase,
  purchaseSchema,
} from '../controllers/purchaseController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';

const router = Router();

router.use(authenticate);

router.get('/', getPurchases);
router.get('/:id', getPurchaseById);
router.post('/', validate(purchaseSchema), createPurchase);
router.post('/:id/receive', receivePurchase);
router.post('/:id/cancel', authorize('admin'), cancelPurchase);

export default router;
