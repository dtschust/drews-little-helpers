#!/usr/bin/env -S npx tsx

import { darken } from './officeLight';

void darken().then(() => {
	process.exit(0);
});
