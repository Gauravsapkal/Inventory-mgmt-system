import { Router } from 'express';
import { lookupBarcode } from '../controllers/barcodeController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/lookup', lookupBarcode);
router.get('/:code', lookupBarcode);

export default router;
