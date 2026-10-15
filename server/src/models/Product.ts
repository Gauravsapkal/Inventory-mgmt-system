import mongoose, { Document, Schema, Model } from 'mongoose';

export type ProductStatus = 'active' | 'archived';

export interface IProduct extends Document {
  name: string;
  sku: string;
  barcode?: string;
  category: mongoose.Types.ObjectId;
  description?: string;
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  minStock: number; // Reorder alert threshold
  uom: string; // Unit of measurement: e.g. "pcs", "box", "kg", "bottle"
  imageUrl?: string;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: 200,
      index: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    barcode: {
      type: String,
      unique: true,
      sparse: true, // Allows null/missing values while ensuring uniqueness when present
      trim: true,
      index: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: [0, 'Purchase price must be positive'],
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Selling price must be positive'],
    },
    currentStock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Stock cannot be negative'],
    },
    minStock: {
      type: Number,
      default: 5,
      min: [0, 'Minimum stock must be 0 or higher'],
    },
    uom: {
      type: String,
      default: 'pcs',
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound text index for robust full-text search across name, sku, description
productSchema.index({ name: 'text', sku: 'text', description: 'text' });

export const Product: Model<IProduct> = mongoose.model<IProduct>('Product', productSchema);
