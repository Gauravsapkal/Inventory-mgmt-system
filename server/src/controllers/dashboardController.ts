import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product';
import { Sale } from '../models/Sale';
import { Purchase } from '../models/Purchase';
import { sendSuccess } from '../utils/response';

export async function getDashboardStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Run parallel aggregation pipelines
    const [
      productCounts,
      stockStats,
      todaySalesData,
      monthlySalesData,
      lowStockCount,
      outOfStockCount,
      recentSales,
      recentPurchases,
      dailySalesTrend,
      topSellingProducts,
      categoryDistribution,
    ] = await Promise.all([
      // Total active products
      Product.countDocuments({ status: 'active' }),

      // Total units in stock
      Product.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, totalUnits: { $sum: '$currentStock' }, totalValue: { $sum: { $multiply: ['$currentStock', '$purchasePrice'] } } } },
      ]),

      // Today's sales
      Sale.aggregate([
        { $match: { status: 'completed', saleDate: { $gte: todayStart } } },
        { $group: { _id: null, totalAmount: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),

      // Monthly sales
      Sale.aggregate([
        { $match: { status: 'completed', saleDate: { $gte: monthStart } } },
        { $group: { _id: null, totalAmount: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),

      // Low stock count (currentStock > 0 and <= minStock)
      Product.countDocuments({
        status: 'active',
        $expr: { $and: [{ $gt: ['$currentStock', 0] }, { $lte: ['$currentStock', '$minStock'] }] },
      }),

      // Out of stock count
      Product.countDocuments({
        status: 'active',
        currentStock: { $lte: 0 },
      }),

      // Recent 5 sales
      Sale.find({ status: 'completed' })
        .populate('processedBy', 'name')
        .sort({ saleDate: -1 })
        .limit(5)
        .lean(),

      // Recent 5 purchases
      Purchase.find()
        .populate('supplier', 'name')
        .sort({ purchaseDate: -1 })
        .limit(5)
        .lean(),

      // Sales by day for the last 7 days
      Sale.aggregate([
        {
          $match: {
            status: 'completed',
            saleDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
            totalSales: { $sum: '$grandTotal' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Best-selling products (top 5 by quantity sold)
      Sale.aggregate([
        { $match: { status: 'completed' } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            name: { $first: '$items.productName' },
            sku: { $first: '$items.sku' },
            totalQuantitySold: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.lineTotal' },
          },
        },
        { $sort: { totalQuantitySold: -1 } },
        { $limit: 5 },
      ]),

      // Stock distribution by category
      Product.aggregate([
        { $match: { status: 'active' } },
        {
          $group: {
            _id: '$category',
            itemCount: { $sum: 1 },
            totalStock: { $sum: '$currentStock' },
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'categoryInfo',
          },
        },
        { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            categoryId: '$_id',
            categoryName: { $ifNull: ['$categoryInfo.name', 'Uncategorized'] },
            itemCount: 1,
            totalStock: 1,
          },
        },
        { $sort: { totalStock: -1 } },
      ]),
    ]);

    const stats = {
      totalProducts: productCounts,
      totalUnitsInStock: stockStats[0]?.totalUnits || 0,
      inventoryAssetValue: stockStats[0]?.totalValue || 0,
      todaySales: {
        amount: todaySalesData[0]?.totalAmount || 0,
        count: todaySalesData[0]?.count || 0,
      },
      monthlySales: {
        amount: monthlySalesData[0]?.totalAmount || 0,
        count: monthlySalesData[0]?.count || 0,
      },
      lowStockProducts: lowStockCount,
      outOfStockProducts: outOfStockCount,
      recentSales,
      recentPurchases,
      dailySalesTrend,
      topSellingProducts,
      categoryDistribution,
    };

    sendSuccess(res, stats, 'Dashboard statistics aggregated successfully');
  } catch (error) {
    next(error);
  }
}
