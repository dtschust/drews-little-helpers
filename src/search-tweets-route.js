const _ = require('lodash');
require('dotenv').config();
require('isomorphic-fetch');
const OwnTweet = require('./mongoose-models/Own-Tweet');

let allTweets;

async function getAllTweets() {
	if (allTweets) return allTweets;
	allTweets = await OwnTweet.find();
	setTimeout(() => {
		allTweets = null;
	}, 60 * 60 * 1000);

	return allTweets;
}

async function searchTweets(query) {
	const regex = new RegExp(query, 'im');
	const tweets = await getAllTweets();
	const results = _.orderBy(
		tweets.filter((tweet) => tweet?.full_text?.match(regex)),
		'id',
		'desc'
	).slice(0, 50);
	return results;
}

function addSearchTweetsRoute(app) {
	app.get('/searchTweets', (req, res) => {
		const query = decodeURI(req?.query?.query);
		searchTweets(query).then((results) => {
			res.status(200).json({ results }).end();
		});
	});
}

module.exports = addSearchTweetsRoute;
