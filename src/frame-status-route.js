require('dotenv').config();
const FrameStatus = require('./mongoose-models/Frame-Status');
const { getDrewsHelpfulRobot } = require('./utils/slack');

const { sendMessageToCronLogs, sendBlockMessageToCronLogs } = getDrewsHelpfulRobot();

function addFrameStatusRoute(app) {
	app.post('/frameStatus', async (req, res) => {
		const reqBody = req.body;
		const frameStatusModel = new FrameStatus({ ...reqBody, time: Date.now() });
		await FrameStatus.deleteMany();
		await frameStatusModel.save();

		sendMessageToCronLogs(`Received a status update from momo's frame controller!`).then(
			({ ts }) => {
				const blocks = [];
				blocks.push({
					type: 'header',
					text: { type: 'plain_text', text: `Frame Controller Update`, emoji: true },
				});
				blocks.push({
					type: 'section',
					text: { type: 'mrkdwn', text: JSON.stringify(reqBody) },
				});
				return sendBlockMessageToCronLogs(blocks, { thread_ts: ts })
					.then(() => {
						console.log('Logs sent to Slack');
					})
					.catch((err) => {
						console.log('Failed to send logs to Slack:', err);
						console.log(JSON.stringify(blocks));
						return 1;
					});
			}
		);
		res.status(200).end();
	});
}

module.exports = addFrameStatusRoute;
