const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

const PtpCookie = mongoose.model('Cookie', {
	cookie: String,
});

module.exports = PtpCookie;
