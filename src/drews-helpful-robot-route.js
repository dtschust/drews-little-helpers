require('dotenv').config();
require('isomorphic-fetch');
require('./utils/mongoose-connect');
const FeedHiatus = require('./mongoose-models/Feed-Hiatus');

const { getDrewsHelpfulRobot } = require('./utils/slack');

const { sendMessageToFollowShows } = getDrewsHelpfulRobot();

function sendMessageToSlackResponseURL(responseURL, JSONmessage) {
	return fetch(responseURL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(JSONmessage),
	});
}

async function snoozeHiatus(feedId, endTime) {
	return FeedHiatus.findOneAndUpdate(
		{
			feed_id: feedId,
		},
		{ end_time: endTime }
	);
}

function addDrewsHelpfulRobotRoute(app) {
	app.post('/helper-action-endpoint', (req, res) => {
		res.status(200).end();

		const actionJSONPayload = JSON.parse(req.body.payload);

		if (actionJSONPayload.token !== process.env.ROBOT_VERIFICATION_TOKEN) {
			res.status(403).end('Access forbidden');
			return;
		}

		if (!actionJSONPayload.actions) {
			// This is not a legacy slash comand, so it's probably a workflow
			return;
		}
		const { name, value } = actionJSONPayload.actions[0];

		if (name === 'snoozeFeed') {
			// eslint-disable-next-line camelcase
			const { feed_id, end_time, title } = value;
			const formattedTitle = decodeURIComponent(title);
			snoozeHiatus(feed_id, end_time).then(() => {
				const message = {
					text: `Extended Hiatus! Snoozed ${formattedTitle} for a bit longer. Will be back on ${new Date(
						end_time
					).toLocaleDateString('en-US')}`,
					replace_original: true,
				};
				sendMessageToSlackResponseURL(actionJSONPayload.response_url, message);
			});
		}
	});
}

module.exports = addDrewsHelpfulRobotRoute;
