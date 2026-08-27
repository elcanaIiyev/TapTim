import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { openApiDocument } from './docs/openapi.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { eventRouter } from './modules/events/event.routes.js';
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

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: Number(process.uptime().toFixed(2)),
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
    });
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
  app.use('/api/events', eventRouter);

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
