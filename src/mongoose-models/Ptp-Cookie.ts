import mongoose, { Schema, Document, Model } from 'mongoose';

interface PtpCookieDocument extends Document {
	cookie: string;
}

const cookieSchema = new Schema<PtpCookieDocument>({
	cookie: { type: String, required: true },
});

const PtpCookie: Model<PtpCookieDocument> = mongoose.model('Cookie', cookieSchema);

export = PtpCookie;
