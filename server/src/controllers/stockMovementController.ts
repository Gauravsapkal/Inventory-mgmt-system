import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { StockMovement } from '../models/StockMovement';
import { Product } from '../models/Product';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middlewares/auth';

export const adjustmentSchema = z.object({
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    newQuantity: z.number().int().min(0, 'New quantity cannot be negative'),
    reason: z.string().min(3, 'A valid reason for manual stock adjustment is required'),
  }),
});

export async function getStockMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const productId = req.query.productId as string;
    const movementType = req.query.movementType as string;

    const query: any = {};
    if (productId) query.product = productId;
    if (movementType) query.movementType = movementType;

    const total = await StockMovement.countDocuments(query);
    const movements = await StockMovement.find(query)
      .populate('product', 'name sku uom')
      .populate('user', 'name role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    sendSuccess(res, movements, 'Stock movements retrieved', 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function createManualAdjustment(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { productId, newQuantity, reason } = req.body;
    const userId = req.user?._id;

    const product = await Product.findById(productId);
    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    const previousQuantity = product.currentStock;
    const diff = newQuantity - previousQuantity;

    if (diff === 0) {
      sendError(res, 'New quantity is identical to current quantity. No change recorded.', 400);
      return;
    }

    product.currentStock = newQuantity;
    await product.save();

    const movement = await StockMovement.create({
      product: product._id,
      movementType: 'adjustment',
      quantityChange: diff,
      previousQuantity,
      newQuantity,
      referenceType: 'Adjustment',
      referenceId: product._id,
      user: userId,
      reason,
    });

    const populated = await StockMovement.findById(movement._id)
      .populate('product', 'name sku uom')
      .populate('user', 'name');

    sendSuccess(res, populated, 'Stock adjustment recorded successfully', 201);
  } catch (error) {
    next(error);
  }
}
