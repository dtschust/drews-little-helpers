require('dotenv').config();
require('isomorphic-fetch');
require('./utils/mongoose-connect');
const FeedHiatus = require('./mongoose-models/Feed-Hiatus');
const { getDrewsHelpfulRobot } = require('./utils/slack');

const { webRobot } = getDrewsHelpfulRobot();

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
	app.post('/helper-action-endpoint', async (req, res) => {
		if (req.body.type === 'url_verification') {
			res.send(req.body.challenge).status(200).end();
			return;
		}
		if (req.body.type === 'event_callback') {
			const { event } = req.body;
			const { user, type } = event;
			if (type === 'app_home_opened') {
				const hiatusedFeeds = await FeedHiatus.find(undefined);
				const blocks = [
					{
						type: 'section',
						text: {
							type: 'mrkdwn',
							text: '*Welcome!* \nView your feeds currently on hiatus below',
						},
					},
				]
					.concat(
						hiatusedFeeds.map(({ title, site_url: siteUrl, end_time: endTime }) => {
							// TODO: Action buttons
							return {
								type: 'section',
								text: {
									type: 'mrkdwn',
									text: `${title} (\`${siteUrl}\`)on hiatus until ${new Date(
										endTime
									).toLocaleDateString('en-US')}`,
								},
							};
						})
					)
					.concat([
						{
							type: 'divider',
						},
					]);

				const view = {
					type: 'home',
					title: {
						type: 'plain_text',
						text: 'I am not sure where this text is visible!',
					},
					blocks,
				};

				console.log(JSON.stringify(view));
				webRobot.views.publish({
					user_id: user,
					view: JSON.stringify(view),
				});
			}
			res.status(200).end();
			return;
		}
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
		const { name, value, selected_options: selectedOptions } = actionJSONPayload.actions[0];

		if (name.indexOf('snoozeFeed') === 0) {
			const jsonValue = JSON.parse(selectedOptions[0].value);
			const { feed_id, end_time, title } = jsonValue;
			const formattedTitle = decodeURIComponent(title);
			snoozeHiatus(feed_id, end_time).then(() => {
				const message = {
					text: `Extended Hiatus! Snoozed *${formattedTitle}* for a bit longer. Will be back on ${new Date(
						end_time
					).toLocaleDateString('en-US')}`,
					replace_original: true,
				};
				sendMessageToSlackResponseURL(actionJSONPayload.response_url, message);
			});
		} else if (name.indexOf('dismiss') === 0) {
			const channel = actionJSONPayload.channel.id;
			const { message_ts: ts } = actionJSONPayload;
			webRobot.chat.delete({
				channel,
				ts,
			});
		} else if (name.indexOf('unsubscribeFeed') === 0) {
			const jsonValue = JSON.parse(value);
			const { feed_id, title } = jsonValue;
			const formattedTitle = decodeURIComponent(title);
			FeedHiatus.findOneAndDelete({ feed_id }).then(() => {
				const message = {
					text: `Permanently unsubscribed from *${formattedTitle}*. Bye!`,
					replace_original: true,
				};
				sendMessageToSlackResponseURL(actionJSONPayload.response_url, message);
			});
		}
	});
}

module.exports = addDrewsHelpfulRobotRoute;
