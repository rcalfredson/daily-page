import mongoose from 'mongoose';
import backupSchema from '../schemas/BackupSchema.js';

const Backup = mongoose.model('Backup', backupSchema, 'doc-backup');

export default Backup;
