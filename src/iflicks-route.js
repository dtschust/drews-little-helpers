require('dotenv').config();

function sendMessageToSlackResponseURL(responseURL, JSONmessage) {
	return fetch(responseURL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(JSONmessage),
	});
}

function addIFlicksRoute(fastify) {
	fastify.post('/iflicks', (request, reply) => {
		const reqBody = request.body || {};
		const responseURL = process.env.IFLICKS_WEBHOOK_URL;
		if (reqBody.token !== process.env.PTP_SLACK_VERIFICATION_TOKEN) {
			console.log('Early return, access forbidden');
			reply.code(403).send('Access forbidden');
			return;
		}
		sendMessageToSlackResponseURL(responseURL, {
			text: `${reqBody.text} - converted and ready to watch`,
		});
		reply.code(200).send();
	});
}

module.exports = addIFlicksRoute;
