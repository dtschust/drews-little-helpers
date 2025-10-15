import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
	CallToolRequestSchema,
	ListResourceTemplatesRequestSchema,
	ListResourcesRequestSchema,
	ListToolsRequestSchema,
	ReadResourceRequestSchema,
	type CallToolRequest,
	type ReadResourceRequest,
	type Resource,
	type ResourceTemplate,
	type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import '../utils/mongoose-connect';
import McpTemplateVersion from '../mongoose-models/Mcp-Template-Version';

dotenv.config();

const MOVIE_DASHBOARD_EMBEDDED_HTML_URL = 'https://movs.drew.shoes/indexEmbedded.html';
const API_BASE = 'https://tools.drew.shoes/movies';

type FeedbinTagging = {
	name: string;
	feed_id: number;
};

type FeedbinSubscription = {
	feed_id: number;
	title: string;
};

type FeedbinEntry = {
	id: number;
	feed_id: number;
	title: string;
	summary: string;
	content: string;
	url: string;
};

type FeedbinTagData = Record<string, Record<string, FeedbinEntry[]>>;

interface MCPContext {
	createMCPServer: () => Server;
	sessions: Map<
		string,
		{
			server: Server;
			transport: SSEServerTransport;
		}
	>;
}

let contextPromise: Promise<MCPContext> | undefined;

function resetContext() {
	contextPromise = undefined;
}

function normalizePathSegment(segment: string | undefined) {
	const trimmed = (segment || '').trim();
	return trimmed.replace(/^\/+|\/+$/g, '');
}

