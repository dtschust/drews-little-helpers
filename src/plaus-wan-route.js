require('dotenv').config();
require('isomorphic-fetch');

const { WebClient } = require('@slack/client');
const { approvals, flair, nits, comments, getRandomFrom } = require('./plaus-wan/responses');

const token = process.env.PLAUS_SLACK_BOT_USER_OAUTH_ACCESS_TOKEN || '';
const web = new WebClient(token);

let anujInterval;
let anujCount = 0;

function addPlausWanRoute(app) {
	app.post('/plaus', (req, res) => {
		const reqBody = req.body || {};
		const { type, challenge, event } = reqBody;
		if (type === 'url_verification') {
			res.json({ challenge });
		} else if (type === 'event_callback' && event.type === 'app_mention') {
			const { ts, text, channel, user } = event;
			if (user === process.env.ANUJ_ID) {
				anujInterval = setInterval(() => {
					if (anujCount === 99) {
						clearInterval(anujInterval);
						return;
					}
					anujCount += 1;
					sendMessage({
						text: '+1',
						channel,
						thread_ts: ts,
						reply_broadcast: true,
					});

				})
			} else {
				sendMessage({
					text: buildResponse(),
					channel,
					thread_ts: ts,
					reply_broadcast: true,
				});
			}
		}
		res.status(200).end();
	});
}

function buildResponse() {
	const approval = getRandomFrom(approvals);
	const nit = getRandomFrom(nits);
	const singularFlair = getRandomFrom(flair);
	const comment = getRandomFrom(comments);
	return `${comment} ${nit} ${singularFlair}${approval}`;

}

function sendMessage({ text, channel, thread_ts, reply_broadcast } = {}) {
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
