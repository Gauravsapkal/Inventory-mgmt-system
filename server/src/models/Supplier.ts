import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ISupplier extends Document {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const supplierSchema = new Schema<ISupplier>(
  {
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      maxlength: 150,
      index: true,
    },
    contactPerson: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

supplierSchema.index({ name: 'text', contactPerson: 'text', phone: 'text' });

export const Supplier: Model<ISupplier> = mongoose.model<ISupplier>('Supplier', supplierSchema);
