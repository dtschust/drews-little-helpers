const fs = require('fs');
const os = require('os');
const { mkdir } = require('fs/promises');
const path = require('path');
const { Readable } = require('stream');
const { finished } = require('stream/promises');
require('isomorphic-fetch');
require('dotenv').config();
const { parseString } = require('xml2js');

const key = process.env.UNOFFICIAL_RSS_KEY;
const directory = process.env.PODCAST_DOWNLOAD_DIR || path.resolve(os.homedir(), 'Desktop/tmp');

const feedUrls = [
	`https://v2.unofficialrss.com/feed/161410.xml?u=${key}`, // peecast blast
	`https://v2.unofficialrss.com/feed/1001557.xml?u=${key}`, // andy daly podcast pilot project
	`https://v2.unofficialrss.com/feed/474009.xml?u=${key}`, // gino
	`https://v2.unofficialrss.com/feed/1001514.xml?u=${key}`, // neighborhood listen
	`https://v2.unofficialrss.com/feed/1001575.xml?u=${key}`, // i was there too
	`https://v2.unofficialrss.com/feed/1001522.xml?u=${key}`, // big grande teacher's lounge
	`https://v2.unofficialrss.com/feed/1001823.xml?u=${key}`, // celebrity sighting
];

async function downloadFeed(feedUrl) {
	const feedId = feedUrl.match(/(\d+).xml/)[1];
	console.log(`Downloading "${feedId}"`);
	const rawResponse = await fetch(feedUrl);
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

	if (!fs.existsSync(path.resolve(directory, `feeds`))) {
		await mkdir(path.resolve(directory, `feeds`)); // Optional if you already have downloads directory
	}
	const feedDestination = path.resolve(directory, `feeds`, `${feedId}.xml`);
	const feedFileStream = fs.createWriteStream(feedDestination, { flags: 'wx' });
	await finished(Readable.fromWeb(rawResponse.body).pipe(feedFileStream));
	console.log(`Downloaded feed ${feedId}: "${title}"`);

	console.log(`Scraping "${title}"`);
	if (fs.existsSync(path.resolve(directory, `${feedId}`))) {
		console.log(`Skipping "${title}" because the directory already exists`);
	} else {
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
			} else {
				console.log(`Downloading "${episode.title}"`);
				if (!fs.existsSync(path.resolve(directory, `${feedId}`))) {
					await mkdir(path.resolve(directory, `${feedId}`)); // Optional if you already have downloads directory
				}
				const destination = path.resolve(directory, `${feedId}`, filename);
				const fileStream = fs.createWriteStream(destination, { flags: 'wx' });
				await finished(Readable.fromWeb(ep.body).pipe(fileStream));
				console.log(`Completed "${episode.title}"`);
			}
		}
	}
	console.log(`Done Scraping "${title}"`);
}

async function main() {
	if (!fs.existsSync(directory)) {
		await mkdir(directory);
	}
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
