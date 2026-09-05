import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { assertDatabaseConnection } from './db/pool.js';
import { openApiDocument } from './docs/openapi.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { certificateRouter } from './modules/certificates/certificate.routes.js';
import { connectionRouter } from './modules/connections/connection.routes.js';
import { notificationRouter } from './modules/notifications/notification.routes.js';
import { compatibilityRouter } from './modules/compatibility/compatibility.routes.js';
import { eventRouter } from './modules/events/event.routes.js';
import { teamRouter } from './modules/teams/team.routes.js';
import { userRouter } from './modules/users/user.routes.js';
import { HttpError } from './utils/http-error.js';

export function createApp() {
  const app = express();

  // `contentSecurityPolicy` is disabled because Swagger UI serves inline
  // styles/scripts that the default Helmet policy blocks.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.use(
    cors({
      origin(origin, callback) {
        // Requests without an Origin header (curl, server-to-server, Swagger
        // UI on the same host) are allowed through.
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(HttpError.forbidden(`Origin ${origin} is not allowed by CORS.`));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (env.nodeEnv !== 'test') {
    app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  }

  // Liveness *and* readiness: the API is useless without its database, so a
  // failed ping is reported as 503 rather than a cheerful 200.
  app.get('/health', (_req, res) => {
    void (async () => {
      let database: 'up' | 'down' = 'up';
      try {
        await assertDatabaseConnection();
      } catch {
        database = 'down';
      }

      res.status(database === 'up' ? 200 : 503).json({
        status: database === 'up' ? 'ok' : 'degraded',
        database,
        uptime: Number(process.uptime().toFixed(2)),
        environment: env.nodeEnv,
        timestamp: new Date().toISOString(),
      });
    })();
  });

  app.get('/api/docs.json', (_req, res) => {
    res.json(openApiDocument);
  });

  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument as unknown as swaggerUi.JsonObject, {
      customSiteTitle: 'TapTim API Docs',
      swaggerOptions: { persistAuthorization: true, docExpansion: 'list' },
    }),
  );

  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/events', eventRouter);
  app.use('/api/teams', teamRouter);
  app.use('/api/compatibility', compatibilityRouter);
  app.use('/api/certificates', certificateRouter);
  app.use('/api/connections', connectionRouter);
  app.use('/api/notifications', notificationRouter);

  // The admin console. Mounted under `/api/ops` rather than the obvious
  // `/api/admin`, and absent from the OpenAPI document on purpose — publishing
  // it in Swagger would hand a reader the one surface they are not meant to
  // find. The real protection is the `requireAdmin` gate, which answers every
  // non-admin with a 404; the path is only there to keep it off the radar.
  app.use('/api/ops', adminRouter);

  app.get('/', (_req, res) => {
    res.json({
      name: 'TapTim API',
      version: '0.1.0',
      docs: '/api/docs',
      openapi: '/api/docs.json',
      health: '/health',
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
