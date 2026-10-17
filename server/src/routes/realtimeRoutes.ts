import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { realtimeService } from '../services/realtimeService';

const router = Router();

/**
 * GET /api/events
 * Establishes persistent Server-Sent Events (SSE) connection for real-time ERP updates
 */
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering (Nginx/Render)
  res.flushHeaders?.();

  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  realtimeService.registerClient(clientId, res, req.user?._id?.toString());
});

export default router;
