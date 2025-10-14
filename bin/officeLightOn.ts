#!/usr/bin/env -S npx tsx

import { toggleLight } from './officeLight';

void toggleLight(true).then(() => {
	process.exit(0);
});
