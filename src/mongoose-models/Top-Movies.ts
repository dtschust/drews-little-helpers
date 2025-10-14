import mongoose, { Schema, Document, Model } from 'mongoose';

interface TopMovieDocument extends Document {
	movies: unknown[];
	createdAt: Date;
	updatedAt: Date;
}

const moviesSchema = new Schema<TopMovieDocument>(
	{
		movies: { type: [Schema.Types.Mixed], default: [] },
	},
	{ timestamps: true }
);

const TopMovies: Model<TopMovieDocument> = mongoose.model('TopMovies', moviesSchema);

export default TopMovies;
