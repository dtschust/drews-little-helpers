import dotenv from 'dotenv';
import FormData from 'form-data';
import './mongoose-connect';
import PtpCookie from '../mongoose-models/Ptp-Cookie';

dotenv.config();

export default async function getPtpLoginCookies() {
	const formData = new FormData();
	formData.append('username', process.env.PTP_USERNAME ?? '');
	formData.append('password', process.env.PTP_PASSWORD ?? '');
	formData.append('passkey', process.env.PTP_PASSKEY ?? '');
	// formData.append('WhatsYourSecret', 'Hacker! Do you really have nothing better do than this?');
	formData.append('keeplogged', 1);

	const response = await fetch('https://passthepopcorn.me/ajax.php?action=login', {
		method: 'POST',
		body: formData as any,
	});

	if (response.status === 403) {
		console.log('Looks I got captcha-ed, giving up!');
		return new Error('Captcha-ed');
	}

	const cookies = response.headers.get('set-cookie');
	if (!cookies) {
		throw new Error('No session cookie received from PTP');
	}
	// The goal:
	// PHPSESSID=asdfasdf;session=asdfasdf
	const persistedCookie = cookies
		.split(' path=/; secure; HttpOnly, ')
		.map((c) => c.split(';')[0] ?? '')
		.join(';');

	const cookieToPersist = new PtpCookie({ cookie: persistedCookie });
	await PtpCookie.deleteMany(undefined);
	await cookieToPersist.save();
	return persistedCookie;
}
