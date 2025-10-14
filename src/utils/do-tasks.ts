import dotenv from 'dotenv';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ChatPostMessageArguments } from '@slack/web-api';
import { getDrewsHelpfulRobot } from './slack';

dotenv.config();

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const { sendMessageToCronLogs, sendBlockMessageToCronLogs } = getDrewsHelpfulRobot();

function resolveTaskPath(task: string) {
	const bases = [
		path.resolve(__dirname, '../../bin', task),
		path.resolve(__dirname, '../../../bin', task),
		path.resolve(process.cwd(), 'bin', task),
	];

	for (const base of bases) {
		const candidates = ['', '.ts', '.js'].map((extension) => `${base}${extension}`);
		const match = candidates.find((candidatePath) => fs.existsSync(candidatePath));
		if (match) {
			return match;
		}
	}

	return `${bases[0]}.ts`;
}

async function doTasks(tasks: string[], cadence: string) {
	let someFailed = false;
	const logs: string[][] = [[]];

	function log(message: string) {
		const currentLogGroup = logs[logs.length - 1] ?? [];
		console.log(message);
		currentLogGroup.push(message);
	}

	function newLogGroup() {
		logs.push([]);
	}

	if (!tasks.length) return true;
	tasks.forEach((inputTask) => {
		const [task, ...args] = inputTask.split(' ');
		log(task);
		const scriptPath = resolveTaskPath(task);
		const { status, stderr, stdout } = spawnSync(scriptPath, args, {
			stdio: 'pipe',
		});

		if (typeof status === 'number' && status !== 0) {
			someFailed = true;
			log(`Error executing \`${task}\`! Error: ${status}`);
		}
		if (stderr && stderr.length) {
			someFailed = true;
			log(`Error Output:
\`\`\`
${stderr.toString().trim()}
\`\`\`
`);
		}
		if (stdout && stdout.length) {
			log(`\`\`\`
${stdout.toString().trim()}
\`\`\`
`);
		}
		const hadError = (typeof status === 'number' && status !== 0) || (stderr && stderr.length);
		log(hadError ? '❌' : '✅');
		newLogGroup();
	});
	try {
		const response: any = await sendMessageToCronLogs(
			someFailed
				? `❌: At least one ${cadence} Task failed! @drew 🧵`
				: `✅ ${cadence} Tasks completed successfully!`
		);
		const ts = response.ts as string | undefined;
		if (!ts) {
			return true;
		}
		const blocks: Array<Record<string, unknown>> = [];
		logs.forEach((logGroup) => {
			if (!logGroup.length) return;
			const title = logGroup.shift() ?? '';
			const result = logGroup.pop() ?? '';
			blocks.push({
				type: 'header',
				text: { type: 'plain_text', text: `${result} ${title}`, emoji: true },
			});
			blocks.push({
				type: 'section',
				text: { type: 'mrkdwn', text: `${logGroup.join('\n')} ` },
			});
			blocks.push({ type: 'divider' });
		});

		if (!blocks.length) {
			return true;
		}
		// Remove the trailing divider
		blocks.pop();

		try {
			await sendBlockMessageToCronLogs(
				blocks as unknown as ChatPostMessageArguments['blocks'],
				{ thread_ts: ts }
			);
			console.log('Logs sent to Slack');
			return true;
		} catch (err) {
			console.log('Failed to send logs to Slack:', err);
			console.log(JSON.stringify(blocks));
			return 1;
		}
	} catch (err) {
		console.log('Failed to send logs to Slack:', err);
		return 1;
	}
}

export default doTasks;
