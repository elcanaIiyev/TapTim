import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { platformStats } from './stats.service.js';

export const statsRouter = Router();

statsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    // Shared by every visitor to the landing page and never personal, so the
    // CDN may hold it briefly rather than every page view costing a query.
    res.set('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');
    res.status(200).json({ data: await platformStats() });
  }),
);
