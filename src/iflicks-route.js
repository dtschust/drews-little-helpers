require('dotenv').config();
require('isomorphic-fetch');
const request = require('request');

function sendMessageToSlackResponseURL(responseURL, JSONmessage) {
	console.log('sending message', JSONmessage.text);
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
			console.log('error: ', error);
			// TODO: handle errors as you see fit
		} else {
			console.log('success!!');
		}
	});
}

function addIFlicksRoute(app) {
	app.post('/iflicks', (req, res) => {
		const reqBody = req.body;
		const responseURL = process.env.IFLICKS_WEBHOOK_URL;
		console.log('received:', reqBody.text);
		if (reqBody.token !== process.env.PTP_SLACK_VERIFICATION_TOKEN) {
			console.log('Early return, access forbidden');
			res.status(403).end('Access forbidden');
		} else {
			sendMessageToSlackResponseURL(responseURL, {
				text: `${reqBody.text} - converted and ready to watch`,
			});
			res.status(200).end();
		}
	});
}

module.exports = addIFlicksRoute;
