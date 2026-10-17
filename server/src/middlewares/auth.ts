import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { User, IUser, UserRole } from '../models/User';
import { sendError } from '../utils/response';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      sendError(res, 'Authentication required. No token provided.', 401);
      return;
    }

    const decoded = jwt.verify(token, ENV.JWT_SECRET) as { id: string; role: string };
    const user = await User.findById(decoded.id);

    if (!user) {
      sendError(res, 'Account no longer exists.', 401);
      return;
    }

    if (user.status !== 'active') {
      sendError(res, 'Account is disabled. Please contact an administrator.', 403);
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      sendError(res, 'Invalid authorization token.', 401);
      return;
    }
    if (error.name === 'TokenExpiredError') {
      sendError(res, 'Token expired. Please log in again.', 401);
      return;
    }
    next(error);
  }
}

export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Unauthenticated access.', 401);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(
        res,
        `Access denied. Role '${req.user.role}' lacks necessary permissions.`,
        403
      );
      return;
    }

    next();
  };
}
