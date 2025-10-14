const path = require('path');

function loadDist(relPath) {
	const fullPath = path.resolve(__dirname, '..', 'dist', relPath);
	try {
		// eslint-disable-next-line import/no-dynamic-require, global-require
		const loaded = require(fullPath);
		return loaded && loaded.default ? loaded.default : loaded;
	} catch (error) {
		console.error(`Failed to load compiled module at ${fullPath}. Did you run "npm run build"?`);
		process.exit(1);
	}
}

module.exports = loadDist;
