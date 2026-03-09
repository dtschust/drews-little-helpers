import mongoose, { Document, Model, Schema } from 'mongoose';

interface NotificationDocument extends Document {
	timestamp: number;
	message: string;
}

const notificationSchema = new Schema<NotificationDocument>({
	timestamp: { type: Number, required: true },
	message: { type: String, required: true },
});

const Notification: Model<NotificationDocument> = mongoose.model(
	'Notification',
	notificationSchema
);

export default Notification;
