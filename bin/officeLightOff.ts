#!/usr/bin/env -S npx tsx

import { toggleLight } from './officeLight';

void toggleLight(false).then(() => {
	process.exit(0);
});