async function buildContext(): Promise<MCPContext> {
	const MOVIE_DASHBOARD_HTML = await fetch(MOVIE_DASHBOARD_EMBEDDED_HTML_URL).then((res) =>
		res.text()
	);

	const templateVersionDoc = await McpTemplateVersion.findOne().exec();
	const resourceVersion = templateVersionDoc?.version ?? '4';

	function widgetMeta(widget) {
		return {
			'openai/outputTemplate': widget.templateUri,
			'openai/toolInvocation/invoking': widget.invoking,
			'openai/toolInvocation/invoked': widget.invoked,
			'openai/widgetAccessible': true,
			'openai/resultCanProduceWidget': true,
			'openai/widgetDomain': 'https://movs.drew.shoes',
			'openai/widgetCSP': {
				connect_domains: ['https://tools.drew.shoes', 'https://api.imdbapi.dev'],
				resource_domains: [
					'https://persistent.oaistatic.com',
					'https://ptpimg.me',
					'https://m.media-amazon.com',
				],
			},
		};
	}

	const widgets = [
		{
			id: 'movie-dashboard',
			title: 'Show Movie Dashboard or get information about a Movie',
			templateUri: `ui://widget/movie-dashboard-v${resourceVersion}.html`,
			invoking: 'Loading Movie Dashboard',
			invoked: 'Loaded Movie Dashboard',
			html: MOVIE_DASHBOARD_HTML,
			responseText: 'Hi Drew!',
		},
	];

	const widgetsById = new Map();
	const widgetsByUri = new Map();

	widgets.forEach((widget) => {
		widgetsById.set(widget.id, widget);
		widgetsByUri.set(widget.templateUri, widget);
	});

	const toolInputSchema = {
		type: 'object' as const,
		properties: {
			search: {
				type: 'string' as const,
				description: 'Search for movies',
			},
		},
		additionalProperties: false,
	} as const;

	const toolInputParser = z.object({
		search: z.string().optional(),
	});

	const tools: Tool[] = widgets.map((widget) => ({
		name: widget.id,
		description: widget.title,
		inputSchema: toolInputSchema,
		title: widget.title,
		_meta: widgetMeta(widget),
	}));

	tools.push({
		name: 'search-movies',
		description: 'Search for movies',
		inputSchema: toolInputSchema,
		title: 'Search for movies',
		templateUri: `ui://widget/movie-dashboard-v${resourceVersion}.html`,
		invoking: 'Loading Movie Dashboard',
		invoked: 'Loaded Movie Dashboard',
		html: MOVIE_DASHBOARD_HTML,
		_meta: {
			...widgetMeta(widgets[0]),
			'openai/widgetAccessible': true,
		},
	} as Tool);

	tools.push({
		name: 'get-top-movies',
		description: 'get top movies',
		inputSchema: toolInputSchema,
		title: 'Get Top Movies',
		templateUri: `ui://widget/movie-dashboard-v${resourceVersion}.html`,
		invoking: 'Loading Movie Dashboard',
		invoked: 'Loaded Movie Dashboard',
		html: MOVIE_DASHBOARD_HTML,
		_meta: {
			...widgetMeta(widgets[0]),
			'openai/widgetAccessible': true,
		},
	} as Tool);

	const versionToolInputSchema = {
		type: 'object' as const,
		properties: {
			id: {
				type: 'string' as const,
				description: 'The id of the movie',
			},
			title: {
				type: 'string' as const,
				description: 'The title of the movie',
				optional: true,
			},
		},
		additionalProperties: false,
	} as const;

	const versionToolInputParser = z.object({
		id: z.string().optional(),
		title: z.string().optional(),
	});

	tools.push({
		name: 'get-versions',
		description: 'get available versions of a movie',
		inputSchema: versionToolInputSchema,
		title: 'Get Available Versions of a Movie',
		templateUri: `ui://widget/movie-dashboard-v${resourceVersion}.html`,
		invoking: 'Loading Movie Dashboard',
		invoked: 'Loaded Movie Dashboard',
		html: MOVIE_DASHBOARD_HTML,
		_meta: {
			...widgetMeta(widgets[0]),
			'openai/widgetAccessible': true,
		},
	} as Tool);

	const fetchMovieToolInputSchema = {
		type: 'object' as const,
		properties: {
			torrentId: {
				type: 'string' as const,
				description: 'The id of the movie',
			},
			movieTitle: {
				type: 'string' as const,
				description: 'The title of the movie',
				optional: true,
			},
		},
		additionalProperties: false,
	} as const;

	const fetchMovieToolInputParser = z.object({
		torrentId: z.string().optional(),
		movieTitle: z.string().optional(),
	});

	tools.push({
		name: 'fetch-movie',
		description: 'fetch a movie',
		inputSchema: fetchMovieToolInputSchema,
		title: 'Fetch a Movie',
		templateUri: `ui://widget/movie-dashboard-v${resourceVersion}.html`,
		invoking: 'Fetching Movie',
		invoked: 'Fetched Movie',
		html: MOVIE_DASHBOARD_HTML,
		_meta: {
			...widgetMeta(widgets[0]),
			'openai/widgetAccessible': true,
		},
	} as Tool);

	tools.push({
		name: 'get-rss-entries',
		description: 'get rss entries',
		inputSchema: {
			type: 'object' as const,
			properties: {},
			additionalProperties: false,
		},
		title: 'Get RSS Entries',
		// templateUri: `ui://widget/movie-dashboard-v${resourceVersion}.html`,
		// invoking: 'Fetching Movie',
		// invoked: 'Fetched Movie',
		// html: MOVIE_DASHBOARD_HTML,
		_meta: {
			// ...widgetMeta(widgets[0]),
			'openai/widgetAccessible': true,
		},
	} as Tool);

	const resources: Resource[] = widgets.map((widget) => ({
		uri: widget.templateUri,
		name: widget.title,
		description: `${widget.title} widget markup`,
		mimeType: 'text/html+skybridge',
		_meta: widgetMeta(widget),
	}));

	const resourceTemplates: ResourceTemplate[] = widgets.map((widget) => ({
		uriTemplate: widget.templateUri,
		name: widget.title,
		description: `${widget.title} widget markup`,
		mimeType: 'text/html+skybridge',
		_meta: widgetMeta(widget),
	}));

	function createMCPServer(): Server {
		const server = new Server(
			{
				name: 'drews-movie-dashboard',
				version: '0.1.0',
			},
			{
				capabilities: {
					resources: {},
					tools: {},
				},
			}
		);

		server.setRequestHandler(ListResourcesRequestSchema, async () => ({
			resources,
		}));

		server.setRequestHandler(
			ReadResourceRequestSchema,
			async (request: ReadResourceRequest) => {
				const widget = widgetsByUri.get(request.params.uri);

				if (!widget) {
					throw new Error(`Unknown resource: ${request.params.uri}`);
				}

				return {
					contents: [
						{
							uri: widget.templateUri,
							mimeType: 'text/html+skybridge',
							text: widget.html,
							_meta: widgetMeta(widget),
						},
					],
				};
			}
		);

		server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
			resourceTemplates,
		}));

		server.setRequestHandler(ListToolsRequestSchema, async () => ({
			tools,
		}));

		server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
			const toolName = request.params.name;

			switch (toolName) {
				case 'search-movies': {
					const args = toolInputParser.parse(request.params.arguments ?? {});
					const { movies } = await searchMovies(args.search ?? '');

					return {
						content: [
							{
								type: 'text',
								text: `Found ${movies?.length ?? 0} movies`,
							},
						],
						structuredContent: {
							movies,
						},
					};
				}
				case 'get-top-movies': {
					const { movies } = await getTopMovies();

					return {
						content: [
							{
								type: 'text',
								text: `Found ${movies?.length ?? 0} top movies`,
							},
						],
						structuredContent: {
							movies,
						},
					};
				}
				case 'get-versions': {
					const { id, title } = versionToolInputParser.parse(
						request.params.arguments ?? {}
					);
					const { versions } = await getVersions({ id, title });

					return {
						content: [
							{
								type: 'text',
								text: `Found ${versions?.length ?? 0} versions`,
							},
						],
						structuredContent: {
							versions,
						},
					};
				}
				case 'fetch-movie': {
					const { torrentId, movieTitle } = fetchMovieToolInputParser.parse(
						request.params.arguments ?? {}
					);
					const { ok, started } = await fetchMovie({ torrentId, movieTitle });

					return {
						content: [
							{
								type: 'text',
								text: `Fetched ${movieTitle}: ${ok ? 'success' : 'failed'}`,
							},
						],
						structuredContent: {
							ok,
							started,
						},
					};
				}
				case 'get-rss-entries': {
					const data = await getRSSEntries();

					return {
						content: [
							{
								type: 'text',
								text: `Found RSS entries`,
							},
						],
						structuredContent: data,
					};
				}
				default:
					break;
			}

			const widget = widgetsById.get(request.params.name);

			if (!widget) {
				throw new Error(`Unknown tool: ${request.params.name}`);
			}

			toolInputParser.parse(request.params.arguments ?? {});
			const structuredContent = {};

			return {
				content: [
					{
						type: 'text',
						text: widget.responseText,
					},
				],
				structuredContent,
				_meta: widgetMeta(widget),
			};
		});

		return server;
	}

	return {
		createMCPServer,
		sessions: new Map(),
	};
}

