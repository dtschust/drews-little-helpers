require('dotenv').config();
require('isomorphic-fetch');
require('./utils/mongoose-connect');
const _ = require('lodash');
const slackBlockBuilder = require('slack-block-builder');

const FeedHiatus = require('./mongoose-models/Feed-Hiatus');
const { getDrewsHelpfulRobot } = require('./utils/slack');

const { Elements, Blocks, BlockCollection, Bits } = slackBlockBuilder;

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

async function publishViewForUser(user) {
	const hiatusedFeeds = await FeedHiatus.find(undefined);
	const blocks = [
		Blocks.Section().text('*Welcome!!* \nView your feeds currently on hiatus below'),
		Blocks.Divider(),
	];
	_.sortBy(hiatusedFeeds, 'end_time').forEach(
		({ title, site_url: siteUrl, end_time: endTime, feed_id: feedId }) => {
			// TODO: Action buttons
			blocks.push(
				Blocks.Section()
					.text(
						`*${title}* on hiatus until *${new Date(endTime).toLocaleDateString(
							'en-US'
						)}*`
					)
					.accessory(
						Elements.Button({
							text: 'Edit',
							actionId: 'editHiatus',
							value: JSON.stringify({ title, siteUrl, endTime, feedId }),
						})
					)
			);
			blocks.push(Blocks.Context().elements(`\`${siteUrl}\``));
			blocks.push(Blocks.Divider());
		}
	);

	const view = {
		type: 'home',
		title: {
			type: 'plain_text',
			text: 'what is this',
		},
		blocks: BlockCollection(blocks),
	};

	return webRobot.views.publish({
		user_id: user,
		view: JSON.stringify(view),
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

async function openEditHiatusModal({ triggerId }, { title, feedId, endTime }) {
	const blocks = [
		Blocks.Section().text(`How would you like to change your hiatus of ${title}?`),
		Blocks.Actions().elements(
			Elements.StaticSelect({ actionId: 'snoozeFeed' }).options(
				[1, 2, 4, 8].map((weeksToSnooze) => {
					const newEndTime = endTime + weeksToSnooze * 604800000;
					return Bits.Option({
						text: `Snooze ${weeksToSnooze} week${weeksToSnooze === 1 ? '' : 's'}`,
						value: JSON.stringify({
							feedId,
							end_time: newEndTime,
							title: encodeURIComponent(title),
						}),
					});
				})
			),
			Elements.Button({
				text: `Unsubscribe`,
				actionId: `unsubscribeFeed`,
				value: JSON.stringify({ feedId, title: encodeURIComponent(title) }),
			})
				.danger()
				.confirm(
					Bits.ConfirmationDialog({
						title: 'Are you sure?',
						confirm: 'Yes',
						deny: 'No',
						text: `Are you sure you would like to permanently unsubscribe from *${title}*?`,
					})
				)
		),
	];
	return webRobot.views.open({
		trigger_id: triggerId,
		view: {
			type: 'modal',
			callback_id: 'editHiatusModal',
			title: {
				type: 'plain_text',
				text: `Edit Hiatus`,
			},
			blocks: BlockCollection(blocks),
		},
	});
}

function addDrewsHelpfulRobotRoute(app) {
	app.post('/helper-action-endpoint', (req, res) => {
		if (req.body.type === 'url_verification') {
			res.send(req.body.challenge).status(200).end();
			return;
		}
		if (req.body.type === 'event_callback') {
			const { event } = req.body;
			const { user, type } = event;
			if (type === 'app_home_opened') {
				publishViewForUser(user);
			}
			res.status(200).end();
			return;
		}
		const payload = JSON.parse(req.body.payload);

		if (payload.type === 'block_actions') {
			if (payload.view && payload.view.type === 'home') {
				if (payload.actions[0].action_id.indexOf('editHiatus') === 0) {
					openEditHiatusModal(
						{ triggerId: payload.trigger_id },
						JSON.parse(payload.actions[0].value)
					);
				}
			} else if (payload.view && payload.view.type === 'modal') {
				if (payload.actions[0].action_id.indexOf('snoozeFeed') === 0) {
					// TODO
					console.log('Snoozefeed: ', payload.actions[0].value);
				} else if (payload.actions[0].action_id.indexOf('unsubscribeFeed') === 0) {
					// TOD
					console.log('unsubscribeFeed: ', payload.actions[0].value);
				}
			}
			res.status(200).end();
			return;
		}

		if (payload.token !== process.env.ROBOT_VERIFICATION_TOKEN) {
			res.status(403).end('Access forbidden');
			return;
		}

		res.status(200).end();

		if (!payload.actions) {
			// This is not a legacy slash comand, so it's probably a workflow
			return;
		}
		const { name, value, selected_options: selectedOptions } = payload.actions[0];

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
				sendMessageToSlackResponseURL(payload.response_url, message);
			});
		} else if (name.indexOf('dismiss') === 0) {
			const channel = payload.channel.id;
			const { message_ts: ts } = payload;
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
				sendMessageToSlackResponseURL(payload.response_url, message);
			});
		}
	});
}

module.exports = addDrewsHelpfulRobotRoute;
