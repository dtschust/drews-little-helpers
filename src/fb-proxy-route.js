const httpProxy = require('http-proxy');

const apiProxy = httpProxy.createProxyServer({ secure: false });

// https://github.com/http-party/node-http-proxy/issues/1142#issuecomment-282810543
apiProxy.on('proxyReq', (proxyReq, req) => {
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

function setCorsHeaders(request, setHeader) {
	const { origin } = request.headers;

	if (origin) {
		setHeader('access-control-allow-origin', origin);
		setHeader('access-control-allow-credentials', 'true');
		setHeader('vary', 'Origin');
	} else {
		setHeader('access-control-allow-origin', '*');
	}

	setHeader(
		'access-control-allow-headers',
		request.headers['access-control-request-headers'] || ALLOW_HEADERS
	);
}

function enableCors(request, reply) {
	setCorsHeaders(request, reply.header.bind(reply));

	if (request.headers['access-control-request-method']) {
		reply.header(
			'access-control-allow-methods',
			request.headers['access-control-request-method']
		);
	}
}

apiProxy.on('proxyRes', (proxyRes, req, res) => {
	setCorsHeaders(req, res.setHeader.bind(res));
});

function addFbProxyRoute(fastify) {
	fastify.all('/v2/*', async (request, reply) => {
		if (request.method === 'OPTIONS') {
			enableCors(request, reply);
			reply.code(200).send();
			return;
		}

		reply.hijack();
		// Mirror Express behaviour for http-proxy by attaching parsed body to the raw request
		// so the proxyReq listener can forward it downstream.
		const rawRequest = request.raw;
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

module.exports = addFbProxyRoute;
