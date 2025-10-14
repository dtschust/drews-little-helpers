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

dotenv.config();

const MOVIE_DASHBOARD_EMBEDDED_HTML_URL = 'https://movs.drew.shoes/indexEmbedded.html';
const API_BASE = 'https://tools.drew.shoes/movies';

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

function normalizePathSegment(segment: string | undefined) {
	const trimmed = (segment || '').trim();
	return trimmed.replace(/^\/+|\/+$/g, '');
}

async function buildContext(): Promise<MCPContext> {
	const MOVIE_DASHBOARD_HTML = await fetch(MOVIE_DASHBOARD_EMBEDDED_HTML_URL).then((res) =>
		res.text()
	);

	// TODO: keep version in db so that I can bump it remotely, also need to check it periodically to
	// refetch templates
	const RESOURCE_VERSION = '1';

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
		templateUri: `ui://widget/movie-dashboard-v${RESOURCE_VERSION}.html`,
		invoking: 'Loading Movie Dashboard',
		invoked: 'Loaded Movie Dashboard',
		html: MOVIE_DASHBOARD_HTML,
		_meta: {
			...widgetMeta(widgets[0]),
			'openai/widgetAccessible': true,
		},
	} as any);

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
	} as any);

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
	const context = await getContext();

	const baseSegment = normalizePathSegment(process.env.MCP_PATH);

	if (!baseSegment) {
		throw new Error('MCP_PATH environment variable must be set');
	}

	const basePath = `/${baseSegment}`;
	const ssePath = `${basePath}/mcp`;
	const postPath = `${ssePath}/messages`;

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

	fastify.get(ssePath, async (request: FastifyRequest, reply: FastifyReply) => {
		reply.hijack();
		await handleSseRequest(reply, context, postPath);
	});

	fastify.post(postPath, async (request: FastifyRequest, reply: FastifyReply) => {
		reply.hijack();
		await handlePostMessage(request, reply, context);
	});

	console.log(`Registered MCP routes at ${ssePath} and ${postPath}`);
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
