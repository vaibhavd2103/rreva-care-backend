import { Router } from 'express';
import express from 'express';
import { asyncHandler } from '../utils/http';
import { handleStripeWebhook } from '../controllers/stripeWebhook.controller';

export const stripeWebhookRouter = Router();

// raw body is required for Stripe signature verification
stripeWebhookRouter.post('/', express.raw({ type: 'application/json' }), asyncHandler(handleStripeWebhook));
