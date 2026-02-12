// apps/api/src/app.js
import 'dotenv/config';
import express from 'express';
import { z } from 'zod';

import { NotFoundError, BadRequestError } from './errors/common.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { validate } from './middleware/validate.js';
import { applySecurityMiddleware } from './middleware/security.js';
import { JSON_BODY_LIMIT, TRUST_PROXY } from './config/security.js';
import { createSessionMiddleware } from './middleware/session.js';
import { authRouter } from './routes/auth.js';
import { requireRole } from './middleware/require-role.js';
import { productsRouter } from './routes/products.js';
import { cartRouter } from './routes/cart.js';
import { ordersRouter } from './routes/orders.js';
import { adminOrdersRouter } from './routes/admin-orders.js';
import { adminProductsRouter } from './routes/admin-products.js';
import paymentsRouter from './routes/payments.js';
import stripeWebhooksRouter from './routes/webhooks.js';

export function createApp() {
  const app = express();

  app.use(requestIdMiddleware);

  applySecurityMiddleware(app);

  // Fail-fast: if router import is broken, crash with a clear message.
  if (typeof stripeWebhooksRouter !== 'function') {
    throw new Error(
      `stripeWebhooksRouter import is invalid (expected express.Router() function). Got: ${typeof stripeWebhooksRouter}`,
    );
  }
  if (typeof paymentsRouter !== 'function') {
    throw new Error(
      `paymentsRouter import is invalid (expected express.Router() function). Got: ${typeof paymentsRouter}`,
    );
  }

  app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhooksRouter);

  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  if (process.env.NODE_ENV === 'production' || TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  app.use(createSessionMiddleware());

  app.use((err, _req, _res, next) => {
    if (err instanceof SyntaxError) {
      return next(new BadRequestError('Ungültiges JSON', err));
    }
    return next(err);
  });

  app.use('/auth', authRouter);
  app.use('/products', productsRouter);
  app.use('/cart', cartRouter);
  app.use('/orders', ordersRouter);

  app.use('/payments', paymentsRouter);

  app.use('/admin/orders', adminOrdersRouter);
  app.use('/admin/products', adminProductsRouter);

  if (process.env.NODE_ENV === 'test') {
    app.get('/__test__/admin-only', requireRole('admin'), (_req, res) => {
      res.status(200).json({ ok: true });
    });

    app.post('/__test__/set-role', (req, res) => {
      const role = req.body?.role;

      if (!req.session?.user) {
        return res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Nicht eingeloggt.' },
        });
      }

      req.session.user.role = role;
      return res.status(200).json({ ok: true, role });
    });
  }

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post(
    '/echo',
    validate({
      body: z.object({
        message: z.string().min(1),
      }),
    }),
    (req, res) => {
      res.status(200).json({ message: req.body.message });
    },
  );

  app.use((_req, _res, next) => next(new NotFoundError()));
  app.use(errorHandler);

  return app;
}
