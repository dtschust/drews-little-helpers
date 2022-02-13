require('dotenv').config();
require('isomorphic-fetch');
require('dotenv').config();
const { WebClient } = require('@slack/client');
const mongoose = require('mongoose');
const FeedHiatus = require('./mongoose-models/Feed-Hiatus');

const token = process.env.SLACK_API_TOKEN || '';
const web = new WebClient(token);

mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGO_DB_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});

async function snoozeHiatus(feedId, endTime, title) {
	await FeedHiatus.findOneAndUpdate(
		{
			feed_id: feedId,
		},
		{ end_time: endTime }
	);
	return sendMessage(
		`Extended Hiatus! Snoozed ${title} for a bit longer. Will be back on ${new Date(
			endTime
		).toLocaleDateString('en-US')}`
	);
}
function addSnoozeHiatusRoute(app) {
	// TODO Make this URL a const
	app.get('/snooze-hiatus', (req, res) => {
		// eslint-disable-next-line camelcase
		const { feed_id, end_time, title } = req.query;
		const endTime = parseInt(end_time, 10);
		snoozeHiatus(feed_id, endTime, decodeURIComponent(title)).then(() => {
			res.status(200)
				.send(
					`Successfully snoozed ${title} feed until ${new Date(
						endTime
					).toLocaleDateString('en-US')}`
				)
				.end();
		});
	});
}

function sendMessage(text) {
	return web.chat.postMessage({
		channel: process.env.PTP_SLACK_CHANNEL_ID,
		text,
	});
}

module.exports = addSnoozeHiatusRoute;
