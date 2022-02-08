const mongoose = require('mongoose');

const PtpCookie = mongoose.model('Cookie', {
	cookie: String,
});

module.exports = PtpCookie;
