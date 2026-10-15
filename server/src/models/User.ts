import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'admin' | 'staff';
export type UserStatus = 'active' | 'disabled';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  status: UserStatus;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // Don't return password by default in queries
    },
    role: {
      type: String,
      enum: ['admin', 'staff'],
      default: 'staff',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
      index: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err: any) {
    next(err);
  }
});

userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  const user = await User.findById(this._id).select('+password');
  if (!user || !user.password) return false;
  return bcrypt.compare(candidate, user.password);
};

export const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
