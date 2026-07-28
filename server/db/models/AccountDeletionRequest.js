import mongoose from 'mongoose';
import accountDeletionRequestSchema from '../schemas/AccountDeletionRequestSchema.js';

const AccountDeletionRequest = mongoose.model(
  'AccountDeletionRequest',
  accountDeletionRequestSchema,
  'account-deletion-requests'
);

export default AccountDeletionRequest;
