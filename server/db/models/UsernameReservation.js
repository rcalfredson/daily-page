import mongoose from 'mongoose';
import usernameReservationSchema from '../schemas/UsernameReservationSchema.js';

const UsernameReservation = mongoose.model(
  'UsernameReservation',
  usernameReservationSchema,
  'username-reservations'
);

export default UsernameReservation;
