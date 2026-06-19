import dotenv from 'dotenv';

// Only load .env file in non-production environments
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const config = {
  // MongoDB Config
  mongoDbAddr: process.env.MONGO_DB_ADDR,
  mongoDbPw: process.env.MONGO_DB_PW,

  // TURN / WebRTC
  turnUsername: process.env.METERED_TURN_USERNAME,
  turnCredential: process.env.METERED_TURN_CREDENTIAL,

  // Google Drive API
  baseballFolderId: process.env.BASEBALL_FOLDER_ID,
  musicFolderId: process.env.MUSIC_FOLDER_ID,
  artistsFolderId: process.env.ARTISTS_FOLDER_ID,
  albumsFolderId: process.env.ALBUMS_FOLDER_ID,
  appAuth: process.env.APP_AUTH,
  googCreds: process.env.GOOG_CREDS,

  // AWS S3
  awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
  awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsRegion: process.env.AWS_REGION,
  s3BucketName: process.env.S3_BUCKET_NAME,

  // Mailgun Config
  mailgunApiKey: process.env.MAILGUN_API_KEY,

  // App Config
  port: process.env.PORT || 3000,
  backendUrl: process.env.BACKEND_URL,
  rateLimitSalt: process.env.RATE_LIMIT_SALT,

  // Support page funding display
  supportMonthlyGoalUsd: process.env.SUPPORT_MONTHLY_GOAL_USD,
  supportMonthlyRaisedUsd: process.env.SUPPORT_MONTHLY_RAISED_USD,
  supportDonateUrl: process.env.SUPPORT_DONATE_URL,
  supportMonthlyDonateUrl: process.env.SUPPORT_MONTHLY_DONATE_URL,
  supportOneTimeDonateUrl: process.env.SUPPORT_ONE_TIME_DONATE_URL,
  stripeSupportMonthlyPriceId: process.env.STRIPE_SUPPORT_MONTHLY_PRICE_ID,
  stripeSupportOneTimePriceId: process.env.STRIPE_SUPPORT_ONE_TIME_PRICE_ID,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET
};
