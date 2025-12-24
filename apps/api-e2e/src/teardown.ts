import { StartedMongoDBContainer } from '@testcontainers/mongodb';

interface GlobalThis {
  __MONGO_CONTAINER__: StartedMongoDBContainer;
}

declare const globalThis: GlobalThis;

export default async function globalTeardown() {
  console.log('\n🧹 Cleaning up test containers...\n');

  // Stop MongoDB container
  if (globalThis.__MONGO_CONTAINER__) {
    console.log('📦 Stopping MongoDB container...');
    await globalThis.__MONGO_CONTAINER__.stop();
    console.log('✅ MongoDB container stopped');
  }

  console.log('\n✅ E2E test cleanup complete!\n');
}
