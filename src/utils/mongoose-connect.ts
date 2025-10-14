import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

mongoose.set('strictQuery', true);

mongoose.connect(process.env.MONGO_DB_URI ?? '', {});

export function getMongoose() {
	return mongoose;
}
