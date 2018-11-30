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
			const { ts, channel, user } = event;
			addReaction({ name: 'eyes', channel, timestamp: ts })
				.then(Promise.delay(2000))
				.then(() => (
					addReaction({ name: 'white_check_mark', channel, timestamp: ts })
				)).then(() => {
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
				});
		}
		res.status(200).end();
	});
}

function isInPercent(threshold) {
	const number = Math.floor(Math.random() * 100);
	return number <= threshold;
}

function buildResponse() {
	const approvalBefore = isInPercent(30);
	const approval = getRandomFrom(approvals);
	const comment = getRandomFrom(comments);
	let response = `${comment}`;

	if (isInPercent(40)) {
		const nit = getRandomFrom(nits);
		response = `${nit}\n${response}`;
	}
	if (approvalBefore) {
		response = `${approval} ${response}`
	} else {
		response += ` ${approval}`
	}

	if (isInPercent(50)) {
		const singularFlair = getRandomFrom(flair);
		response = `${singularFlair} ${response}`;
	}

	return response;

}

for (let i = 0; i < 20; i++) {
	console.log('===============');
	console.log(buildResponse());
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

function addReaction({ name, channel, timestamp } = {}) {
	return web.reactions
		.add({
			name,
			channel,
			timestamp,
		})
		.then(() => {
			console.log('reaction added: ', name);
		})
		.catch(err => {
			console.log('Error:', err);
		});
}

module.exports = addPlausWanRoute;
