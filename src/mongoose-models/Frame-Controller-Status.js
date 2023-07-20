const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

const FrameControllerStatus = mongoose.model('FrameControllerStatus', {
	ip: String,
	network_status: String,
	time: Number,
	log: String,
	uptime: Number,
});

module.exports = FrameControllerStatus;
