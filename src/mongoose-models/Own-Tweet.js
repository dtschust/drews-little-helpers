const mongoose = require('mongoose');

const OwnTweet = mongoose.model('OwnTweet', {
	id: Number,
	id_str: String,
	text: String,
	full_text: String,
	created_at: String,
	truncated: Boolean,
	entities: Object,
	source: String,
	in_reply_to_status_id: Number,
	in_reply_to_status_id_str: String,
	in_reply_to_user_id: Number,
	in_reply_to_user_id_str: String,
	in_reply_to_screen_name: String,
	user: Object,
	is_quote_status: Boolean,
	retweet_count: Number,
	favorite_count: Number,
	favorited: Boolean,
	retweeted: Boolean,
	possibly_sensitive: Boolean,
	lang: String,
});

module.exports = OwnTweet;