async function getContext(): Promise<MCPContext> {
	if (!contextPromise) {
		contextPromise = buildContext();
	}
	return contextPromise;
}

async function handleSseRequest(reply: FastifyReply, context: MCPContext, postPath: string) {
	const res = reply.raw;
	const { createMCPServer, sessions } = context;
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Headers', 'content-type');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	const server = createMCPServer();
	const transport = new SSEServerTransport(postPath, res);
	const { sessionId } = transport;

	sessions.set(sessionId, { server, transport });

	transport.onclose = () => {
		sessions.delete(sessionId);
	};

	transport.onerror = (error) => {
		console.error('SSE transport error', error);
	};

	try {
		await server.connect(transport);
	} catch (error) {
		sessions.delete(sessionId);
		console.error('Failed to start SSE session', error);
		if (!res.headersSent) {
			res.writeHead(500).end('Failed to establish SSE connection');
		} else {
			res.end();
		}
	}
}

async function handlePostMessage(
	request: FastifyRequest,
	reply: FastifyReply,
	context: MCPContext
) {
	const res = reply.raw;
	const { sessions } = context;

	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Headers', 'content-type');

	const { sessionId } = (request.query as Record<string, string | undefined>) || {};

	if (!sessionId) {
		res.writeHead(400).end('Missing sessionId query parameter');
		return;
	}

	const session = sessions.get(sessionId);

	if (!session) {
		res.writeHead(404).end('Unknown session');
		return;
	}

	try {
		await session.transport.handlePostMessage(request.raw, res, request.body as any);
	} catch (error) {
		console.error('Failed to process message', error);
		if (!res.headersSent) {
			res.writeHead(500).end('Failed to process message');
		}
	}
}

