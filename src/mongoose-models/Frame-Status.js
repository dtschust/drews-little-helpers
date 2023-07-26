const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

const FrameStatus = mongoose.model('FrameStatus', {
	ip: String,
	network_status: String,
	time: Number,
	log: String,
	uptime: String,
	controller_ip: String,
	disk_space_remaining: String,
	disk_usage_percent: Number,
	num_photos: Number,
	last_photo_update: String,
});

module.exports = FrameStatus;
