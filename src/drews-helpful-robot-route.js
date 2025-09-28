require('dotenv').config();
const slackBlockBuilder = require('slack-block-builder');
const { getDrewsHelpfulRobot } = require('./utils/slack');

const { Blocks, BlockCollection } = slackBlockBuilder;
const { webRobot } = getDrewsHelpfulRobot();

function publishViewForUser(user) {
	const blocks = [
		Blocks.Section().text(`*Welcome!!* \nI've got nothing for ya, head back to camp`),
	];

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

function addDrewsHelpfulRobotRoute(fastify) {
	fastify.post('/helper-action-endpoint', (request, reply) => {
		const body = request.body || {};
		if (body.type === 'url_verification') {
			reply.code(200).send(body.challenge);
			return;
		}
		if (body.type === 'event_callback') {
			const { event } = body;
			const { user, type } = event;
			if (type === 'app_home_opened') {
				publishViewForUser(user);
			}
			reply.code(200).send();
			return;
		}
		const payload = JSON.parse(body.payload);

		if (payload.type === 'block_actions') {
			reply.code(200).send();
			return;
		}

		if (payload.token !== process.env.ROBOT_VERIFICATION_TOKEN) {
			reply.code(403).send('Access forbidden');
			return;
		}

		reply.code(200).send();

		if (!payload.actions) {
			// This is not a legacy slash comand, so it's probably a workflow
		}
	});
}

module.exports = addDrewsHelpfulRobotRoute;