export default async function addMcpRoutes(fastify: FastifyInstance) {
	let context = await getContext();

	const baseSegment = normalizePathSegment(process.env.MCP_PATH);

	if (!baseSegment) {
		throw new Error('MCP_PATH environment variable must be set');
	}

	const basePath = `/${baseSegment}`;
	const ssePath = `${basePath}/mcp`;
	const postPath = `${ssePath}/messages`;
	const bumpPath = `${basePath}/mcp-bump`;

	fastify.options(ssePath, (request: FastifyRequest, reply: FastifyReply) => {
		reply
			.header('Access-Control-Allow-Origin', '*')
			.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
			.header('Access-Control-Allow-Headers', 'content-type')
			.code(204)
			.send();
	});

	fastify.options(postPath, (request: FastifyRequest, reply: FastifyReply) => {
		reply
			.header('Access-Control-Allow-Origin', '*')
			.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
			.header('Access-Control-Allow-Headers', 'content-type')
			.code(204)
			.send();
	});

	fastify.options(bumpPath, (request: FastifyRequest, reply: FastifyReply) => {
		reply
			.header('Access-Control-Allow-Origin', '*')
			.header('Access-Control-Allow-Methods', 'POST, OPTIONS')
			.header('Access-Control-Allow-Headers', 'content-type')
			.code(204)
			.send();
	});

	fastify.get(ssePath, async (request: FastifyRequest, reply: FastifyReply) => {
		reply.hijack();
		await handleSseRequest(reply, context, postPath);
	});

	fastify.post(postPath, async (request: FastifyRequest, reply: FastifyReply) => {
		reply.hijack();
		await handlePostMessage(request, reply, context);
	});

	fastify.post(bumpPath, async (request: FastifyRequest, reply: FastifyReply) => {
		reply
			.header('Access-Control-Allow-Origin', '*')
			.header('Access-Control-Allow-Methods', 'POST, OPTIONS')
			.header('Access-Control-Allow-Headers', 'content-type');

		try {
			const existing = await McpTemplateVersion.findOne().exec();
			const currentVersion = existing?.version ?? '4';
			const currentVersionNumber = Number.parseInt(currentVersion, 10);
			const baseVersion = Number.isNaN(currentVersionNumber) ? 4 : currentVersionNumber;
			const nextVersion = String(baseVersion + 1);

			await McpTemplateVersion.deleteMany({});
			const nextVersionDocument = new McpTemplateVersion({ version: nextVersion });
			await nextVersionDocument.save();

			resetContext();
			context = await getContext();

			return reply.send({ version: nextVersion });
		} catch (error) {
			request.log.error({ err: error }, 'Failed to bump MCP template version');
			return reply.status(500).send({ error: 'Failed to bump MCP template version' });
		}
	});

	console.log(`Registered MCP routes at ${ssePath}, ${postPath}, and ${bumpPath}`);
}

async function searchMovies(query: string) {
	const token = process.env.CUSTOM_PTP_API_TOKEN;
	if (!token) {
		throw new Error('TOKEN is not set');
	}
	const url = new URL(`${API_BASE}/search`);
	url.searchParams.set('q', query);
	url.searchParams.set('token', token);
	const res = await fetch(url.toString());
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || `Search failed (${res.status})`);
	}
	return res.json();
}

async function getTopMovies() {
	const token = process.env.CUSTOM_PTP_API_TOKEN;
	if (!token) {
		throw new Error('TOKEN is not set');
	}
	const url = new URL(`${API_BASE}/topMovies`);
	url.searchParams.set('token', token);
	const res = await fetch(url.toString());
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || `Top movies failed (${res.status})`);
	}
	return res.json();
}

