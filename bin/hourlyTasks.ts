#!/usr/bin/env -S npx tsx

import doTasks from '../src/utils/do-tasks';

const tasks: string[] = [];

async function main() {
	await doTasks(tasks, 'Hourly');
}

void main().then(() => process.exit());
