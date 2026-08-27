import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`\n  TapTim API ready`);
  console.log(`  • REST      http://localhost:${env.port}/api`);
  console.log(`  • Swagger   http://localhost:${env.port}/api/docs`);
  console.log(`  • Health    http://localhost:${env.port}/health`);
  console.log(`  • Env       ${env.nodeEnv}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} received, shutting down.`);
    server.close(() => process.exit(0));
  });
}
