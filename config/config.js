import dotenv from 'dotenv';

// Only load .env file in non-production environments
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const config = {
  // MongoDB Config
  mongoDbAddr: process.env.MONGO_DB_ADDR,
  mongoDbPw: process.env.MONGO_DB_PW,

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

  // Email Config
  emailUser: process.env.EMAIL_USER,
  emailPass: process.env.EMAIL_PASS,

  // App Config
  port: process.env.PORT || 3000,
  backendUrl: process.env.BACKEND_URL
};
