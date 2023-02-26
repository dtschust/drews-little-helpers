const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

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
	coordinates: Object,
	place: Object,
	quoted_status_id: Number,
	quoted_status_id_str: String,
	quoted_status: Object,
	retweeted_status: Object,
	quote_count: Number,
	reply_count: Number,
	extended_entities: Object,
	filter_level: String,
	matching_rules: Array,
});

module.exports = OwnTweet;
