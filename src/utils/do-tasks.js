require('dotenv').config();
const childProcess = require('child_process');
const path = require('path');

const { getDrewsHelpfulRobot } = require('./slack');

const { sendMessageToCronLogs, sendBlockMessageToCronLogs } = getDrewsHelpfulRobot();

async function doTasks(tasks, cadence) {
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
	return sendMessageToCronLogs(
		someFailed
			? `❌: At least one ${cadence} Task failed! @drew 🧵`
			: `✅ ${cadence} Tasks completed successfully!`
	)
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
					text: { type: 'mrkdwn', text: `${logGroup.join('\n')} ` },
				});
				blocks.push({ type: 'divider' });
			});

			if (!blocks.length) {
				return true;
			}
			// Remove the trailing divider
			blocks.pop();

			return sendBlockMessageToCronLogs(blocks, { thread_ts: ts })
				.then(() => {
					console.log('Logs sent to Slack');
				})
				.catch((err) => {
					console.log('Failed to send logs to Slack:', err);
					console.log(JSON.stringify(blocks));
					return 1;
				});
		})
		.catch((err) => {
			console.log('Failed to send logs to Slack:', err);
			return 1;
		});
}

module.exports = doTasks;
