#!/usr/bin/env -S npx tsx

import dotenv from 'dotenv';
import { getDrewsHelpfulRobot } from '../src/utils/slack';

dotenv.config();

const { web, webRobot } = getDrewsHelpfulRobot();

async function main() {
	const dayMs = 86400000;
	const expirationDate = Date.now() - dayMs;

	// Use the search API so that threaded messages are included; conversations.history omits them.
	const response: any = await web.search.messages({
		query: `in:<#${process.env.CRON_LOGS_CHANNEL_ID}> from:<@${process.env.SLACK_ROBOT_USER_ID}>`,
		count: 100,
		sort: 'timestamp',
		sort_dir: 'desc',
	});

	const matches: any[] = response?.messages?.matches ?? [];
	let numDeleted = 0;

	await Promise.all(
		matches.map(async (message) => {
			if (!message) return true;
			if (message.text?.includes(':x:')) return true;

			const blocks: any[] = message.blocks ?? [];
			if (blocks.some((block) => block?.text?.text?.includes(':x:'))) {
				return true;
			}

			const ts = message.ts as string | undefined;
			if (!ts) return true;

			const time = Number.parseInt(ts.split('.')[0] ?? '0', 10) * 1000;
			if (Number.isNaN(time) || time >= expirationDate) {
				return true;
			}

			await webRobot.apiCall('chat.delete', {
				channel: process.env.CRON_LOGS_CHANNEL_ID,
				ts,
			});
			numDeleted += 1;
			return true;
		})
	);

	console.log(`Deleted ${numDeleted} messages`);
}

void main().then(() => process.exit());