async function getVersions({ id, title }: { id: string; title: string }) {
	const token = process.env.CUSTOM_PTP_API_TOKEN;
	if (!token) {
		throw new Error('TOKEN is not set');
	}
	const url = new URL(`${API_BASE}/getVersions`);
	url.searchParams.set('id', String(id));
	url.searchParams.set('title', title ?? '');
	url.searchParams.set('token', token);
	const res = await fetch(url.toString());
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || `Get versions failed (${res.status})`);
	}
	return res.json();
}

async function fetchMovie({ torrentId, movieTitle }: { torrentId: string; movieTitle: string }) {
	const token = process.env.CUSTOM_PTP_API_TOKEN;
	if (!token) {
		throw new Error('TOKEN is not set');
	}
	const res = await fetch(`${API_BASE}/downloadMovie`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ torrentId, movieTitle, token }),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || `Download failed (${res.status})`);
	}
	return res.json();
}

const FEEDBIN_BASE_URL = 'https://tools.drew.shoes/v2';
const RSS_ENTRIES_CACHE_TTL_MS = 10 * 60 * 1000;

let rssEntriesCache:
	| {
			data: RssEntriesResponse;
			expiresAt: number;
	  }
	| undefined;

type RssEntriesResponse = FeedbinTagData;

// TODO: Need to have a separate tool to just fetch feed names/tags and unread counts.
// then modify this tool to be able to fetch an individual feed or tag.
// the goal here is to not use as much context
async function getRSSEntries(): Promise<RssEntriesResponse> {
	const now = Date.now();

	if (rssEntriesCache && rssEntriesCache.expiresAt > now) {
		return rssEntriesCache.data;
	}

	const authToken = process.env.FEEDBIN_AUTH;
	if (!authToken) {
		throw new Error('FEEDBIN_AUTH is not set');
	}
	const headers = new Headers();
	headers.set('Authorization', authToken);
	headers.set('Content-Type', 'application/json');

	const fetchFeedbinResource = async <T>(path: string): Promise<T> => {
		const res = await fetch(`${FEEDBIN_BASE_URL}/${path}`, {
			headers,
		});

		if (!res.ok) {
			const body = await res.text();
			throw new Error(body || `Feedbin request failed (${res.status})`);
		}

		return (await res.json()) as T;
	};

	const [taggings, subscriptions, unreadEntries] = await Promise.all([
		fetchFeedbinResource<FeedbinTagging[]>('taggings.json'),
		fetchFeedbinResource<FeedbinSubscription[]>('subscriptions.json'),
		fetchFeedbinResource<FeedbinEntry[]>('entries.json?read=false'),
	]);

	const subscriptionsByFeedId = new Map<number, FeedbinSubscription>();
	for (const subscription of subscriptions) {
		subscriptionsByFeedId.set(subscription.feed_id, subscription);
	}

	const entriesByFeedId = unreadEntries.reduce<Map<number, FeedbinEntry[]>>((acc, entry) => {
		const collection = acc.get(entry.feed_id);
		if (collection) {
			collection.push(entry);
		} else {
			acc.set(entry.feed_id, [entry]);
		}

		return acc;
	}, new Map());

	const data: FeedbinTagData = {};

	for (const tagging of taggings) {
		const subscription = subscriptionsByFeedId.get(tagging.feed_id);
		if (!subscription) {
			continue;
		}

		const unreadForSubscription = entriesByFeedId.get(tagging.feed_id);
		if (!unreadForSubscription || unreadForSubscription.length === 0) {
			continue;
		}

		if (!data[tagging.name]) {
			data[tagging.name] = {};
		}

		data[tagging.name][subscription.title] = unreadForSubscription;
	}

	// Cache successful result to avoid hitting Feedbin on every call.
	rssEntriesCache = {
		data,
		expiresAt: Date.now() + RSS_ENTRIES_CACHE_TTL_MS,
	};

	return data;
}
