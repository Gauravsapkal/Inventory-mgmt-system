import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { User } from '../models/User';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { seedInitialData } from '../scripts/seed';
import { ENV } from '../config/env';

describe('Inventory ERP API Test Suite', () => {
  let adminToken = '';
  let testCategoryId = '';
  let testProductId = '';

  beforeAll(async () => {
    await connectDatabase();
    await seedInitialData();

    // Login as admin
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ENV.ADMIN_EMAIL, password: ENV.ADMIN_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    adminToken = res.body.data.token;
  }, 30000);

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('GET /api/health should return system status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('healthy');
  });

  it('POST /api/auth/login should reject invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ENV.ADMIN_EMAIL, password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/auth/me should return current user profile with valid JWT', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(ENV.ADMIN_EMAIL.toLowerCase());
    expect(res.body.data.role).toBe('admin');
  });

  it('GET /api/categories should return seeded categories', async () => {
    const res = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    testCategoryId = res.body.data[0]._id;
  });

  it('POST /api/products should create a new product', async () => {
    const newSku = `TEST-SKU-${Date.now()}`;
    const newBarcode = `890${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Automated Test Product',
        sku: newSku,
        barcode: newBarcode,
        category: testCategoryId,
        description: 'Product created during integration testing',
        purchasePrice: 50,
        sellingPrice: 100,
        currentStock: 20,
        minStock: 5,
        uom: 'pcs',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    testProductId = res.body.data._id;

    // Verify duplicate SKU rejection
    const duplicateRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Duplicate SKU Product',
        sku: newSku,
        category: testCategoryId,
        purchasePrice: 10,
        sellingPrice: 20,
        currentStock: 5,
      });
    expect(duplicateRes.status).toBe(409);
  });

  it('GET /api/barcodes/:code should lookup product by barcode', async () => {
    const res = await request(app)
      .get('/api/barcodes/8901234567890')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.found).toBe(true);
    expect(res.body.data.product.sku).toBe('BEV-WAT-001');
  });

  it('POST /api/sales should validate stock, complete sale, and decrement stock', async () => {
    // Check initial stock
    const productBefore = await Product.findById(testProductId);
    const initialStock = productBefore?.currentStock || 20;

    // Execute sale for 5 items
    const saleRes = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerName: 'Test Customer',
        customerPhone: '9999999999',
        items: [
          {
            product: testProductId,
            quantity: 5,
          },
        ],
        paymentMethod: 'cash',
      });

    expect(saleRes.status).toBe(201);
    expect(saleRes.body.success).toBe(true);
    expect(saleRes.body.data.invoiceNumber).toMatch(/^INV-/);

    // Verify product stock reduced by exactly 5
    const productAfter = await Product.findById(testProductId);
    expect(productAfter?.currentStock).toBe(initialStock - 5);
  });

  it('POST /api/sales should prevent overselling when stock is insufficient', async () => {
    const oversellRes = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerName: 'Oversell Customer',
        items: [
          {
            product: testProductId,
            quantity: 999999, // Exceeds available stock
          },
        ],
        paymentMethod: 'cash',
      });

    expect(oversellRes.status).toBe(400);
    expect(oversellRes.body.error).toContain('Insufficient stock');
  });

  it('GET /api/dashboard/stats should return aggregated metrics', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalProducts).toBeGreaterThan(0);
    expect(res.body.data.todaySales).toBeDefined();
  });
});
