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
	// TODO: Send slack message as well
}
function addSnoozeHiatusRoute(app) {
	// TODO Make this URL a const
	app.post('/snooze-hiatus', (req, res) => {
		// eslint-disable-next-line camelcase
		const { feed_id, end_time, title } = req.params;
		snoozeHiatus(feed_id, end_time, decodeURIComponent(title)).then(() => {
			res.status(200)
				.text(
					`Successfully snoozed ${title} feed until ${new Date(
						end_time
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
