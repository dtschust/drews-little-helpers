#!/usr/bin/env -S npx tsx

import { brighten } from './officeLight';

void brighten().then(() => {
	process.exit(0);
});
