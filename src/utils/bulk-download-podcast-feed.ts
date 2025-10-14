import fs from 'fs';
import os from 'os';
import { mkdir } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import dotenv from 'dotenv';
import { parseString } from 'xml2js';

dotenv.config();

// const key = process.env.UNOFFICIAL_RSS_KEY;
const directory = process.env.PODCAST_DOWNLOAD_DIR || path.resolve(os.homedir(), 'Desktop/tmp');

const feedUrls = [
	// `https://v2.unofficialrss.com/feed/161410.xml?u=${key}`, // peecast blast
	// `https://v2.unofficialrss.com/feed/1001557.xml?u=${key}`, // andy daly podcast pilot project
	// `https://v2.unofficialrss.com/feed/474009.xml?u=${key}`, // gino
	// `https://v2.unofficialrss.com/feed/1001514.xml?u=${key}`, // neighborhood listen
	// `https://v2.unofficialrss.com/feed/1001575.xml?u=${key}`, // i was there too
	// `https://v2.unofficialrss.com/feed/1001522.xml?u=${key}`, // big grande teacher's lounge
	// `https://v2.unofficialrss.com/feed/1001823.xml?u=${key}`, // celebrity sighting
];

async function downloadFeed(feedUrl: string) {
	const feedIdMatch = feedUrl.match(/(\d+).xml/);
	if (!feedIdMatch) {
		throw new Error(`Unable to determine feed id from url ${feedUrl}`);
	}
	const feedId = feedIdMatch[1];
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
	const parsedResult = await new Promise<any>((resolve, reject) => {
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
	if (fs.existsSync(feedDestination)) {
		console.log(`Skipping "${title}" because the directory already exists`);
	} else {
		const feedFileStream = fs.createWriteStream(feedDestination, { flags: 'wx' });
		if (!rawResponse.body) {
			throw new Error('Feed response missing body');
		}
		await finished(Readable.fromWeb(rawResponse.body as any).pipe(feedFileStream));
		console.log(`Downloaded feed ${feedId}: "${title}"`);

		console.log(`Scraping "${title}"`);
		const episodes = parsedResult?.rss?.channel?.[0]?.item ?? [];
		for (const episode of episodes) {
			console.log(episode.title);
			const url = episode?.enclosure?.[0]?.$?.url;
			if (!url) {
				console.warn('Skipping episode without enclosure url');
				continue;
			}
			const filenameMatch = url.match(/\d*.mp3/);
			if (!filenameMatch) {
				console.warn('Skipping episode with unexpected filename format', url);
				continue;
			}
			const filename = filenameMatch[0];
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
				if (!ep.body) {
					throw new Error(`Episode ${url} missing body`);
				}
				await finished(Readable.fromWeb(ep.body as any).pipe(fileStream));
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

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('Bulk download failed', error);
		process.exit(1);
	});
