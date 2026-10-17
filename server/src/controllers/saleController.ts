import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Sale } from '../models/Sale';
import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middlewares/auth';
import { realtimeService } from '../services/realtimeService';

export const saleSchema = z.object({
  body: z.object({
    customerName: z.string().optional().default('Walk-in Customer'),
    customerPhone: z.string().optional(),
    items: z
      .array(
        z.object({
          product: z.string().min(1, 'Product ID is required'),
          quantity: z.number().int().min(1, 'Quantity must be at least 1'),
          unitPrice: z.number().min(0).optional(), // Can override or use product's default
        })
      )
      .min(1, 'At least one item is required to complete a sale'),
    discount: z.number().min(0).optional().default(0),
    tax: z.number().min(0).optional().default(0),
    paymentMethod: z.enum(['cash', 'card', 'upi', 'other']).default('cash'),
    notes: z.string().optional(),
  }),
});

function generateInvoiceNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INV-${dateStr}-${random}`;
}

export async function getSales(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const search = (req.query.search as string || '').trim();
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const query: any = {};
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) query.saleDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.saleDate.$lte = end;
      }
    }

    const total = await Sale.countDocuments(query);
    const sales = await Sale.find(query)
      .populate('processedBy', 'name email')
      .sort({ saleDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    sendSuccess(res, sales, 'Sales retrieved successfully', 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function getSaleById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const sale = await Sale.findById(id)
      .populate('processedBy', 'name email')
      .populate('items.product', 'name sku uom')
      .lean();

    if (!sale) {
      sendError(res, 'Sale invoice not found', 404);
      return;
    }

    sendSuccess(res, sale);
  } catch (error) {
    next(error);
  }
}

export async function createSale(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { customerName, customerPhone, items, discount = 0, tax = 0, paymentMethod, notes } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      sendError(res, 'User session missing', 401);
      return;
    }

    // Step 1: Pre-validation of all products & available stock before modifying anything
    const productDocs = [];
    const preparedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        sendError(res, `Product not found: ${item.product}`, 404);
        return;
      }

      if (product.status !== 'active') {
        sendError(res, `Product '${product.name}' is archived and cannot be sold`, 400);
        return;
      }

      // Check stock availability
      if (product.currentStock < item.quantity) {
        sendError(
          res,
          `Insufficient stock for '${product.name}'. Available: ${product.currentStock}, Requested: ${item.quantity}`,
          400
        );
        return;
      }

      const unitPrice = item.unitPrice !== undefined ? item.unitPrice : product.sellingPrice;
      const lineTotal = Number((item.quantity * unitPrice).toFixed(2));
      subtotal += lineTotal;

      preparedItems.push({
        product: product._id,
        productName: product.name,
        sku: product.sku,
        barcode: product.barcode,
        quantity: item.quantity,
        unitPrice,
        purchasePrice: product.purchasePrice || 0,
        lineTotal,
      });

      productDocs.push({
        product,
        requestedQty: item.quantity,
        unitPrice,
      });
    }

    const grandTotal = Number((subtotal - discount + tax).toFixed(2));
    const invoiceNumber = generateInvoiceNumber();

    // Step 2: Atomic stock deduction with rollback safety
    const updatedProducts: { product: any; prevStock: number; newStock: number; qty: number }[] = [];

    try {
      for (const item of productDocs) {
        const prod = item.product;
        const prevStock = prod.currentStock;
        const newStock = prevStock - item.requestedQty;

        // Atomic check-and-decrement: currentStock must still be >= requestedQty
        const updated = await Product.findOneAndUpdate(
          { _id: prod._id, currentStock: { $gte: item.requestedQty } },
          { $inc: { currentStock: -item.requestedQty } },
          { new: true }
        );

        if (!updated) {
          throw new Error(
            `Stock conflict for '${prod.name}'. Another concurrent transaction may have reserved this item.`
          );
        }

        updatedProducts.push({
          product: updated,
          prevStock,
          newStock: updated.currentStock,
          qty: item.requestedQty,
        });
      }

      // Step 3: Create Sale record
      const sale = new Sale({
        invoiceNumber,
        saleDate: new Date(),
        customerName: customerName || 'Walk-in Customer',
        customerPhone,
        items: preparedItems,
        subtotal: Number(subtotal.toFixed(2)),
        discount,
        tax,
        grandTotal,
        paymentMethod,
        processedBy: userId,
        status: 'completed',
        notes,
      });

      await sale.save();

      // Step 4: Record Stock Movement entries for audit trail
      for (const record of updatedProducts) {
        await StockMovement.create({
          product: record.product._id,
          movementType: 'sale',
          quantityChange: -record.qty,
          previousQuantity: record.prevStock,
          newQuantity: record.newStock,
          referenceType: 'Sale',
          referenceId: sale._id,
          user: userId,
          reason: `Sale Invoice ${invoiceNumber}`,
        });
      }

      const populatedSale = await Sale.findById(sale._id)
        .populate('processedBy', 'name email')
        .lean();

      // Realtime notification to all connected clients (desktop & mobile)
      realtimeService.broadcast('sale_created', {
        invoiceNumber,
        grandTotal,
        customerName: sale.customerName,
        itemsCount: preparedItems.length,
      });

      for (const record of updatedProducts) {
        realtimeService.broadcast('stock_updated', {
          productId: record.product._id,
          productName: record.product.name,
          previousQuantity: record.prevStock,
          newQuantity: record.newStock,
          movementType: 'sale',
        });
      }

      sendSuccess(res, populatedSale, 'Sale completed successfully', 201);
    } catch (atomicErr: any) {
      // Rollback any successfully decremented stocks
      for (const rolled of updatedProducts) {
        await Product.findByIdAndUpdate(rolled.product._id, {
          $inc: { currentStock: rolled.qty },
        });
      }
      sendError(res, atomicErr.message || 'Transaction could not be completed', 400);
    }
  } catch (error) {
    next(error);
  }
}
