import { Router } from 'express';
import { getSales, getSaleById, createSale, saleSchema } from '../controllers/saleController';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';

const router = Router();

router.use(authenticate);

router.get('/', getSales);
router.get('/:id', getSaleById);
router.post('/', validate(saleSchema), createSale);

export default router;
