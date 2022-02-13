require('dotenv').config();
require('isomorphic-fetch');
const FormData = require('form-data');
require('./mongoose-connect');

const PtpCookie = require('../mongoose-models/Ptp-Cookie');

function getPtpLoginCookies() {
	const formData = new FormData();
	formData.append('username', process.env.PTP_USERNAME);
	formData.append('password', process.env.PTP_PASSWORD);
	formData.append('passkey', process.env.PTP_PASSKEY);
	// formData.append('WhatsYourSecret', 'Hacker! Do you really have nothing better do than this?');
	formData.append('keeplogged', 1);

	return fetch('https://passthepopcorn.me/ajax.php?action=login', {
		method: 'POST',
		body: formData,
	}).then(async (resp) => {
		const { status } = resp;
		if (status === 403) {
			console.log('Looks I got captcha-ed, giving up!');
			return new Error('Captcha-ed');
		}

		const cookies = resp.headers.get('set-cookie');
		// The goal:
		// PHPSESSID=asdfasdf;session=asdfasdf
		const persistedCookie = cookies
			.split(' path=/; secure; HttpOnly, ')
			.map((c) => c.split(';')[0])
			.join(';');

		const cookieToPersist = new PtpCookie({ cookie: persistedCookie });
		await PtpCookie.deleteMany(undefined);
		await cookieToPersist.save();
		return persistedCookie;
	});
}

module.exports = getPtpLoginCookies;
