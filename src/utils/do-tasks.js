require('dotenv').config();
const childProcess = require('child_process');
const path = require('path');
const { WebClient } = require('@slack/client');

const token = process.env.SLACK_API_TOKEN || '';
const web = new WebClient(token);

let someFailed = false;

const logs = [[]];

function log(message) {
	const currentLogGroup = logs[logs.length - 1];
	console.log(message);
	currentLogGroup.push(message);
}

function newLogGroup() {
	logs.push([]);
}

async function doTasks(tasks, cadence) {
	if (!tasks.length) return true;
	tasks.forEach((inputTask) => {
		const [task, ...args] = inputTask.split(' ');
		log(task);
		const { status, stderr, stdout } = childProcess.spawnSync(
			path.resolve(__dirname, `../../bin/${task}`),
			args
		);

		if (status) {
			someFailed = true;
			log(`Error executing \`${task}\`! Error: ${status}`);
		}
		if (stderr.length) {
			someFailed = true;
			log(`Error Output:
\`\`\`
${stderr.toString().trim()}
\`\`\`
`);
		}
		if (stdout.length) {
			log(`\`\`\`
${stdout.toString().trim()}
\`\`\`
`);
		}
		log(`${status || stderr.length ? '❌' : '✅'}`);
		newLogGroup();
	});

	return web.chat
		.postMessage({
			channel: process.env.CRON_LOGS_CHANNEL_ID,
			text: someFailed
				? `❌: At least one ${cadence} Task failed! @drew 🧵`
				: `✅ ${cadence} Tasks completed successfully!`,
			link_names: true,
		})
		.then(({ ts }) => {
			const blocks = [];
			logs.forEach((logGroup) => {
				if (!logGroup.length) return;
				const title = logGroup.shift();
				const result = logGroup.pop();
				blocks.push({
					type: 'header',
					text: { type: 'plain_text', text: `${result} ${title}`, emoji: true },
				});
				blocks.push({
					type: 'section',
					text: { type: 'mrkdwn', text: logGroup.join('\n') },
				});
				blocks.push({ type: 'divider' });
			});

			if (!blocks.length) {
				return true;
			}
			// Remove the trailing divider
			blocks.pop();

			return web.chat
				.postMessage({
					channel: process.env.CRON_LOGS_CHANNEL_ID,
					blocks,
					thread_ts: ts,
					// link_names: true,
				})
				.then(() => {
					console.log('Logs sent to Slack');
					process.exit(0);
				})
				.catch((err) => {
					console.log('Failed to send logs to Slack:', err);
					process.exit(1);
				});
		})
		.catch((err) => {
			console.log('Failed to send logs to Slack:', err);
			process.exit(1);
		});
}

module.exports = doTasks;
