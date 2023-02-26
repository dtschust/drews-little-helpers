const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

const FeedHiatus = mongoose.model('FeedHiatus', {
	feed_id: Number,
	title: String,
	feed_url: String,
	site_url: String,
	end_time: Number,
});

module.exports = FeedHiatus;
