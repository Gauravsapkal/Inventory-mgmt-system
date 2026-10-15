import { Router } from 'express';
import {
  getInventoryReport,
  getSalesReport,
  getPurchasesReport,
} from '../controllers/reportController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/inventory', getInventoryReport);
router.get('/sales', getSalesReport);
router.get('/purchases', getPurchasesReport);

export default router;
