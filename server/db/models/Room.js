import mongoose from 'mongoose';
import roomSchema from '../schemas/RoomSchema.js';

const collectionName = 'room-metadata';
const Room = mongoose.model('Room', roomSchema, collectionName);

export default Room;
