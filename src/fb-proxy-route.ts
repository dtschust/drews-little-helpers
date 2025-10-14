import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { IncomingMessage, ServerResponse } from 'http';
import httpProxy from 'http-proxy';

const apiProxy = httpProxy.createProxyServer({ secure: false });

// https://github.com/http-party/node-http-proxy/issues/1142#issuecomment-282810543
apiProxy.on('proxyReq', (proxyReq, req: IncomingMessage & { body?: unknown }) => {
	if (req.body) {
		const bodyData = JSON.stringify(req.body);
		// incase if content-type is application/x-www-form-urlencoded -> we need to change to application/json
		proxyReq.setHeader('Content-Type', 'application/json');
		proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
		// stream the content
		proxyReq.write(bodyData);
	}
});

const ALLOW_HEADERS = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';

type HeaderSetter = (name: string, value: string) => void;

type RequestLike = {
	headers: Record<string, string | string[] | undefined>;
};

function setCorsHeaders(request: RequestLike, setHeader: HeaderSetter) {
	const { origin } = request.headers;

	if (origin) {
		setHeader(
			'access-control-allow-origin',
			Array.isArray(origin) ? (origin[0] ?? '*') : origin
		);
		setHeader('access-control-allow-credentials', 'true');
		setHeader('vary', 'Origin');
	} else {
		setHeader('access-control-allow-origin', '*');
	}

	setHeader(
		'access-control-allow-headers',
		Array.isArray(request.headers['access-control-request-headers'])
			? request.headers['access-control-request-headers']?.join(', ') || ALLOW_HEADERS
			: request.headers['access-control-request-headers'] || ALLOW_HEADERS
	);
}

function enableCors(request: FastifyRequest, reply: FastifyReply) {
	setCorsHeaders(request as unknown as RequestLike, reply.header.bind(reply));

	const requestedMethods = request.headers['access-control-request-method'];
	if (requestedMethods) {
		reply.header(
			'access-control-allow-methods',
			Array.isArray(requestedMethods) ? requestedMethods.join(', ') : requestedMethods
		);
	}
}

apiProxy.on('proxyRes', (_, req: IncomingMessage, res: ServerResponse) => {
	setCorsHeaders(req as RequestLike, res.setHeader.bind(res));
});

export default function addFbProxyRoute(fastify: FastifyInstance) {
	fastify.all('/v2/*', async (request, reply) => {
		if (request.method === 'OPTIONS') {
			enableCors(request, reply);
			reply.code(200).send();
			return;
		}

		reply.hijack();
		// Mirror Express behaviour for http-proxy by attaching parsed body to the raw request
		// so the proxyReq listener can forward it downstream.
		const rawRequest = request.raw as IncomingMessage & { body?: unknown };
		const rawReply = reply.raw;
		rawRequest.body = request.body;

		apiProxy.web(
			rawRequest,
			rawReply,
			{ target: 'https://api.feedbin.com', changeOrigin: true },
			(err) => {
				if (err) {
					rawReply.writeHead(500);
					rawReply.end();
				}
			}
		);
	});
}
