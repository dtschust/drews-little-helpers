const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

const moviesSchema = new mongoose.Schema({ movies: Array }, { timestamps: true });
const TopMovies = mongoose.model('TopMovies', moviesSchema);

module.exports = TopMovies;
