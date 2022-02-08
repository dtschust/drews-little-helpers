const request = require('request');
const mongoose = require('mongoose');
const PtpCookie = require('../mongoose-models/Ptp-Cookie');

mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGO_DB_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});

function getPtpLoginCookies() {
	return new Promise((resolve, reject) => {
		request.post(
			'https://passthepopcorn.me/ajax.php?action=login',
			{
				form: {
					username: process.env.PTP_USERNAME,
					password: process.env.PTP_PASSWORD,
					passkey: process.env.PTP_PASSKEY,
					// WhatsYourSecret:
					// 	'Hacker! Do you really have nothing better do than this?',
					keeplogged: 1,
				},
			},
			(error, response) => {
				if (response.statusCode === 403) {
					console.log('Looks I got captcha-ed, giving up!');
					reject(new Error('Captcha-ed'));
				}

				const cookies = response.headers['set-cookie'];
				const persistedCookie = cookies.map((cookie) => cookie.split(';')[0]).join(';');
				const cookieToPersist = new PtpCookie({ cookie: persistedCookie });
				PtpCookie.deleteMany(undefined).then(() => {
					cookieToPersist.save().then(() => {
						resolve(persistedCookie);
						// resolve(cookies);
					});
				});
			}
		);
	});
}

module.exports = getPtpLoginCookies;
