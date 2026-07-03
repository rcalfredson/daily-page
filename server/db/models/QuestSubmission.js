import mongoose from 'mongoose';
import questSubmissionSchema from '../schemas/QuestSubmissionSchema.js';

export default mongoose.model('QuestSubmission', questSubmissionSchema);
