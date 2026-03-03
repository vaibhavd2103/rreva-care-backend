import { Router } from 'express';
import { asyncHandler } from '../utils/http';
import { authRequired, requireRole } from '../middlewares/auth';
import { listMyOrders, adminListOrders, adminApproveOrder } from '../controllers/orders.controller';

export const adminOrdersRouter = Router();

adminOrdersRouter.get('/', authRequired, requireRole('ADMIN'), asyncHandler(adminListOrders));
adminOrdersRouter.patch('/:id/approve', authRequired, requireRole('ADMIN'), asyncHandler(adminApproveOrder));

// Customer route mounted under /api/admin/orders is not ideal; keep customer routes separate:
// We'll export a separate router in checkout module for /api/checkout or /api/orders.

export const myOrdersRouter = Router();
myOrdersRouter.get('/', authRequired, requireRole('CUSTOMER'), asyncHandler(listMyOrders));
