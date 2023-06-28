const fs = require('fs');
const { mkdir } = require('fs/promises');
const path = require('path');
const { Readable } = require('stream');
const { finished } = require('stream/promises');
require('isomorphic-fetch');
require('dotenv').config();
const { parseString } = require('xml2js');

const key = process.env.UNOFFICIAL_RSS_KEY;

const feedUrls = [
	`https://v2.unofficialrss.com/feed/474009.xml?u=${key}`, // gino
	`https://v2.unofficialrss.com/feed/1001514.xml?u=${key}`, // neighborhood listen
	`https://v2.unofficialrss.com/feed/1001575.xml?u=${key}`, // i was there too
	`https://v2.unofficialrss.com/feed/1001522.xml?u=${key}`, // big grande teacher's lounge
];

async function downloadFeed(feedUrl) {
	const response = await fetch(feedUrl);
	const { status } = response;
	const text = await response.text();
	if (status !== 200) {
		console.error('Error fetching feed: status = ', status);
		console.error('response = ', text);
		return 1;
	}

	const parsedResult = await new Promise((resolve, reject) => {
		parseString(text, (err, result) => {
			if (err) {
				reject(err);
			}
			resolve(result);
		});
	});
	const title = parsedResult?.rss?.channel?.[0]?.title?.[0];
	console.log(`Scraping "${title}"`);
	const episodes = parsedResult?.rss?.channel?.[0]?.item;
	for await (const episode of episodes) {
		console.log(episode.title);
		const url = episode?.enclosure?.[0]?.$?.url;
		const filename = url.match(/\d*.mp3/)[0];
		console.log(url, filename);
		const ep = await fetch(url);
		const { status: epStatus } = ep;
		if (epStatus !== 200) {
			console.error('Error fetching feed: status = ', epStatus, url);
			return false;
		}
		console.log(`Downloading "${episode.title}"`);
		if (!fs.existsSync('downloads')) await mkdir('downloads'); // Optional if you already have downloads directory
		if (!fs.existsSync(`downloads/${title}`)) await mkdir(`downloads/${title}`); // Optional if you already have downloads directory
		const destination = path.resolve(`./downloads/${title}`, filename);
		const fileStream = fs.createWriteStream(destination, { flags: 'wx' });
		await finished(Readable.fromWeb(ep.body).pipe(fileStream));
		console.log(`Completed "${episode.title}"`);
	}
	console.log(`Done Scraping "${title}"`);
}

async function main() {
	for await (const feedUrl of feedUrls) {
		let result;
		try {
			result = await downloadFeed(feedUrl);
		} catch (e) {
			result = 1;
			console.error(e);
		}
		if (result) {
			console.log('failed', result);
		}
	}
}

main().then(process.exit);
