import mongoose from 'mongoose';
import { initMongooseConnection, STAGING_DATABASE } from '../server/db/mongoose.js';

describe('MongoDB connection target', () => {
  const variables = ['NODE_ENV', 'USE_PRODUCTION_DB', 'MONGODB_TARGET', 'MONGODB_STAGING_URI'];
  const stagingUri = `mongodb+srv://fixture:example@staging.example.invalid/${STAGING_DATABASE}`;
  let previous, connect;

  beforeEach(() => {
    previous = Object.fromEntries(variables.map(name => [name, process.env[name]]));
    for (const name of variables) delete process.env[name];
    connect = spyOn(mongoose, 'connect').and.resolveTo(mongoose);
  });

  afterEach(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('preserves development, production and explicit legacy database selection', async () => {
    expect(await initMongooseConnection({ quiet: true })).toBe('daily-page-test');
    process.env.NODE_ENV = 'production';
    expect(await initMongooseConnection({ quiet: true })).toBe('daily-page');
    expect(await initMongooseConnection({ useProductionDb: false, quiet: true })).toBe('daily-page-test');
    process.env.NODE_ENV = 'development';
    process.env.USE_PRODUCTION_DB = 'yes';
    expect(await initMongooseConnection({ quiet: true })).toBe('daily-page');
    expect(connect.calls.allArgs().map(([, options]) => options.dbName)).toEqual([
      'daily-page-test', 'daily-page', 'daily-page-test', 'daily-page'
    ]);
  });

  it('uses the dedicated staging URI and database in production mode', async () => {
    process.env.NODE_ENV = 'production';
    process.env.MONGODB_TARGET = 'staging';
    process.env.MONGODB_STAGING_URI = stagingUri;
    expect(await initMongooseConnection({ quiet: true })).toBe(STAGING_DATABASE);
    expect(connect).toHaveBeenCalledOnceWith(stagingUri, jasmine.objectContaining({ dbName: STAGING_DATABASE }));
  });

  it('fails before connecting when the staging selector is incorrect or conflicts with a legacy override', async () => {
    process.env.NODE_ENV = 'production';
    process.env.MONGODB_STAGING_URI = stagingUri;
    await expectAsync(initMongooseConnection()).toBeRejectedWithError(/requires MONGODB_TARGET=staging/);
    process.env.MONGODB_TARGET = 'stagng';
    await expectAsync(initMongooseConnection()).toBeRejectedWithError(/must be staging/);
    process.env.MONGODB_TARGET = 'staging';
    process.env.USE_PRODUCTION_DB = 'true';
    await expectAsync(initMongooseConnection()).toBeRejectedWithError(/cannot be combined/);
    process.env.USE_PRODUCTION_DB = 'false';
    await expectAsync(initMongooseConnection({ useProductionDb: false })).toBeRejectedWithError(/database override/);
    expect(connect).not.toHaveBeenCalled();
  });

  it('rejects missing, malformed or incorrectly targeted staging URIs before connecting', async () => {
    process.env.MONGODB_TARGET = 'staging';
    await expectAsync(initMongooseConnection()).toBeRejectedWithError(/MONGODB_STAGING_URI is required/);
    process.env.MONGODB_STAGING_URI = 'invalid';
    await expectAsync(initMongooseConnection()).toBeRejectedWithError(/valid MongoDB connection string/);
    process.env.MONGODB_STAGING_URI = stagingUri.replace(STAGING_DATABASE, 'daily-page');
    await expectAsync(initMongooseConnection()).toBeRejectedWithError(/must select daily-page-staging/);
    expect(connect).not.toHaveBeenCalled();
  });

  it('keeps the staging URI out of connection errors', async () => {
    process.env.MONGODB_TARGET = 'staging';
    process.env.MONGODB_STAGING_URI = stagingUri;
    connect.and.rejectWith(new Error(stagingUri));
    await expectAsync(initMongooseConnection()).toBeRejectedWithError(/^Could not connect to daily-page-staging\./);
  });
});
