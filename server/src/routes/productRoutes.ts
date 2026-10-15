import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  productSchema,
} from '../controllers/productController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';

const router = Router();

router.use(authenticate);

// Admin and staff can browse & view products
router.get('/', getProducts);
router.get('/:id', getProductById);

// Admin-only management
router.post('/', authorize('admin'), validate(productSchema), createProduct);
router.put('/:id', authorize('admin'), validate(productSchema), updateProduct);
router.delete('/:id', authorize('admin'), deleteProduct);

export default router;
