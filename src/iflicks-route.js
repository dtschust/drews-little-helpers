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

function addIFlicksRoute(app) {
	app.post('/iflicks', (req, res) => {
		const reqBody = req.body;
		const responseURL = process.env.IFLICKS_WEBHOOK_URL;
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
