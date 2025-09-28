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

function enableCors(request, reply) {
	if (request.headers['access-control-request-method']) {
		reply.header(
			'access-control-allow-methods',
			request.headers['access-control-request-method']
		);
	}

	if (request.headers['access-control-request-headers']) {
		reply.header(
			'access-control-allow-headers',
			request.headers['access-control-request-headers']
		);
	}

	if (request.headers.origin) {
		reply.header('access-control-allow-origin', request.headers.origin);
		reply.header('access-control-allow-credentials', 'true');
	}
}

function addFbProxyRoute(fastify) {
	fastify.all('/v2/*', async (request, reply) => {
		if (request.method === 'OPTIONS') {
			enableCors(request, reply);
			reply.code(200).send();
			return;
		}

		reply.header('access-control-allow-origin', '*');
		reply.header(
			'access-control-allow-headers',
			'Origin, X-Requested-With, Content-Type, Accept'
		);

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
