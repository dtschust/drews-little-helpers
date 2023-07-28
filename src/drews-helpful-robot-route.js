require('dotenv').config();
require('isomorphic-fetch');
require('./utils/mongoose-connect');
const slackBlockBuilder = require('slack-block-builder');
const FrameStatus = require('./mongoose-models/Frame-Status');

const { getDrewsHelpfulRobot } = require('./utils/slack');

const { Blocks, BlockCollection } = slackBlockBuilder;

const { webRobot } = getDrewsHelpfulRobot();

async function publishViewForUser(user) {
	const frameStatus = await FrameStatus.findOne();
	const blocks = [
		Blocks.Section().text(`*Welcome!!* \nI've got nothing for ya, head back to camp`),
		Blocks.Divider(),
		Blocks.Header().text('Frame Status:'),
		Blocks.Section().text(`
ip: \`${frameStatus.ip}\`
controller ip: \`${frameStatus.controller_ip}\`
network status: ${frameStatus.network_status}
time: ${new Date(frameStatus.time)}
uptime: ${frameStatus.uptime}
disk space remaining: ${frameStatus.disk_space_remaining}
disk usage: ${frameStatus.disk_usage_percent}%
number of photos: ${frameStatus.num_photos}
last photo update: ${new Date(frameStatus.last_photo_update)}
log:
\`\`\`
${frameStatus.log}
\`\`\`
debug:
\`\`\`
${JSON.stringify(frameStatus)}
\`\`\`
`),
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
		}
	});
}

module.exports = addDrewsHelpfulRobotRoute;
