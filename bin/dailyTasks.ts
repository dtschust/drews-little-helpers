#!/usr/bin/env -S npx tsx

import doTasks from '../src/utils/do-tasks';

const tasks = ['checkUpdatesForGaryKamiya', 'ptpTopWeeklySanityCheck'];
const weeklyTasks: string[] = [];

async function main() {
	await doTasks(tasks, 'Daily');
	// 2 = Tuesday, but this script runs at midnight UTC 4PM PST so it'll be Monday in California
	if (new Date().getDay() === 2) {
		console.log('Also running weekly tasks!');
		await doTasks(weeklyTasks, 'Weekly');
	}
}

void main().then(() => process.exit());
