require('dotenv').config();
require('isomorphic-fetch');
const request = require('request');

function sendMessageToSlackResponseURL(responseURL, JSONmessage) {
	const postOptions = {
		uri: responseURL,
		method: 'POST',
		headers: {
			'Content-type': 'application/json',
		},
		json: JSONmessage,
	};
	request(postOptions, (error /* response, body */) => {
		if (error) {
			// TODO: handle errors as you see fit
		}
	});
}

function addIFlicksRoute(app) {
	app.post('/iflicks', (req, res) => {
		res.status(200).end();
		const reqBody = req.body;
		const responseURL = process.env.IFLICKS_WEBHOOK_URL;
		if (reqBody.token !== process.env.PTP_SLACK_VERIFICATION_TOKEN) {
			res.status(403).end('Access forbidden');
		} else {
			sendMessageToSlackResponseURL(responseURL, {
				text: `${reqBody.text} - converted and ready to watch`,
			});
		}
	});
}

module.exports = addIFlicksRoute;
