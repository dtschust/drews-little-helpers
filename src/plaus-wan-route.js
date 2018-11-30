require('dotenv').config();
require('isomorphic-fetch');

const { WebClient } = require('@slack/client');

const token = process.env.PLAUS_SLACK_BOT_USER_OAUTH_ACCESS_TOKEN || '';
const web = new WebClient(token);

function addPlausWanRoute(app) {
	app.post('/plaus', (req, res) => {
		const reqBody = req.body || {};
		const { type, challenge } = reqBody;
		if (type === 'url_verification') {
			res.json({ challenge });
		} else if (type === 'app_mention') {
			const { event } = reqBody;
			const { ts, channel } = event;
			sendMessage(`testing ${ts}`, channel);
		}
		res.status(200).end();
	});
}

function sendMessage(text, channel) {
	return web.chat
		.postMessage({
			channel,
			text,
		})
		.then(() => {
			console.log('Message sent: ', text);
		})
		.catch(err => {
			console.log('Error:', err);
		});
}

module.exports = addPlausWanRoute;
