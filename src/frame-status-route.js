require('dotenv').config();
require('isomorphic-fetch');
const FrameStatus = require('./mongoose-models/Frame-Status');

function addFrameStatusRoute(app) {
	app.post('/frameStatus', async (req, res) => {
		const reqBody = req.body;
		const frameStatusModel = new FrameStatus({ ...reqBody, time: Date.now() });
		await FrameStatus.deleteMany();
		await frameStatusModel.save();
		res.status(200).end();
	});
}

module.exports = addFrameStatusRoute;
