import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { findUserById, updateUserProfile } from '../db/userService.js';
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

  const maxWidth = 500;
  const maxHeight = 500;

  // Resize the image to fit within max dimensions
  const resizedBuffer = await sharp(file.buffer)
    .resize(maxWidth, maxHeight, { fit: 'inside' }) // Maintain aspect ratio
    .toBuffer();

  if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
    throw new Error('Only JPEG and PNG images are allowed.');
  }

  const extensionMap = { 'image/jpeg': 'jpg', 'image/png': 'png' };
  const fileExtension = extensionMap[file.mimetype] || 'bin'; // Fallback to 'bin' for unknown mimetypes

  const fileKey = `profile-pics/${userId}-${Date.now()}.${fileExtension}`;
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileKey,
    Body: resizedBuffer,
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
