require('dotenv').config();
require('isomorphic-fetch');

const { WebClient } = require('@slack/client');

const token = process.env.PLAUS_SLACK_BOT_USER_OAUTH_ACCESS_TOKEN || '';
const web = new WebClient(token);

let anujInterval;
let anujCount = 0;

function addPlausWanRoute(app) {
	app.post('/plaus', (req, res) => {
		console.log('got a post to plaus');
		const reqBody = req.body || {};
		const { type, challenge } = reqBody;
		if (type === 'url_verification') {
			res.json({ challenge });
		} else if (type === 'app_mention') {
			console.log('it is an app mention');
			const { event } = reqBody;
			const { ts, text, channel, user } = event;
			if (user === process.env.ANUJ_ID) {
				anujInterval = setInterval(() => {
					if (anujCount === 99) {
						clearInterval(anujInterval);
						return;
					}
					anujCount += 1;
					sendMessage({
						text: `testing: ${text}`,
						channel,
						// thread_ts: ts,
						// reply_broadcast: true,
					});

				})
			} else {
				sendMessage({
					text: `testing: ${text}`,
					channel,
					// thread_ts: ts,
					// reply_broadcast: true,
				});
			}
		}
		res.status(200).end();
	});
}

function sendMessage({ text, channel, thread_ts, reply_broadcast } = {}) {
	console.log('trying to send a message', text, channel, thread_ts, reply_broadcast);
	return web.chat
		.postMessage({
			channel,
			text,
			thread_ts,
			reply_broadcast,
		})
		.then(() => {
			console.log('Message sent: ', text);
		})
		.catch(err => {
			console.log('Error:', err);
		});
}

module.exports = addPlausWanRoute;
