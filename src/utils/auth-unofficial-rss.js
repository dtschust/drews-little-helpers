require('isomorphic-fetch');
require('dotenv').config();
const puppeteer = require('puppeteer');

async function authUnofficialRSS() {
	const browser = await puppeteer.launch({
		headless: true,
		// devtools: true,
		args: ['--no-sandbox', '--disable-setuid-sandbox'],
	});
	const page = await browser.newPage();
	let attempts = 0;
	const goToPage = async () => {
		try {
			attempts += 1;
			await page.goto('https://v2.unofficialrss.com/');
		} catch (e) {
			if (attempts > 3) {
				throw new Error(`Gave up connecting after 4 or so tries ${e}`);
			}
			// try again
			return goToPage();
		}
	};

	console.log('Going to unofficial RSS page');
	await goToPage();

	await page.click('button');
	await page.waitForSelector('#signInFormUsername');

	console.log('Got to stitcher auth');
	await page.$eval(
		'#signInFormUsername',
		(el, username) => {
			// eslint-disable-next-line no-param-reassign
			el.value = username;
		},
		process.env.STITCHER_USERNAME
	);
	await page.$eval(
		'#signInFormPassword',
		(el, password) => {
			// eslint-disable-next-line no-param-reassign
			el.value = password;
		},
		process.env.STITCHER_PASSWORD
	);

	console.log('Submitting login...');
	await page.click("input[type='submit']");

	// back to unofficial RSS page
	await page.waitForSelector('.logo-container');
	await page.waitForSelector('.status');
	console.log('Back to unofficial RSS Page');
	const statusDiv = await page.$('.status');
	const statusText = await page.evaluate((el) => el.innerText, statusDiv);

	if (statusText.includes('STITCHER PREMIUM SUBSCRIBER')) {
		console.log('Successfully logged in to unofficial RSS feed');
		return;
	}
	console.error('Failed to log in to unofficial RSS feed, status =', statusText);
	return 1;
}

module.exports = authUnofficialRSS;