require('dotenv').config();
require('isomorphic-fetch');

const { sortTorrents, saveUrlToDropbox } = require('./utils/ptp');

let authKey;
let passKey;
let GroupIdMap = {};

// Wipe the map once an hour
setInterval(() => {
	GroupIdMap = {};
}, 60 * 1000 * 1000);

function search(query) {
	const sanitizedQuery = (query || '').replace(/’/g, "'");
	return fetch(
		`https://passthepopcorn.me/torrents.php?json=noredirect&order_by=relevance&searchstr=${sanitizedQuery}`,
		{
			headers: {
				ApiUser: process.env.PTP_API_USER,
				ApiKey: process.env.PTP_API_KEY,
			},
		}
	).then((resp) => resp.json());
}

async function searchAndCache({ query } = {}) {
	const apiResponse = await search(query);

	authKey = apiResponse.AuthKey;
	passKey = apiResponse.PassKey;

	const movies = (apiResponse.Movies || []).slice(0, 5);
	movies.forEach((movie) => {
		GroupIdMap[movie.GroupId] = movie;
	});

	return movies;
}

function getSortedTorrentsForGroup(groupId) {
	const movie = GroupIdMap[groupId];
	if (!movie || !movie.Torrents) return null;
	// Match slack sorting and slicing
	return movie.Torrents.slice(0).sort(sortTorrents).slice(0, 12);
}

function addMoviesRoute(app) {
	// GET /movies/search?q=...
	app.get('/movies/search', async (req, res) => {
    // Auth check
    if ((req.query.token || '') !== process.env.CUSTOM_PTP_API_TOKEN) {
      res.status(403).end('Access forbidden');
      return;
    }
    try {
      const query = req.query.q || req.query.query || '';
			if (!query) {
				res.status(400).json({ error: 'Missing query parameter `q`' }).end();
				return;
			}
			const movies = await searchAndCache({ query });
			// Return a compact list similar to the Slack UI usage
			const result = movies.map((m) => ({
				title: m.Title,
				id: m.GroupId,
				posterUrl: m.Cover,
				year: m.Year,
			}));
			res.status(200).json({ movies: result }).end();
		} catch (e) {
			console.error(e);
			res.status(500).json({ error: 'Search failed' }).end();
		}
	});

	// GET /movies/getVersions?id=...
	app.get('/movies/getVersions', async (req, res) => {
    // Auth check
    if ((req.query.token || '') !== process.env.CUSTOM_PTP_API_TOKEN) {
      res.status(403).end('Access forbidden');
      return;
    }
    try {
      const { id } = req.query;
			if (!id) {
				res.status(400).json({ error: 'Missing query parameter `id`' }).end();
				return;
			}
			const torrents = getSortedTorrentsForGroup(id);
			if (!torrents) {
				res.status(404)
					.json({
						error: 'Movie not found in cache. Please call /movies/search first and use a returned id.',
					})
					.end();
				return;
			}
			const versions = torrents.map((t) => ({
				id: t.Id,
				goldenPopcorn: !!t.GoldenPopcorn,
				checked: !!t.Checked,
				quality: t.Quality,
				codec: t.Codec,
				container: t.Container,
				source: t.Source,
				resolution: t.Resolution,
				scene: !!t.Scene,
				remasterTitle: t.RemasterTitle || null,
				seeders: t.Seeders,
				snatched: t.Snatched,
				sizeGB: t.Size / 1073741824,
			}));
			res.status(200).json({ versions }).end();
		} catch (e) {
			console.error(e);
			res.status(500).json({ error: 'Failed to get versions' }).end();
		}
	});

	// POST /movies/downloadMovie { torrentId, movieTitle }
	app.post('/movies/downloadMovie', async (req, res) => {
    // Auth check
    if ((req.body && req.body.token) !== process.env.CUSTOM_PTP_API_TOKEN) {
      res.status(403).end('Access forbidden');
      return;
    }
    try {
      const { torrentId, movieTitle } = req.body || {};
			if (!torrentId || !movieTitle) {
				res.status(400)
					.json({ error: 'Missing `torrentId` or `movieTitle` in body' })
					.end();
				return;
			}

			// Ensure authKey/passKey are available. If not, perform a quick search to populate.
			if (!authKey || !passKey) {
				try {
					await searchAndCache({ query: movieTitle });
				} catch (e) {
					// continue; saveUrlToDropbox will fail gracefully if keys are wrong
					console.warn('Failed to prefetch auth keys, proceeding anyway');
				}
			}

			function provideFeedback(message) {
				// For REST, just log progress messages.
				if (message && message.text) {
					console.log('[movies/downloadMovie]', message.text);
				}
				return Promise.resolve();
			}

			// Kick off Dropbox save; respond immediately.
			saveUrlToDropbox({
				torrentId,
				movieTitle,
				provideFeedback,
				authKey,
				passKey,
			}).catch((e) => console.error('saveUrlToDropbox error', e));

			res.status(200).json({ ok: true, started: true }).end();
		} catch (e) {
			console.error(e);
			res.status(500).json({ error: 'Failed to start download' }).end();
		}
	});
}

module.exports = addMoviesRoute;
