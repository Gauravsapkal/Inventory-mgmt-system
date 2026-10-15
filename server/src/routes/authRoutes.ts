import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, getCurrentUser, loginSchema } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';

const router = Router();

// Login rate limiting: max 10 attempts per 15 minutes to thwart brute-force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { success: false, error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getCurrentUser);

export default router;
