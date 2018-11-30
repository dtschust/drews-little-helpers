require('dotenv').config();

function addPlausWanRoute(app) {
	app.get('/plaus', (req, res) => {
		const reqBody = req.body || {};
		console.log(reqBody);
		const { type, challenge } = reqBody;
		if (type === 'url_verification') {
			res.json({ challenge });
		}
		res.status(200).end();
	});
}

module.exports = addPlausWanRoute;
