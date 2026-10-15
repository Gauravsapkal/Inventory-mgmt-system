import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { sendSuccess, sendError } from '../utils/response';

export const categorySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    description: z.string().max(500).optional(),
    active: z.boolean().optional(),
  }),
});

export async function getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categories = await Category.find().sort({ name: 1 }).lean();
    sendSuccess(res, categories, 'Categories retrieved');
  } catch (error) {
    next(error);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, description, active } = req.body;
    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
      sendError(res, 'Category name already exists', 409);
      return;
    }

    const category = await Category.create({ name, description, active: active ?? true });
    sendSuccess(res, category, 'Category created successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { name, description, active } = req.body;

    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      _id: { $ne: id },
    });
    if (existing) {
      sendError(res, 'Another category with this name already exists', 409);
      return;
    }

    const category = await Category.findByIdAndUpdate(
      id,
      { name, description, ...(active !== undefined && { active }) },
      { new: true, runValidators: true }
    );

    if (!category) {
      sendError(res, 'Category not found', 404);
      return;
    }

    sendSuccess(res, category, 'Category updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    // Check if products exist in category
    const productsCount = await Product.countDocuments({ category: id });
    if (productsCount > 0) {
      sendError(res, `Cannot delete category: ${productsCount} products are linked to it. Please archive them first.`, 400);
      return;
    }

    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      sendError(res, 'Category not found', 404);
      return;
    }

    sendSuccess(res, null, 'Category deleted successfully');
  } catch (error) {
    next(error);
  }
}
