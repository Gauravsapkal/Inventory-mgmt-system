import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import mongoose from 'mongoose';
import { ENV } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { sendSuccess, sendError } from './utils/response';

// Route imports
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import categoryRoutes from './routes/categoryRoutes';
import productRoutes from './routes/productRoutes';
import supplierRoutes from './routes/supplierRoutes';
import purchaseRoutes from './routes/purchaseRoutes';
import saleRoutes from './routes/saleRoutes';
import barcodeRoutes from './routes/barcodeRoutes';
import stockMovementRoutes from './routes/stockMovementRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import reportRoutes from './routes/reportRoutes';
import realtimeRoutes from './routes/realtimeRoutes';
import path from 'path';

const app: Application = express();

// Security and Performance Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use('/docs', express.static(path.join(__dirname, '../../docs')));
app.use('/scripts', express.static(path.join(__dirname, '../../scripts')));
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin) return callback(null, true);
      // In development, allow localhost and LAN IP addresses for mobile browser testing
      if (ENV.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      if (origin === ENV.CORS_ORIGIN) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Health Check Endpoint
app.get('/api/health', (req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';

  sendSuccess(res, {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: ENV.NODE_ENV,
    database: {
      status: dbStatus,
      readyState: dbState,
    },
  }, 'Shree Ganesh Kirana Store API Service is operational');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/barcodes', barcodeRoutes);
app.use('/api/stock-movements', stockMovementRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/events', realtimeRoutes);

// 404 Route Handler
app.use((req: Request, res: Response) => {
  sendError(res, `Endpoint not found: ${req.method} ${req.originalUrl}`, 404);
});

// Global Centralized Error Handler
app.use(errorHandler);

export default app;
