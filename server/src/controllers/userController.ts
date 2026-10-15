import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { User } from '../models/User';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middlewares/auth';

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['admin', 'staff']),
  }),
});

export const updateUserStatusSchema = z.object({
  body: z.object({
    status: z.enum(['active', 'disabled']),
  }),
});

export async function getUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const search = (req.query.search as string || '').trim();

    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    sendSuccess(res, users, 'Users retrieved successfully', 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function createUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      sendError(res, 'A user with this email already exists', 409);
      return;
    }

    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role,
      status: 'active',
    });

    sendSuccess(
      res,
      {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
      },
      'User created successfully',
      201
    );
  } catch (error) {
    next(error);
  }
}

export async function updateUserStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Prevent disabling self
    if (req.user && req.user._id.toString() === id && status === 'disabled') {
      sendError(res, 'Cannot disable your own active account', 400);
      return;
    }

    const user = await User.findByIdAndUpdate(id, { status }, { new: true });
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    sendSuccess(res, user, `User status updated to ${status}`);
  } catch (error) {
    next(error);
  }
}
