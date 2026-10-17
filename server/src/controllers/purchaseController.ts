import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Purchase, IPurchase } from '../models/Purchase';
import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middlewares/auth';
import { realtimeService } from '../services/realtimeService';

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
    status: z.enum(['draft', 'ordered', 'received']).optional().default('ordered'),
  }),
});

export const receivePurchaseSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          product: z.string().min(1, 'Product ID is required'),
          quantityReceived: z.number().min(0, 'Quantity received cannot be negative'),
          notes: z.string().optional(),
        })
      )
      .optional(),
    notes: z.string().optional(),
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
    const search = (req.query.search as string || '').trim();

    const query: any = {};
    if (status && status !== 'all') query.status = status;
    if (supplier) query.supplier = supplier;
    if (search) {
      query.purchaseNumber = { $regex: search, $options: 'i' };
    }

    const total = await Purchase.countDocuments(query);
    const purchases = await Purchase.find(query)
      .populate('supplier', 'name contactPerson phone email address')
      .populate('receivedBy', 'name email')
      .populate('receipts.receivedBy', 'name email')
      .sort({ purchaseDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Ensure backwards compatibility: for legacy records marked 'received', ensure receivedQuantity matches quantity
    const normalizedPurchases = purchases.map((po: any) => {
      const items = (po.items || []).map((it: any) => {
        if (po.status === 'received' && (it.receivedQuantity === undefined || it.receivedQuantity === 0)) {
          return { ...it, receivedQuantity: it.quantity };
        }
        return { ...it, receivedQuantity: it.receivedQuantity || 0 };
      });
      return { ...po, items };
    });

    sendSuccess(res, normalizedPurchases, 'Purchases retrieved', 200, {
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
      .populate('receivedBy', 'name email')
      .populate('receipts.receivedBy', 'name email')
      .lean();

    if (!purchase) {
      sendError(res, 'Purchase order not found', 404);
      return;
    }

    // Normalization for legacy records
    if (purchase.status === 'received') {
      purchase.items = (purchase.items || []).map((it: any) => ({
        ...it,
        receivedQuantity: it.receivedQuantity !== undefined && it.receivedQuantity > 0 ? it.receivedQuantity : it.quantity,
      }));
    }

    sendSuccess(res, purchase);
  } catch (error) {
    next(error);
  }
}

export async function createPurchase(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { supplier, purchaseDate, items, tax = 0, notes, status = 'ordered' } = req.body;

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
        barcode: product.barcode,
        quantity: item.quantity,
        receivedQuantity: 0,
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
      status: status === 'draft' ? 'draft' : 'ordered',
      notes,
      receipts: [],
    });

    await purchase.save();

    // If status requested was 'received', immediately execute the full receive logic
    if (status === 'received') {
      const received = await executeReceivePurchase(
        purchase._id.toString(),
        undefined, // all items
        notes || 'Initial full receipt on PO creation',
        req.user
      );
      sendSuccess(res, received, 'Purchase created and inventory received successfully', 201);
      return;
    }

    const populated = await Purchase.findById(purchase._id)
      .populate('supplier', 'name contactPerson phone')
      .lean();

    // Broadcast purchase created
    realtimeService.broadcast('purchase_created', {
      purchaseNumber,
      supplierName: (populated?.supplier as any)?.name || 'Supplier',
      total,
      status: purchase.status,
    });

    sendSuccess(res, populated, 'Purchase order created successfully', 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Core helper to process a partial or complete receipt of a purchase order:
 * - Validates item-by-item delivered quantities against remaining pending quantities
 * - Increments Product stock atomically
 * - Records StockMovement audit trail
 * - Appends a new immutable Receipt record to purchase.receipts
 * - Updates purchase status to 'partially_received' or 'received'
 */
async function executeReceivePurchase(
  purchaseId: string,
  deliveredItems: { product: string; quantityReceived: number; notes?: string }[] | undefined,
  receiptNotes: string | undefined,
  user: any
): Promise<IPurchase> {
  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) {
    throw new Error('Purchase order not found');
  }

  if (purchase.status === 'received') {
    throw new Error('Purchase order has already been fully received. Duplicate stock increase prevented.');
  }

  if (purchase.status === 'cancelled') {
    throw new Error('Cannot receive a cancelled purchase order.');
  }

  // Normalize existing received quantities for any legacy records
  for (const item of purchase.items) {
    if (item.receivedQuantity === undefined || item.receivedQuantity === null) {
      item.receivedQuantity = 0;
    }
  }

  // Determine items to receive
  // If deliveredItems is undefined or empty, receive ALL remaining quantities across all items
  const receivingMap = new Map<string, { quantityReceived: number; notes?: string }>();

  if (!deliveredItems || deliveredItems.length === 0) {
    // Receive all remaining
    for (const item of purchase.items) {
      const pending = Math.max(0, item.quantity - (item.receivedQuantity || 0));
      if (pending > 0) {
        receivingMap.set(item.product.toString(), { quantityReceived: pending });
      }
    }
  } else {
    for (const entry of deliveredItems) {
      if (entry.quantityReceived < 0) {
        throw new Error(`Delivered quantity cannot be negative for product ID ${entry.product}.`);
      }
      receivingMap.set(entry.product.toString(), {
        quantityReceived: Number(entry.quantityReceived) || 0,
        notes: entry.notes,
      });
    }
  }

  // Validate that at least one item has delivered quantity > 0
  let totalDeliveredNow = 0;
  for (const [prodId, val] of receivingMap.entries()) {
    totalDeliveredNow += val.quantityReceived;

    // Check item exists in PO
    const poItem = purchase.items.find((i) => i.product.toString() === prodId);
    if (!poItem) {
      throw new Error(`Product ${prodId} is not in this purchase order.`);
    }

    const pending = Math.max(0, poItem.quantity - (poItem.receivedQuantity || 0));
    if (val.quantityReceived > pending) {
      throw new Error(
        `Cannot receive ${val.quantityReceived} units for '${poItem.productName}'. Remaining pending quantity is only ${pending}.`
      );
    }
  }

  if (totalDeliveredNow <= 0) {
    throw new Error('No quantities to receive. At least one product must have a delivered quantity greater than 0.');
  }

  // Step 2: Atomic stock incrementation with rollback tracking
  const updatedStocks: { product: any; prevStock: number; newStock: number; qty: number }[] = [];
  const receiptItems: any[] = [];

  try {
    for (const item of purchase.items) {
      const prodIdStr = item.product.toString();
      const receivingEntry = receivingMap.get(prodIdStr);
      const qtyToReceive = receivingEntry ? receivingEntry.quantityReceived : 0;

      if (qtyToReceive > 0) {
        const product = await Product.findById(item.product);
        if (!product) {
          throw new Error(`Product '${item.productName}' not found in database.`);
        }

        const prevStock = product.currentStock;
        const newStock = prevStock + qtyToReceive;

        // Atomic stock increase
        const updatedProd = await Product.findByIdAndUpdate(
          product._id,
          {
            $inc: { currentStock: qtyToReceive },
            $set: { purchasePrice: item.unitCost },
          },
          { new: true }
        );

        if (!updatedProd) {
          throw new Error(`Failed to update stock for product '${product.name}'.`);
        }

        updatedStocks.push({
          product: updatedProd,
          prevStock,
          newStock: updatedProd.currentStock,
          qty: qtyToReceive,
        });

        // Record stock movement
        await StockMovement.create({
          product: product._id,
          movementType: 'purchase',
          quantityChange: qtyToReceive,
          previousQuantity: prevStock,
          newQuantity: newStock,
          referenceType: 'Purchase',
          referenceId: purchase._id,
          user: user?._id,
          reason: `Receipt on PO ${purchase.purchaseNumber}: Received ${qtyToReceive} ${product.uom || 'units'}`,
        });

        // Update item's receivedQuantity on the purchase document
        item.receivedQuantity = (item.receivedQuantity || 0) + qtyToReceive;

        // Add to this receipt's item ledger
        receiptItems.push({
          product: product._id,
          productName: item.productName,
          sku: item.sku,
          quantityReceived: qtyToReceive,
          notes: receivingEntry?.notes || '',
        });
      }
    }

    // Step 3: Append new immutable receipt record
    const receiptSeq = (purchase.receipts?.length || 0) + 1;
    const poNumSuffix = purchase.purchaseNumber.replace(/^PO-?/, '');
    const receiptNumber = `GRN-${poNumSuffix}-${receiptSeq.toString().padStart(2, '0')}`;

    if (!purchase.receipts) {
      purchase.receipts = [];
    }

    purchase.receipts.push({
      receiptNumber,
      receivedDate: new Date(),
      receivedBy: user?._id,
      receivedByName: user?.name || 'Authorized Storekeeper',
      items: receiptItems,
      notes: receiptNotes || '',
      createdAt: new Date(),
    });

    // Step 4: Determine new overall status
    const allCompleted = purchase.items.every(
      (item) => (item.receivedQuantity || 0) >= item.quantity
    );

    if (allCompleted) {
      purchase.status = 'received';
      purchase.receivedDate = new Date();
      if (user?._id) purchase.receivedBy = user._id;
    } else {
      purchase.status = 'partially_received';
    }

    await purchase.save();

    // Step 5: Broadcast realtime updates
    realtimeService.broadcast('purchase_updated', {
      purchaseNumber: purchase.purchaseNumber,
      status: purchase.status,
      receiptNumber,
    });

    for (const record of updatedStocks) {
      realtimeService.broadcast('stock_updated', {
        productId: record.product._id,
        productName: record.product.name,
        previousQuantity: record.prevStock,
        newQuantity: record.newStock,
        movementType: 'purchase',
      });
    }

    const populated = await Purchase.findById(purchase._id)
      .populate('supplier', 'name contactPerson phone email address')
      .populate('receivedBy', 'name email')
      .populate('receipts.receivedBy', 'name email');

    return populated as IPurchase;
  } catch (error: any) {
    // Rollback any successfully incremented product stocks on unexpected error
    for (const rolled of updatedStocks) {
      await Product.findByIdAndUpdate(rolled.product._id, {
        $inc: { currentStock: -rolled.qty },
      });
    }
    throw error;
  }
}

export async function receivePurchase(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { items, notes } = req.body || {};

    const updatedPurchase = await executeReceivePurchase(id, items, notes, req.user);
    sendSuccess(res, updatedPurchase, 'Purchase receipt processed and stock ledger updated successfully');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to process receipt', 400);
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
      sendError(res, 'Cannot cancel an order that has already been fully received into inventory', 400);
      return;
    }

    if (purchase.status === 'partially_received') {
      sendError(res, 'Cannot cancel an order that is partially received. Inventory receipts have already been committed.', 400);
      return;
    }

    purchase.status = 'cancelled';
    await purchase.save();

    realtimeService.broadcast('purchase_updated', {
      purchaseNumber: purchase.purchaseNumber,
      status: 'cancelled',
    });

    sendSuccess(res, purchase, 'Purchase order cancelled successfully');
  } catch (error) {
    next(error);
  }
}
