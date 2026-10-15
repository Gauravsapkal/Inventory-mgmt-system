import mongoose, { Document, Schema, Model } from 'mongoose';

export type PurchaseStatus = 'draft' | 'received' | 'cancelled';

export interface IPurchaseItem {
  product: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface IPurchase extends Document {
  purchaseNumber: string;
  supplier: mongoose.Types.ObjectId;
  purchaseDate: Date;
  receivedDate?: Date;
  items: IPurchaseItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: PurchaseStatus;
  notes?: string;
  receivedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseItemSchema = new Schema<IPurchaseItem>(
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
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    unitCost: {
      type: Number,
      required: true,
      min: [0, 'Unit cost cannot be negative'],
    },
    totalCost: {
      type: Number,
      required: true,
      min: [0, 'Total cost cannot be negative'],
    },
  },
  { _id: false }
);

const purchaseSchema = new Schema<IPurchase>(
  {
    purchaseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    supplier: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier is required'],
      index: true,
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    receivedDate: {
      type: Date,
    },
    items: {
      type: [purchaseItemSchema],
      validate: [(val: IPurchaseItem[]) => val.length > 0, 'Purchase must have at least one line item'],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'received', 'cancelled'],
      default: 'draft',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

export const Purchase: Model<IPurchase> = mongoose.model<IPurchase>('Purchase', purchaseSchema);
