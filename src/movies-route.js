require('dotenv').config();
require('./utils/mongoose-connect');

const TopMovies = require('./mongoose-models/Top-Movies');

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

	const movies = apiResponse.Movies || [];
	movies.forEach((movie) => {
		GroupIdMap[movie.GroupId] = movie;
	});

	return movies;
}

function getSortedTorrentsForGroup(groupId) {
	const movie = GroupIdMap[groupId];
	if (!movie || !movie.Torrents) return null;
	// Match slack sorting and slicing
	return movie.Torrents.slice(0).sort(sortTorrents);
}

function addMoviesRoute(fastify) {
	// GET /movies/topMovies
	fastify.get('/movies/topMovies', async (request, reply) => {
		const query = request.query || {};
		// Auth check
		if ((query.token || '') !== process.env.CUSTOM_PTP_API_TOKEN) {
			reply.code(403).send('Access forbidden');
			return;
		}
		try {
			const doc = await TopMovies.findOne(undefined);
			const movies = doc && Array.isArray(doc.movies) ? doc.movies : [];
			// Return same structure as /movies/search
			const result = movies.map(({ title, id, posterUrl, year }) => ({
				title,
				id,
				posterUrl,
				year,
			}));
			reply.code(200).send({ movies: result });
		} catch (e) {
			console.error(e);
			reply.code(500).send({ error: 'Failed to get top movies' });
		}
	});
	// GET /movies/search?q=...
	fastify.get('/movies/search', async (request, reply) => {
		const queryParams = request.query || {};
		// Auth check
		if ((queryParams.token || '') !== process.env.CUSTOM_PTP_API_TOKEN) {
			reply.code(403).send('Access forbidden');
			return;
		}
		try {
			const query = queryParams.q || queryParams.query || '';
			if (!query) {
				reply.code(400).send({ error: 'Missing query parameter `q`' });
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
			reply.code(200).send({ movies: result });
		} catch (e) {
			console.error(e);
			reply.code(500).send({ error: 'Search failed' });
		}
	});

	// GET /movies/getVersions?id=...
	fastify.get('/movies/getVersions', async (request, reply) => {
		const queryParams = request.query || {};
		// Auth check
		if ((queryParams.token || '') !== process.env.CUSTOM_PTP_API_TOKEN) {
			reply.code(403).send('Access forbidden');
			return;
		}
		try {
			const { id } = queryParams;
			if (!id) {
				reply.code(400).send({ error: 'Missing query parameter `id`' });
				return;
			}
			let torrents = getSortedTorrentsForGroup(id);
			if (!torrents && queryParams.title) {
				const fallbackQuery = queryParams.title;
				try {
					await searchAndCache({ query: fallbackQuery });
				} catch (e) {
					console.warn('Failed to refresh movie cache for getVersions', e);
					reply.code(404).send({
						error: `Failed to refresh movie cache for getVersions ${e}`,
					});
					return;
				}
				torrents = getSortedTorrentsForGroup(id);
			}
			const versions = (torrents || []).map((t) => ({
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
			reply.code(200).send({ versions });
		} catch (e) {
			console.error(e);
			reply.code(500).send({ error: 'Failed to get versions' });
		}
	});

	// POST /movies/downloadMovie { torrentId, movieTitle }
	fastify.post('/movies/downloadMovie', async (request, reply) => {
		const body = request.body || {};
		// Auth check
		if ((body.token || '') !== process.env.CUSTOM_PTP_API_TOKEN) {
			reply.code(403).send('Access forbidden');
			return;
		}
		try {
			const { torrentId, movieTitle } = body;
			if (!torrentId || !movieTitle) {
				reply.code(400).send({ error: 'Missing `torrentId` or `movieTitle` in body' });
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

			const provideFeedback = (message = {}) => {
				// For REST, just log progress messages.
				if (message && message.text) {
					console.log('[movies/downloadMovie]', message.text);
				}
				return Promise.resolve();
			};

			// Kick off Dropbox save; respond immediately.
			saveUrlToDropbox({
				torrentId,
				movieTitle,
				provideFeedback,
				authKey,
				passKey,
			}).catch((e) => console.error('saveUrlToDropbox error', e));

			reply.code(200).send({ ok: true, started: true });
		} catch (e) {
			console.error(e);
			reply.code(500).send({ error: 'Failed to start download' });
		}
	});
}

module.exports = addMoviesRoute;
