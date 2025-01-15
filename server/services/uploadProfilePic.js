import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { findUserById, updateUserProfile } from '../db/user.js';
import { generateJWT } from './jwt.js';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const uploadProfilePic = async (req, userId) => {
  const { file } = req;

  if (!file) {
    throw new Error('No file uploaded');
  }

  const fileKey = `profile-pics/${userId}-${Date.now()}.${file.mimetype.split('/')[1]}`;
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileKey,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  const command = new PutObjectCommand(params);
  await s3.send(command);

  const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
  await updateUserProfile(userId, { profilePic: imageUrl });

  const updatedUser = await findUserById(userId);
  const newToken = generateJWT({
    id: updatedUser._id,
    username: updatedUser.username,
    profilePic: updatedUser.profilePic,
  });

  return { imageUrl, newToken };
};
