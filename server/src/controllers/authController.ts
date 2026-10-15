import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User';
import { ENV } from '../config/env';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middlewares/auth';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Valid email is required'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      sendError(res, 'Invalid email or password credentials', 401);
      return;
    }

    if (user.status !== 'active') {
      sendError(res, 'Your account is disabled. Contact your system administrator.', 403);
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      sendError(res, 'Invalid email or password credentials', 401);
      return;
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      ENV.JWT_SECRET,
      { expiresIn: ENV.JWT_EXPIRES_IN as any }
    );

    sendSuccess(res, {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        lastLogin: user.lastLogin,
      },
    }, 'Login successful');
  } catch (error) {
    next(error);
  }
}

export async function getCurrentUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'User not found', 404);
      return;
    }

    sendSuccess(res, {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status,
      lastLogin: req.user.lastLogin,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  // Client discards JWT; server sends acknowledgment
  sendSuccess(res, null, 'Logged out successfully');
}
