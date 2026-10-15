import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product';
import { Sale } from '../models/Sale';
import { Purchase } from '../models/Purchase';
import { StockMovement } from '../models/StockMovement';
import { sendSuccess } from '../utils/response';

export async function getInventoryReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { category, stockStatus, search } = req.query;
    const query: any = { status: 'active' };

    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    if (stockStatus === 'low') {
      query.$expr = { $and: [{ $gt: ['$currentStock', 0] }, { $lte: ['$currentStock', '$minStock'] }] };
    } else if (stockStatus === 'out') {
      query.currentStock = { $lte: 0 };
    }

    const items = await Product.find(query)
      .populate('category', 'name')
      .sort({ currentStock: 1 })
      .lean();

    sendSuccess(res, items, 'Inventory report generated');
  } catch (error) {
    next(error);
  }
}

export async function getSalesReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = req.query;
    const query: any = { status: 'completed' };

    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) query.saleDate.$gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        query.saleDate.$lte = end;
      }
    }

    const sales = await Sale.find(query)
      .populate('processedBy', 'name')
      .sort({ saleDate: -1 })
      .lean();

    const summary = sales.reduce(
      (acc, s) => {
        acc.totalSalesCount += 1;
        acc.totalRevenue += s.grandTotal;
        acc.totalDiscount += s.discount || 0;
        acc.totalTax += s.tax || 0;
        return acc;
      },
      { totalSalesCount: 0, totalRevenue: 0, totalDiscount: 0, totalTax: 0 }
    );

    sendSuccess(res, { summary, sales }, 'Sales report generated');
  } catch (error) {
    next(error);
  }
}

export async function getPurchasesReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate, supplier } = req.query;
    const query: any = {};

    if (supplier) query.supplier = supplier;
    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) query.purchaseDate.$gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        query.purchaseDate.$lte = end;
      }
    }

    const purchases = await Purchase.find(query)
      .populate('supplier', 'name')
      .populate('receivedBy', 'name')
      .sort({ purchaseDate: -1 })
      .lean();

    const summary = purchases.reduce(
      (acc, p) => {
        acc.totalPurchasesCount += 1;
        acc.totalExpenditure += p.total;
        if (p.status === 'received') acc.totalReceivedCount += 1;
        return acc;
      },
      { totalPurchasesCount: 0, totalExpenditure: 0, totalReceivedCount: 0 }
    );

    sendSuccess(res, { summary, purchases }, 'Purchases report generated');
  } catch (error) {
    next(error);
  }
}
