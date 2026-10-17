import app from './app';
import { ENV } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { seedInitialData } from './scripts/seed';

async function bootstrap() {
  try {
    await connectDatabase();
    await seedInitialData();

    const server = app.listen(ENV.PORT, () => {
      console.log(`🚀 Shree Ganesh Kirana Store Backend running on http://localhost:${ENV.PORT}`);
      console.log(`📡 Health Check: http://localhost:${ENV.PORT}/api/health`);
    });

    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Gracefully terminating server...`);
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err: any) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

bootstrap();
