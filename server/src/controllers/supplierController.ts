import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Supplier } from '../models/Supplier';
import { Purchase } from '../models/Purchase';
import { sendSuccess, sendError } from '../utils/response';

export const supplierSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Supplier name is required').max(150),
    contactPerson: z.string().max(100).optional(),
    phone: z.string().max(30).optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().max(300).optional(),
    notes: z.string().max(500).optional(),
    active: z.boolean().optional(),
  }),
});

export async function getSuppliers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const search = (req.query.search as string || '').trim();
    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const suppliers = await Supplier.find(query).sort({ name: 1 }).lean();
    sendSuccess(res, suppliers, 'Suppliers retrieved');
  } catch (error) {
    next(error);
  }
}

export async function getSupplierById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findById(id).lean();

    if (!supplier) {
      sendError(res, 'Supplier not found', 404);
      return;
    }

    // Also fetch purchase history for this supplier
    const purchases = await Purchase.find({ supplier: id }).sort({ purchaseDate: -1 }).limit(10).lean();

    sendSuccess(res, { ...supplier, purchases });
  } catch (error) {
    next(error);
  }
}

export async function createSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplier = await Supplier.create(req.body);
    sendSuccess(res, supplier, 'Supplier created successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function updateSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });

    if (!supplier) {
      sendError(res, 'Supplier not found', 404);
      return;
    }

    sendSuccess(res, supplier, 'Supplier updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function deleteSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const hasPurchases = await Purchase.findOne({ supplier: id });

    if (hasPurchases) {
      // Deactivate instead of deleting
      const updated = await Supplier.findByIdAndUpdate(id, { active: false }, { new: true });
      sendSuccess(res, updated, 'Supplier has existing purchase orders; supplier was deactivated instead of deleted.');
      return;
    }

    await Supplier.findByIdAndDelete(id);
    sendSuccess(res, null, 'Supplier deleted successfully');
  } catch (error) {
    next(error);
  }
}
