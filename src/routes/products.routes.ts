import { Router } from 'express';
import { asyncHandler } from '../utils/http';
import { authRequired, requireRole } from '../middlewares/auth';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct
} from '../controllers/products.controller';

export const productRouter = Router();

productRouter.get('/', asyncHandler(listProducts));
productRouter.get('/:id', asyncHandler(getProduct));

productRouter.post('/', authRequired, requireRole('ADMIN'), asyncHandler(createProduct));
productRouter.put('/:id', authRequired, requireRole('ADMIN'), asyncHandler(updateProduct));
productRouter.delete('/:id', authRequired, requireRole('ADMIN'), asyncHandler(deleteProduct));
