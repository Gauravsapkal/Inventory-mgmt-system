import { User } from '../models/User';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { Supplier } from '../models/Supplier';
import { ENV } from '../config/env';

export async function seedInitialData(): Promise<void> {
  // Check if admin user exists
  const existingAdmin = await User.findOne({ role: 'admin' });
  if (!existingAdmin) {
    console.log(`🌱 Seeding initial administrator account: ${ENV.ADMIN_EMAIL}...`);
    await User.create({
      name: ENV.ADMIN_NAME,
      email: ENV.ADMIN_EMAIL.toLowerCase(),
      password: ENV.ADMIN_PASSWORD,
      role: 'admin',
      status: 'active',
    });
    console.log(`✅ Default admin created. (Email: ${ENV.ADMIN_EMAIL}, Password: ${ENV.ADMIN_PASSWORD})`);
  }

  // Seed sample categories if empty
  const categoryCount = await Category.countDocuments();
  if (categoryCount === 0) {
    console.log('🌱 Seeding default product categories...');
    const categories = await Category.insertMany([
      { name: 'Beverages', description: 'Soft drinks, bottled water, juices, and tea', active: true },
      { name: 'Electronics & Accessories', description: 'Cables, chargers, adapters, and peripherals', active: true },
      { name: 'Stationery & Office', description: 'Paper, pens, notebooks, and office supplies', active: true },
      { name: 'Snacks & Packaged Foods', description: 'Biscuits, chips, and packed confectionery', active: true },
    ]);

    // Seed sample supplier
    const supplier = await Supplier.create({
      name: 'Global Supplies Co.',
      contactPerson: 'Rajesh Sharma',
      phone: '+91 98765 43210',
      email: 'contact@globalsupplies.example',
      address: 'Industrial Area Phase 2, New Delhi',
      active: true,
    });

    // Seed sample products with real standard barcodes (EAN-13 / Code-128)
    await Product.insertMany([
      {
        name: 'Mineral Water 1L Bottle',
        sku: 'BEV-WAT-001',
        barcode: '8901234567890',
        category: categories[0]._id,
        description: 'Packaged natural mineral drinking water bottle',
        purchasePrice: 12.00,
        sellingPrice: 20.00,
        currentStock: 50,
        minStock: 10,
        uom: 'bottle',
        status: 'active',
      },
      {
        name: 'USB-C Fast Charging Cable 1m',
        sku: 'ELE-CAB-002',
        barcode: '8909876543211',
        category: categories[1]._id,
        description: 'Braided 65W fast-charging Type-C to Type-C cable',
        purchasePrice: 150.00,
        sellingPrice: 299.00,
        currentStock: 25,
        minStock: 5,
        uom: 'pcs',
        status: 'active',
      },
      {
        name: 'Executive Gel Pen Pack of 5',
        sku: 'STA-PEN-003',
        barcode: '8904567890123',
        category: categories[2]._id,
        description: 'Smooth writing 0.5mm blue waterproof gel ink pens',
        purchasePrice: 60.00,
        sellingPrice: 100.00,
        currentStock: 40,
        minStock: 8,
        uom: 'box',
        status: 'active',
      },
      {
        name: 'Organic Roasted Almonds 200g',
        sku: 'SNK-ALM-004',
        barcode: '8906789012345',
        category: categories[3]._id,
        description: 'Lightly salted California almonds pouch',
        purchasePrice: 180.00,
        sellingPrice: 260.00,
        currentStock: 4, // Intentionally low stock to demonstrate low-stock alert!
        minStock: 8,
        uom: 'pcs',
        status: 'active',
      },
    ]);
    console.log('✅ Demo inventory seeded with barcode-enabled test products.');
  }
}
