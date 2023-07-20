const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

const FrameStatus = mongoose.model('FrameStatus', {
	ip: String,
	network_status: String,
	time: Number,
	log: String,
	uptime: Number,
	controller_ip: String,
	disk_space_remaining: Number,
	disk_usage_percent: Number,
	num_photos: Number,
	last_photo_update: Number,
});

module.exports = FrameStatus;
