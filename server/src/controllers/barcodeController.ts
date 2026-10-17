import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product';
import { sendSuccess, sendError } from '../utils/response';

export async function lookupBarcode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawCode = (req.params.code || (req.query.code as string) || '').trim();

    if (!rawCode) {
      sendError(res, 'Barcode value is required', 400);
      return;
    }

    // Build candidate barcode variants to handle 12-digit UPC-A vs 13-digit EAN-13 (leading zero)
    const candidates: string[] = [rawCode];
    if (rawCode.length === 12 && /^\d+$/.test(rawCode)) {
      candidates.push('0' + rawCode);
    }
    if (rawCode.length === 13 && rawCode.startsWith('0') && /^\d+$/.test(rawCode)) {
      candidates.push(rawCode.substring(1));
    }

    // Lookup by barcode or SKU
    const product = await Product.findOne({
      $or: [{ barcode: { $in: candidates } }, { sku: rawCode.toUpperCase() }],
    })
      .populate('category', 'name')
      .lean();

    if (!product) {
      sendSuccess(
        res,
        {
          found: false,
          code: rawCode,
          candidates,
          product: null,
          message: `No product found matching barcode or SKU '${rawCode}'`,
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
        code: rawCode,
        candidates,
        product,
        message: 'Product found',
      },
      'Product found'
    );
  } catch (error) {
    next(error);
  }
}
