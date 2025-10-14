#!/usr/bin/env -S npx tsx

import dotenv from 'dotenv';
import TopMovies from '../src/mongoose-models/Top-Movies';
import '../src/utils/mongoose-connect';

dotenv.config();

async function main(): Promise<number> {
	const model = await TopMovies.findOne(undefined).exec();

	if (!model) {
		console.log('Top Movies script has not saved any data yet.');
		return 1;
	}

	const createdAt = model.get('createdAt') as Date | undefined;
	const createdAtDate = createdAt ? new Date(createdAt) : null;

	if (!createdAtDate || Number.isNaN(createdAtDate.getTime())) {
		console.log('Top Movies record has an invalid createdAt value.');
		return 1;
	}

	if (Date.now() - createdAtDate.getTime() > 1000 * 60 * 60 * 24) {
		console.log(`Top Movies script hasn't updated in over 24 hours!`);
		return 1;
	}

	console.log('Top Movies last updated at ', createdAtDate, ' (UTC)');

	return 0;
}

void main().then((code) => {
	process.exit(typeof code === 'number' ? code : 0);
});
