import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Purchase } from '../models/Purchase';
import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middlewares/auth';

export const purchaseSchema = z.object({
  body: z.object({
    supplier: z.string().min(1, 'Supplier is required'),
    purchaseDate: z.string().optional(),
    items: z
      .array(
        z.object({
          product: z.string().min(1, 'Product is required'),
          quantity: z.number().int().min(1, 'Quantity must be at least 1'),
          unitCost: z.number().min(0, 'Unit cost must be at least 0'),
        })
      )
      .min(1, 'At least one line item is required'),
    tax: z.number().min(0).optional().default(0),
    notes: z.string().optional(),
    status: z.enum(['draft', 'received']).optional().default('draft'),
  }),
});

// Helper to generate unique purchase order number: PO-YYYYMMDD-XXXX
function generatePurchaseNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PO-${dateStr}-${random}`;
}

export async function getPurchases(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const status = req.query.status as string;
    const supplier = req.query.supplier as string;

    const query: any = {};
    if (status) query.status = status;
    if (supplier) query.supplier = supplier;

    const total = await Purchase.countDocuments(query);
    const purchases = await Purchase.find(query)
      .populate('supplier', 'name contactPerson phone')
      .populate('receivedBy', 'name')
      .sort({ purchaseDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    sendSuccess(res, purchases, 'Purchases retrieved', 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function getPurchaseById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const purchase = await Purchase.findById(id)
      .populate('supplier', 'name contactPerson phone email address')
      .populate('receivedBy', 'name')
      .lean();

    if (!purchase) {
      sendError(res, 'Purchase order not found', 404);
      return;
    }

    sendSuccess(res, purchase);
  } catch (error) {
    next(error);
  }
}

export async function createPurchase(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { supplier, purchaseDate, items, tax = 0, notes, status = 'draft' } = req.body;

    // Validate products and compute totals
    const preparedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        sendError(res, `Product ${item.product} not found`, 404);
        return;
      }
      const totalCost = Number((item.quantity * item.unitCost).toFixed(2));
      subtotal += totalCost;

      preparedItems.push({
        product: product._id,
        productName: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost,
      });
    }

    const total = Number((subtotal + tax).toFixed(2));
    const purchaseNumber = generatePurchaseNumber();

    const purchase = new Purchase({
      purchaseNumber,
      supplier,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      items: preparedItems,
      subtotal,
      tax,
      total,
      status: 'draft', // Always create as draft first
      notes,
    });

    await purchase.save();

    // If status requested was 'received', immediately execute the receive logic
    if (status === 'received') {
      await receivePurchaseOrder(purchase._id.toString(), req.user?._id);
      const updated = await Purchase.findById(purchase._id).populate('supplier', 'name');
      sendSuccess(res, updated, 'Purchase created and inventory received successfully', 201);
      return;
    }

    const populated = await Purchase.findById(purchase._id).populate('supplier', 'name');
    sendSuccess(res, populated, 'Draft purchase created successfully', 201);
  } catch (error) {
    next(error);
  }
}

// Standalone receive helper that guarantees stock increase happens exactly once
async function receivePurchaseOrder(purchaseId: string, userId?: any): Promise<any> {
  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) {
    throw new Error('Purchase order not found');
  }

  if (purchase.status === 'received') {
    throw new Error('Purchase order has already been received. Duplicate stock increase prevented.');
  }

  if (purchase.status === 'cancelled') {
    throw new Error('Cannot receive a cancelled purchase order.');
  }

  // Iterate items and update stock + log movement
  for (const item of purchase.items) {
    const product = await Product.findById(item.product);
    if (!product) continue;

    const previousStock = product.currentStock;
    const newStock = previousStock + item.quantity;

    product.currentStock = newStock;
    // Optionally update purchase price to the latest unit cost
    product.purchasePrice = item.unitCost;
    await product.save();

    // Record stock movement
    await StockMovement.create({
      product: product._id,
      movementType: 'purchase',
      quantityChange: item.quantity,
      previousQuantity: previousStock,
      newQuantity: newStock,
      referenceType: 'Purchase',
      referenceId: purchase._id,
      user: userId,
      reason: `Received purchase order ${purchase.purchaseNumber}`,
    });
  }

  purchase.status = 'received';
  purchase.receivedDate = new Date();
  if (userId) purchase.receivedBy = userId;
  await purchase.save();

  return purchase;
}

export async function receivePurchase(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const received = await receivePurchaseOrder(id, req.user?._id);
    sendSuccess(res, received, 'Purchase order received and stock quantities increased');
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
}

export async function cancelPurchase(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const purchase = await Purchase.findById(id);

    if (!purchase) {
      sendError(res, 'Purchase order not found', 404);
      return;
    }

    if (purchase.status === 'received') {
      sendError(res, 'Cannot cancel an order that has already been received into inventory', 400);
      return;
    }

    purchase.status = 'cancelled';
    await purchase.save();

    sendSuccess(res, purchase, 'Purchase order cancelled successfully');
  } catch (error) {
    next(error);
  }
}
