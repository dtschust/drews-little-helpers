import dotenv from 'dotenv';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { saveToDropboxByUrl } from './utils/ptp';

dotenv.config();

export interface ImdbData {
	/** IMDb ID of this film */
	id: number;

	/** English title of this film */
	englishtitle: string;

	/** Original title of this film */
	originaltitle: string;

	/** IMDb year of this film */
	year: number;

	/** Array of genres (e.g. ["Animation", "Drama"]) */
	genres: string[];

	/** IMDb rating of this film */
	rating: number; // float
}

export interface TvdbData {
	/** TVDB ID of this show */
	id: number;

	/**
	 * Season for this torrent.
	 * Specials are season 0.
	 */
	season: number;

	/**
	 * Episode for this torrent.
	 * Season packs are episode 0.
	 */
	episode: number;
}

interface HDBitsTorrentItem {
	/** Torrent ID */
	id: number;

	/** 40 character hex string representing the info hash */
	hash: string;

	/** Number of leechers on this torrent */
	leechers: number;

	/** Number of seeders on this torrent */
	seeders: number;

	/** Torrent name */
	name: string;

	/** Description in BBCode format */
	descr: string;

	/** Number of times completed */
	times_completed: number;

	/** Size of the files in the torrent in bytes */
	size: number;

	/** Unix timestamp of when the torrent was uploaded */
	utadded: number;

	/** Timestamp of when the torrent was uploaded */
	added: string; // ISO datetime string

	/** Number of comments on this torrent */
	comments: number;

	/** Number of files in this torrent */
	numfiles: number;

	/** Original filename of the torrent file */
	filename: string;

	/** "yes" or "no" */
	freeleech: 'yes' | 'no';

	/** Category ID */
	type_category: number;

	/** Codec ID */
	type_codec: number;

	/** Medium ID */
	type_medium: number;

	/** Origin ID */
	type_origin: number;

	/** Exclusivity ID */
	type_exclusive: number;

	/** User's torrent status */
	torrent_status: '' | 'seeding' | 'leeching' | 'completed';

	/** 1 or 0 */
	bookmarked: 0 | 1;

	/** 1 or 0 */
	wishlisted: 0 | 1;

	/** Array of tag names */
	tags: string[];

	/** IMDb data (only present if IMDb data exists) */
	imdb?: ImdbData;

	/** TVDB data (only present if TVDB data exists) */
	tvdb?: TvdbData;
}

interface HdBitsSearchResponse {
	status: number;
	data: HDBitsTorrentItem[];
}

function sanitizeQuery(query?: string) {
	return (query ?? '').replace(/’/g, "'");
}

async function search(query: string): Promise<HdBitsSearchResponse> {
	const sanitizedQuery = sanitizeQuery(query);
	return fetch(`https://hdbits.org/api/torrents`, {
		method: 'POST',
		body: JSON.stringify({
			username: process.env.HDBITS_USERNAME ?? '',
			passkey: process.env.HDBITS_PASSKEY ?? '',
			search: sanitizedQuery,
		}),
	}).then((resp) => resp.json() as Promise<HdBitsSearchResponse>);
}

type AuthedQuery = { token?: string };

type SearchQuery = AuthedQuery & {
	query?: string;
};

type DownloadMovieBody = AuthedQuery & {
	torrentId?: string | number;
	title?: string;
};

async function ensureAuthorized(token?: string, reply?: FastifyReply) {
	if ((token ?? '') !== process.env.CUSTOM_PTP_API_TOKEN) {
		reply?.code(403).send('Access forbidden');
		return false;
	}
	return true;
}

export default function addHdBitsRoute(fastify: FastifyInstance) {
	// TODO: top movies / top tv shows
	// TODO: filtering by tv show, series search, etc.
	// https://hdbits.org/wiki/API
	// GET /movies/search?q=...
	fastify.get(
		'/hdbits/search',
		async (request: FastifyRequest<{ Querystring: SearchQuery }>, reply: FastifyReply) => {
			const queryParams = request.query;
			if (!(await ensureAuthorized(queryParams.token, reply))) {
				return;
			}
			try {
				const query = queryParams.query || '';
				if (!query) {
					reply.code(400).send({ error: 'Missing query parameter `query`' });
					return;
				}
				const response = await search(query);
				reply.code(200).send(response);
			} catch (e) {
				console.error(e);
				reply.code(500).send({ error: 'Search failed' });
			}
		}
	);

	// POST /hdbits/download { torrentId, title }
	fastify.post(
		'/hdbits/download',
		async (request: FastifyRequest<{ Body: DownloadMovieBody }>, reply: FastifyReply) => {
			const body = request.body || {};
			if (!(await ensureAuthorized(body.token, reply))) {
				return;
			}
			try {
				const { torrentId, title } = body;
				if (!torrentId || !title) {
					reply.code(400).send({ error: 'Missing `torrentId` or `title` in body' });
					return;
				}

				// Kick off Dropbox save; respond immediately.
				saveToDropboxByUrl({
					title,
					url: `https://hdbits.org/download.php/${encodeURIComponent(
						title
					)}?id=${torrentId}&passkey=${process.env.HDBITS_PASSKEY}`,
				}).catch((e) => console.error('saveUrlToDropbox error', e));

				reply.code(200).send({ ok: true, started: true });
			} catch (e) {
				console.error(e);
				reply.code(500).send({ error: 'Failed to start download' });
			}
		}
	);
}
