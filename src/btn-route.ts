import dotenv from 'dotenv';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { saveToDropboxByUrl } from './utils/ptp';

dotenv.config();

type AuthedQuery = { token?: string };

type SearchQuery = AuthedQuery & {
	query?: string;
};

type DownloadBody = AuthedQuery & {
	downloadUrl?: string;
	title?: string;
};

const BTN_SEARCH_URL = 'https://api.broadcasthe.net/';

function sanitizeQuery(query?: string) {
	return (query ?? '').replace(/’/g, "'");
}

async function ensureAuthorized(token?: string, reply?: FastifyReply) {
	if ((token ?? '') !== process.env.CUSTOM_PTP_API_TOKEN) {
		reply?.code(403).send('Access forbidden');
		return false;
	}
	return true;
}

async function searchBtn(query: string) {
	const apiKey = process.env.BTN_API_KEY ?? '';
	if (!apiKey) {
		throw new Error('BTN_API_KEY not configured');
	}
	return fetch(BTN_SEARCH_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			method: 'getTorrentsSearch',
			params: [apiKey, sanitizeQuery(query), 30],
			id: 1,
		}),
	}).then((resp) => resp.json());
}

export default function addBtnRoute(fastify: FastifyInstance) {
	fastify.get(
		'/btn/search',
		async (request: FastifyRequest<{ Querystring: SearchQuery }>, reply: FastifyReply) => {
			const queryParams = request.query ?? {};
			if (!(await ensureAuthorized(queryParams.token, reply))) {
				return;
			}
			try {
				const query = queryParams.query || '';
				if (!query) {
					reply.code(400).send({ error: 'Missing query parameter `query`' });
					return;
				}
				const response = await searchBtn(query);
				reply.code(200).send(response);
			} catch (error) {
				console.error(error);
				reply.code(500).send({ error: 'Search failed' });
			}
		}
	);

	fastify.post(
		'/btn/download',
		async (request: FastifyRequest<{ Body: DownloadBody }>, reply: FastifyReply) => {
			const body = request.body || {};
			if (!(await ensureAuthorized(body.token, reply))) {
				return;
			}
			try {
				const { downloadUrl, title } = body;
				if (!downloadUrl || !title) {
					reply.code(400).send({ error: 'Missing `downloadUrl` or `title` in body' });
					return;
				}
				saveToDropboxByUrl({ title, url: downloadUrl }).catch((error) => {
					console.error('saveToDropboxByUrl error', error);
				});
				reply.code(200).send({ ok: true, started: true });
			} catch (error) {
				console.error(error);
				reply.code(500).send({ error: 'Failed to start download' });
			}
		}
	);
}
