import {
  MongoDBContainer,
  StartedMongoDBContainer,
} from '@testcontainers/mongodb';

interface GlobalThis {
  __MONGO_CONTAINER__: StartedMongoDBContainer;
  __API_URL__: string;
}

declare const globalThis: GlobalThis;

export default async function globalSetup() {
  console.log('\n🚀 Starting Testcontainers for E2E tests...\n');

  // Start MongoDB container
  console.log('📦 Starting MongoDB container...');
  const mongoContainer = await new MongoDBContainer('mongo:7').start();
  globalThis.__MONGO_CONTAINER__ = mongoContainer;

  const mongoUri = mongoContainer.getConnectionString();
  console.log(`✅ MongoDB started at: ${mongoUri}`);

  // Set environment for tests
  process.env.MONGODB_URI = mongoUri;

  // Check if API is running locally
  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  globalThis.__API_URL__ = apiUrl;
  process.env.API_URL = apiUrl;

  try {
    const response = await fetch(`${apiUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      console.log(`✅ API available at: ${apiUrl}`);
    } else {
      console.log(`⚠️  API returned status ${response.status}`);
    }
  } catch {
    console.log(`\n⚠️  API not running at ${apiUrl}`);
    console.log('   Start the API with: npm run start:api');
    console.log('   Or set API_URL environment variable\n');
  }

  console.log('\n✅ E2E test environment ready!\n');
}
