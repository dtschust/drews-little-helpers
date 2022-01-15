require('dotenv').config();
require('isomorphic-fetch');

const { WebClient } = require('@slack/client');
const { approvals, flair, nits, comments, getRandomFrom } = require('./plaus-wan/responses');

const token = process.env.PLAUS_SLACK_BOT_USER_OAUTH_ACCESS_TOKEN || '';
const web = new WebClient(token);

let anujDelay = 1000;
let anujCount = 0;
let anujHasBeenPranked = false;

/*
let totalTime = 0;
for (let i = 0; i < 50; i += 1) {
	console.log(`waiting ${anujDelay / 1000} seconds`);
	totalTime += anujDelay;
	if (i % 5 === 0) {
		anujDelay *= 1.5;
	}
}
console.log('total delay: ', totalTime / 1000);
console.log('total delay (minutes): ', totalTime / (60 * 1000));
*/

function addPlausWanRoute(app) {
	app.post('/plaus', (req, res) => {
		const reqBody = req.body || {};
		const { type, challenge, event } = reqBody;
		if (type === 'url_verification') {
			res.json({ challenge });
		} else if (type === 'event_callback' && event.type === 'app_mention') {
			const { ts, channel, user } = event;
			addReaction({ name: 'eyes', channel, timestamp: ts })
				// Delay between 1 and 11 seconds
				.delay(1000 + Math.floor(Math.random() * 10) * 1000)
				.then(() => (
					addReaction({ name: 'white_check_mark', channel, timestamp: ts })
				)).delay(1000)
				.then(() => {
					if (user === process.env.ANUJ_ID && !anujHasBeenPranked) {
						anujHasBeenPranked = true;
						const tick = () => {
							if (anujCount === 51) {
								anujCount += 1;
								// One last +1 in 2 hours just for fun.
								setTimeout(tick, 2 * 60 * 60 * 1000);
								return;
							}
							anujCount += 1;
							const text = anujCount === 1 ? `Oh, it's you. +1...` : '+1';
							sendMessage({
								text,
								channel,
								thread_ts: ts,
							});
							if (anujCount > 51) {
								return;
							}
							if (anujCount % 5 === 0) {
								anujDelay *= 1.5;
							}
							// delay 10 seconds the first time, then go wild
							setTimeout(tick, anujCount === 1 ? 10000 : anujDelay);
						}

						setTimeout(tick, anujDelay)
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

// eslint-disable-next-line camelcase
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
