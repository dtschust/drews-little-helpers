import { URL } from 'node:url';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
	CallToolRequestSchema,
	ListResourceTemplatesRequestSchema,
	ListResourcesRequestSchema,
	ListToolsRequestSchema,
	ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { createServer } from 'node:http';

const MOVIE_DASHBOARD_EMBEDDED_HTML_URL = 'https://movs.drew.shoes/indexEmbedded.html';
const API_BASE = 'https://tools.drew.shoes/movies';

async function initialize() {
	const MOVIE_DASHBOARD_HTML = await fetch(MOVIE_DASHBOARD_EMBEDDED_HTML_URL).then((res) =>
		res.text()
	);

	const RESOURCE_VERSION = '1';

	function widgetMeta(widget) {
		return {
			'openai/outputTemplate': widget.templateUri,
			'openai/toolInvocation/invoking': widget.invoking,
			'openai/toolInvocation/invoked': widget.invoked,
			'openai/widgetAccessible': true,
			'openai/resultCanProduceWidget': true,
			'openai/widgetDomain': 'https://dtschust.github.io/drews-movie-dashboard/',
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
			templateUri: `ui://widget/movie-dashboard-v${RESOURCE_VERSION}.html`,
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
		type: 'object',
		properties: {
			search: {
				type: 'string',
				description: 'Search for movies',
			},
		},
		additionalProperties: false,
	};

	const toolInputParser = z.object({
		search: z.string().optional(),
	});

	const tools = widgets.map((widget) => ({
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
		templateUri: `ui://widget/movie-dashboard-v${RESOURCE_VERSION}.html`,
		invoking: 'Loading Movie Dashboard',
		invoked: 'Loaded Movie Dashboard',
		html: MOVIE_DASHBOARD_HTML,
		_meta: {
			...widgetMeta(widgets[0]),
			'openai/widgetAccessible': true,
		},
	});

	tools.push({
		name: 'get-top-movies',
		description: 'get top movies',
		inputSchema: toolInputSchema,
		title: 'Get Top Movies',
		templateUri: `ui://widget/movie-dashboard-v${RESOURCE_VERSION}.html`,
		invoking: 'Loading Movie Dashboard',
		invoked: 'Loaded Movie Dashboard',
		html: MOVIE_DASHBOARD_HTML,
		_meta: {
			...widgetMeta(widgets[0]),
			'openai/widgetAccessible': true,
		},
	});

	const resources = widgets.map((widget) => ({
		uri: widget.templateUri,
		name: widget.title,
		description: `${widget.title} widget markup`,
		mimeType: 'text/html+skybridge',
		_meta: widgetMeta(widget),
	}));

	const resourceTemplates = widgets.map((widget) => ({
		uriTemplate: widget.templateUri,
		name: widget.title,
		description: `${widget.title} widget markup`,
		mimeType: 'text/html+skybridge',
		_meta: widgetMeta(widget),
	}));

	function createMCPServer() {
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

		server.setRequestHandler(ListResourcesRequestSchema, async (_request) => ({
			resources,
		}));

		server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
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
		});

		server.setRequestHandler(ListResourceTemplatesRequestSchema, async (_request) => ({
			resourceTemplates,
		}));

		server.setRequestHandler(ListToolsRequestSchema, async (_request) => ({
			tools,
		}));

		server.setRequestHandler(CallToolRequestSchema, async (request) => {
			if (request.params.name === 'search-movies') {
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

			if (request.params.name === 'get-top-movies') {
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

			const widget = widgetsById.get(request.params.name);

			if (!widget) {
				throw new Error(`Unknown tool: ${request.params.name}`);
			}

			const args = toolInputParser.parse(request.params.arguments ?? {});
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

	const sessions = new Map();

	const ssePath = '/mcp';
	const postPath = '/mcp/messages';

	async function handleSseRequest(res) {
		res.setHeader('Access-Control-Allow-Origin', '*');
		const server = createMCPServer();
		const transport = new SSEServerTransport(postPath, res);
		const { sessionId } = transport;

		sessions.set(sessionId, { server, transport });

		transport.onclose = async () => {
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
			}
		}
	}

	async function handlePostMessage(req, res, url) {
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Headers', 'content-type');
		const sessionId = url.searchParams.get('sessionId');

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
			await session.transport.handlePostMessage(req, res);
		} catch (error) {
			console.error('Failed to process message', error);
			if (!res.headersSent) {
				res.writeHead(500).end('Failed to process message');
			}
		}
	}

	const portEnv = Number(process.env.PORT ?? 8000);
	const port = Number.isFinite(portEnv) ? portEnv : 8000;

	const httpServer = createServer(async (req, res) => {
		if (!req.url) {
			res.writeHead(400).end('Missing URL');
			return;
		}

		const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

		if (req.method === 'OPTIONS' && (url.pathname === ssePath || url.pathname === postPath)) {
			res.writeHead(204, {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
				'Access-Control-Allow-Headers': 'content-type',
			});
			res.end();
			return;
		}

		if (req.method === 'GET' && url.pathname === ssePath) {
			await handleSseRequest(res);
			return;
		}

		if (req.method === 'POST' && url.pathname === postPath) {
			await handlePostMessage(req, res, url);
			return;
		}

		res.writeHead(404).end('Not Found');
	});

	httpServer.on('clientError', (err, socket) => {
		console.error('HTTP client error', err);
		socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
	});

	httpServer.listen(port, () => {
		console.log(`Drew's Movie Dashboard MCP server listening on http://localhost:${port}`);
		console.log(`  SSE stream: GET http://localhost:${port}${ssePath}`);
		console.log(
			`  Message post endpoint: POST http://localhost:${port}${postPath}?sessionId=...`
		);
	});
}

async function searchMovies(query) {
	const token = process.env.TOKEN;
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
	const token = process.env.TOKEN;
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

initialize();
