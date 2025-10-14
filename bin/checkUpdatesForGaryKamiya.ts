#!/usr/bin/env -S npx tsx

import dotenv from 'dotenv';
import Diff from 'diff';
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import { getMongoose } from '../src/utils/mongoose-connect';
import { getDrewsHelpfulRobot } from '../src/utils/slack';

dotenv.config();

const mongooseConnection = getMongoose();
const { sendMessageToFollowShows } = getDrewsHelpfulRobot();

const GaryPageContentSchema = new mongoose.Schema({
	pageContent: { type: String, default: '' },
});

const GaryPageContent = mongooseConnection.model('GaryPageContent', GaryPageContentSchema);

async function loadPreviousPageContent(): Promise<string> {
	try {
		const existing = await GaryPageContent.findOne(undefined).exec();
		return existing?.get('pageContent') ?? '';
	} catch {
		return '';
	}
}

async function checkForUpdates(oldPageContent: string) {
	const browser = await puppeteer.launch({
		headless: true,
		args: ['--no-sandbox', '--disable-setuid-sandbox'],
	});

	try {
		const page = await browser.newPage();

		let attempts = 0;
		const goToPage = async (): Promise<void> => {
			try {
				attempts += 1;
				await page.goto('https://www.garykamiya.com/');
			} catch (error) {
				if (attempts > 3) {
					throw new Error(`Gave up connecting after 4 or so tries ${error}`);
				}
				await goToPage();
			}
		};

		await goToPage();

	const contentText = await page.$eval<string>('#content', (el) => {
		return (el as { innerText?: string }).innerText ?? '';
	});

		if (contentText === oldPageContent) {
			console.log('No Updates!');
			return;
		}

		console.log('New updates!');

		const diff = Diff.diffWordsWithSpace(oldPageContent, contentText);
		const output = diff
			.map((part) => {
				if (part.added) return `🟩${part.value}🟩`;
				if (part.removed) return `🟥${part.value}🟥`;
				return part.value;
			})
			.join('');

		await sendMessageToFollowShows(`New updates from Gary Kamiya at https://www.garykamiya.com!
${output}`);

		await GaryPageContent.deleteMany(undefined);
		await new GaryPageContent({ pageContent: contentText }).save();
		console.log('New page content saved to database');
	} finally {
		await browser.close();
	}
}

async function main(): Promise<void> {
	const previousContent = await loadPreviousPageContent();
	await checkForUpdates(previousContent);
}

void main().then(() => process.exit());
