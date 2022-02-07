const mongoose = require('mongoose');

const TopMovies = mongoose.model('TopMovies', {
	movies: Array,
});

module.exports = TopMovies;
