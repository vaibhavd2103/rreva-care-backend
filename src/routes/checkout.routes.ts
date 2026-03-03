import { Router } from 'express';
import { asyncHandler } from '../utils/http';
import { authRequired, requireRole } from '../middlewares/auth';
import { createCheckoutSession } from '../controllers/checkout.controller';

export const checkoutRouter = Router();

checkoutRouter.post('/session', authRequired, requireRole('CUSTOMER'), asyncHandler(createCheckoutSession));
