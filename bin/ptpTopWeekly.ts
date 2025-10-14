#!/usr/bin/env -S npx tsx

import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import TopMovies from '../src/mongoose-models/Top-Movies';
import PtpCookie from '../src/mongoose-models/Ptp-Cookie';
import '../src/utils/mongoose-connect';
import { getDrewsHelpfulRobot } from '../src/utils/slack';

dotenv.config();

const { sendMessageToFollowShowsAsMovies } = getDrewsHelpfulRobot();

const myArgs = process.argv.slice(2);
const isWeekly = myArgs[0] === 'week';

async function getPersistedLoginCookies(): Promise<string | null> {
	try {
		const record = await PtpCookie.findOne().exec();
		return record?.cookie ?? null;
	} catch {
		return null;
	}
}

async function getLoginCookies(): Promise<string | null> {
	return null;
	// const cookie = await getPtpLoginCookies();
	// return cookie;
}

type StoredCookie = {
	name: string;
	value: string;
	url: string;
};

type TitleInfo = {
	href: string;
	title: string;
	id: string;
	posterUrl?: string;
	year?: string;
};

async function main(usePersistedCookies = true): Promise<number> {
	const browser = await puppeteer.launch({
		headless: true,
		args: ['--no-sandbox', '--disable-setuid-sandbox'],
	});

	const page = await browser.newPage();

	try {
		await page.setUserAgent(
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36'
		);

		const rawCookies = usePersistedCookies
			? await getPersistedLoginCookies()
			: await getLoginCookies();

		if (!rawCookies && usePersistedCookies) {
			console.log('Persisted slack cookies not found. Falling back to signing in');
			return main(false);
		}

		if (!rawCookies) {
			console.log(
				'Persisted cookies failed and I have temporarily stopped trying to log in via script. Just gonna fail instead'
			);
			return 1;
		}

		const cookies: StoredCookie[] = rawCookies
			.split(';')
			.map((cookie) => `${cookie.trim()};`)
			.filter((cookie) => cookie.trim().length > 1)
			.map((cookie) => {
				const [name, value] = cookie.split(';')[0]?.split('=') ?? [];
				return { name, value, url: 'https://passthepopcorn.me' };
			})
			.filter((cookie) => Boolean(cookie.name));

		await Promise.all(cookies.map((cookie) => page.setCookie(cookie)));

		await page.goto('https://passthepopcorn.me/top10.php', { timeout: 120000 });
		const topMoviesHandle = await page.$('[data-coverviewindex="1"]');

		if (!topMoviesHandle && usePersistedCookies) {
			console.log('Persisted slack cookies were invalid. Falling back to signing in');
			return main(false);
		}

		const titles = await page.$$('[data-coverviewindex="1"] .cover-movie-list__movie__title');
		const titlesInfo: TitleInfo[] = await Promise.all(
			titles.map((handle) =>
				page.evaluate((el) => {
					const anchor = el as { href?: string; innerText?: string };
					const href = anchor.href ?? '';
					return {
						href,
						title: anchor.innerText ?? '',
						id: href.split('id=')[1] ?? '',
					};
				}, handle)
			)
		);

		if (!titles.length) {
			console.log('Cannot find any titles on this page, something is wrong');
			return 1;
		}

		const moviePosterElements = await page.$$(
			'[data-coverviewindex="1"] .cover-movie-list__movie__cover-link'
		);
		const moviePosters = await Promise.all(
			moviePosterElements.map((handle) =>
				page.evaluate((el) => {
					const element = el as { style?: { background?: string } };
					const background = element.style?.background ?? '';
					const match = background.match(/url\("(.*)"\)/);
					return match?.[1] ?? '';
				}, handle)
			)
		);

		moviePosters.forEach((url, index) => {
			if (titlesInfo[index]) {
				titlesInfo[index].posterUrl = url;
			}
		});

		const movieYearsElements = await page.$$(
			'[data-coverviewindex="1"] .cover-movie-list__movie__year'
		);
		const movieYears = await Promise.all(
			movieYearsElements.map((handle) =>
				page.evaluate((el) => {
					const element = el as { innerText?: string };
					return (element.innerText ?? '').replace(/[\[\]]/g, '');
				}, handle)
			)
		);

		movieYears.forEach((year, index) => {
			if (titlesInfo[index]) {
				titlesInfo[index].year = year;
			}
		});

		const topMoviesModel = new TopMovies({
			movies: titlesInfo,
		});
		await TopMovies.deleteMany({});
		await topMoviesModel.save();

		if (isWeekly) {
			await sendMessageToFollowShowsAsMovies(
				'*Top 10 Most Active Movies Uploaded in the Past Week*'
			);
			for (const titleInfo of titlesInfo) {
				const { title, id, posterUrl, year } = titleInfo;
			const attachment = {
				title,
				fallback: 'TODO',
				callback_id: title,
				image_url: posterUrl,
				actions: [
					{
						name: `searchMovie ${title}`,
						text: `Select ${title} (${year})`,
						type: 'button' as const,
						value: id,
					},
				],
			};
				await sendMessageToFollowShowsAsMovies(' ', {
					attachments: [attachment],
				});
			}
		}

		console.log('Success!');
		return 0;
	} finally {
		if (!page.isClosed()) {
			await page.close();
		}
		await browser.close();
	}
}

void main().then((code) => {
	process.exit(typeof code === 'number' ? code : 0);
});
