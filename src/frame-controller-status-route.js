require('dotenv').config();
require('isomorphic-fetch');
const FrameControllerStatus = require('./mongoose-models/Frame-Controller-Status');

function addFrameControllerStatusRoute(app) {
	app.post('/frameControllerStatus', async (req, res) => {
		const reqBody = req.body;
		const frameControllerStatusModel = new FrameControllerStatus(reqBody);
		await FrameControllerStatus.deleteMany();
		await frameControllerStatusModel.save();
		res.status(200).end();
	});
}

module.exports = addFrameControllerStatusRoute;
