import { Router } from 'express';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  supplierSchema,
} from '../controllers/supplierController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';

const router = Router();

router.use(authenticate);

router.get('/', getSuppliers);
router.get('/:id', getSupplierById);
router.post('/', authorize('admin'), validate(supplierSchema), createSupplier);
router.put('/:id', authorize('admin'), validate(supplierSchema), updateSupplier);
router.delete('/:id', authorize('admin'), deleteSupplier);

export default router;
