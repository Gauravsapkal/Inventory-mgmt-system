import mongoose, { Document, Schema, Model } from 'mongoose';

export type SaleStatus = 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'other';

export interface ISaleItem {
  product: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  barcode?: string;
  quantity: number;
  unitPrice: number; // Historical selling price at moment of sale
  purchasePrice: number; // For accurate profit reporting
  lineTotal: number;
}

export interface ISale extends Document {
  invoiceNumber: string;
  saleDate: Date;
  customerName?: string;
  customerPhone?: string;
  items: ISaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  processedBy: mongoose.Types.ObjectId; // User
  status: SaleStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const saleItemSchema = new Schema<ISaleItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      required: true,
    },
    barcode: {
      type: String,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Unit price cannot be negative'],
    },
    purchasePrice: {
      type: Number,
      default: 0,
      min: [0, 'Purchase price cannot be negative'],
    },
    lineTotal: {
      type: Number,
      required: true,
      min: [0, 'Line total cannot be negative'],
    },
  },
  { _id: false }
);

const saleSchema = new Schema<ISale>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    saleDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: 'Walk-in Customer',
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    items: {
      type: [saleItemSchema],
      validate: [(val: ISaleItem[]) => val.length > 0, 'Sale must have at least one line item'],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'other'],
      default: 'cash',
    },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['completed', 'cancelled'],
      default: 'completed',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Sale: Model<ISale> = mongoose.model<ISale>('Sale', saleSchema);
