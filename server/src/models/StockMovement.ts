import mongoose, { Document, Schema, Model } from 'mongoose';

export type MovementType = 'purchase' | 'sale' | 'adjustment' | 'reversal';

export interface IStockMovement extends Document {
  product: mongoose.Types.ObjectId;
  movementType: MovementType;
  quantityChange: number; // Positive for additions, negative for reductions
  previousQuantity: number;
  newQuantity: number;
  referenceType?: 'Purchase' | 'Sale' | 'Manual' | 'Adjustment';
  referenceId?: mongoose.Types.ObjectId | string;
  user: mongoose.Types.ObjectId;
  reason?: string;
  createdAt: Date;
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
      index: true,
    },
    movementType: {
      type: String,
      enum: ['purchase', 'sale', 'adjustment', 'reversal'],
      required: true,
      index: true,
    },
    quantityChange: {
      type: Number,
      required: true,
    },
    previousQuantity: {
      type: Number,
      required: true,
    },
    newQuantity: {
      type: Number,
      required: true,
      min: [0, 'New quantity cannot be negative'],
    },
    referenceType: {
      type: String,
      enum: ['Purchase', 'Sale', 'Manual', 'Adjustment'],
    },
    referenceId: {
      type: Schema.Types.Mixed,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 300,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Movements are append-only audit trail
  }
);

stockMovementSchema.index({ product: 1, createdAt: -1 });

export const StockMovement: Model<IStockMovement> = mongoose.model<IStockMovement>(
  'StockMovement',
  stockMovementSchema
);
