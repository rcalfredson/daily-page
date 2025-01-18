import mongoose from 'mongoose';
import pageSchema from '../schemas/PageSchema.js';

const Page = mongoose.model('Page', pageSchema, 'pages');

export default Page;
