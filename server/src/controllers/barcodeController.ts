import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product';
import { sendSuccess, sendError } from '../utils/response';

export async function lookupBarcode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const code = (req.params.code || req.query.code as string || '').trim();

    if (!code) {
      sendError(res, 'Barcode value is required', 400);
      return;
    }

    // Lookup by barcode or SKU
    const product = await Product.findOne({
      $or: [{ barcode: code }, { sku: code.toUpperCase() }],
      status: 'active',
    })
      .populate('category', 'name')
      .lean();

    if (!product) {
      sendSuccess(
        res,
        {
          found: false,
          code,
          product: null,
          message: `No active product found matching barcode or SKU '${code}'`,
        },
        'Lookup completed (no match)',
        200
      );
      return;
    }

    sendSuccess(
      res,
      {
        found: true,
        code,
        product,
        message: 'Product found',
      },
      'Product found'
    );
  } catch (error) {
    next(error);
  }
}
