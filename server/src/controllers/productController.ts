import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Product } from '../models/Product';
import { Sale } from '../models/Sale';
import { Purchase } from '../models/Purchase';
import { StockMovement } from '../models/StockMovement';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middlewares/auth';
import { realtimeService } from '../services/realtimeService';

export const productSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Product name is required').max(200),
    sku: z.string().min(2, 'SKU is required').max(50),
    barcode: z.string().optional().or(z.literal('')),
    category: z.string().min(1, 'Category ID is required'),
    description: z.string().max(1000).optional(),
    purchasePrice: z.number().min(0, 'Purchase price must be positive'),
    sellingPrice: z.number().min(0, 'Selling price must be positive'),
    currentStock: z.number().min(0, 'Stock cannot be negative').default(0),
    minStock: z.number().min(0).default(5),
    uom: z.string().default('pcs'),
    imageUrl: z.string().optional(),
    status: z.enum(['active', 'archived']).default('active'),
  }),
});

export async function getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const search = (req.query.search as string || '').trim();
    const category = req.query.category as string;
    const stockFilter = req.query.stockFilter as string; // 'low', 'out', 'all'
    const status = (req.query.status as string) || 'active';

    const query: any = {};

    if (status !== 'all') {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
      ];
    }

    if (stockFilter === 'out') {
      query.currentStock = { $lte: 0 };
    } else if (stockFilter === 'low') {
      query.$expr = {
        $and: [
          { $gt: ['$currentStock', 0] },
          { $lte: ['$currentStock', '$minStock'] },
        ],
      };
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    sendSuccess(res, products, 'Products retrieved successfully', 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).populate('category', 'name').lean();

    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    sendSuccess(res, product);
  } catch (error) {
    next(error);
  }
}

export async function createProduct(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;
    const sku = data.sku.trim().toUpperCase();
    const barcode = data.barcode?.trim() || undefined;

    // Check duplicate SKU
    const existingSku = await Product.findOne({ sku });
    if (existingSku) {
      sendError(res, `Product SKU '${sku}' is already in use`, 409);
      return;
    }

    // Check duplicate barcode if provided
    if (barcode) {
      const existingBarcode = await Product.findOne({ barcode });
      if (existingBarcode) {
        sendError(res, `Barcode '${barcode}' is already assigned to '${existingBarcode.name}'`, 409);
        return;
      }
    }

    const product = await Product.create({
      ...data,
      sku,
      barcode: barcode || undefined,
    });

    // If initial stock was provided, record initial stock movement
    if (data.currentStock > 0 && req.user) {
      await StockMovement.create({
        product: product._id,
        movementType: 'adjustment',
        quantityChange: data.currentStock,
        previousQuantity: 0,
        newQuantity: data.currentStock,
        referenceType: 'Adjustment',
        referenceId: product._id,
        user: req.user._id,
        reason: 'Initial stock on product creation',
      });
    }

    realtimeService.broadcast('product_created', product);

    sendSuccess(res, product, 'Product created successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function updateProduct(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = req.body;
    const sku = data.sku.trim().toUpperCase();
    const barcode = data.barcode?.trim() || undefined;

    // Check duplicate SKU
    const existingSku = await Product.findOne({ sku, _id: { $ne: id } });
    if (existingSku) {
      sendError(res, `Product SKU '${sku}' is already in use by another product`, 409);
      return;
    }

    // Check duplicate barcode
    if (barcode) {
      const existingBarcode = await Product.findOne({ barcode, _id: { $ne: id } });
      if (existingBarcode) {
        sendError(res, `Barcode '${barcode}' is already assigned to '${existingBarcode.name}'`, 409);
        return;
      }
    }

    const currentProduct = await Product.findById(id);
    if (!currentProduct) {
      sendError(res, 'Product not found', 404);
      return;
    }

    // Notice: currentStock should only be modified directly via adjustments, purchases, or sales
    // If currentStock is passed and differs, log stock adjustment
    if (data.currentStock !== undefined && data.currentStock !== currentProduct.currentStock && req.user) {
      const diff = data.currentStock - currentProduct.currentStock;
      await StockMovement.create({
        product: currentProduct._id,
        movementType: 'adjustment',
        quantityChange: diff,
        previousQuantity: currentProduct.currentStock,
        newQuantity: data.currentStock,
        referenceType: 'Adjustment',
        referenceId: currentProduct._id,
        user: req.user._id,
        reason: data.adjustmentReason || 'Manual stock level adjustment',
      });
    }

    const updated = await Product.findByIdAndUpdate(
      id,
      {
        ...data,
        sku,
        barcode: barcode || undefined,
      },
      { new: true, runValidators: true }
    ).populate('category', 'name');

    realtimeService.broadcast('product_updated', updated);

    sendSuccess(res, updated, 'Product updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    // Check if product is in any sale or purchase
    const inSale = await Sale.findOne({ 'items.product': id });
    const inPurchase = await Purchase.findOne({ 'items.product': id });

    if (inSale || inPurchase) {
      // Archive instead of hard delete to preserve financial and audit integrity
      const archived = await Product.findByIdAndUpdate(id, { status: 'archived' }, { new: true });
      realtimeService.broadcast('product_updated', archived);
      sendSuccess(res, archived, 'Product has historical transactions and was safely archived instead of deleted.');
      return;
    }

    await Product.findByIdAndDelete(id);
    realtimeService.broadcast('product_deleted', { id });
    sendSuccess(res, null, 'Product deleted successfully');
  } catch (error) {
    next(error);
  }
}
