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

function enableCors(req, res) {
	if (req.headers['access-control-request-method']) {
		res.setHeader('access-control-allow-methods', req.headers['access-control-request-method']);
	}

	if (req.headers['access-control-request-headers']) {
		res.setHeader(
			'access-control-allow-headers',
			req.headers['access-control-request-headers']
		);
	}

	if (req.headers.origin) {
		res.setHeader('access-control-allow-origin', req.headers.origin);
		res.setHeader('access-control-allow-credentials', 'true');
	}
}

function addFbProxyRoute(app) {
	app.all('/v2/*', (req, res) => {
		// You can define here your custom logic to handle the request
		// and then proxy the request.
		if (req.method === 'OPTIONS') {
			enableCors(req, res);
			res.status(200);
			res.end();
			return;
		}
		apiProxy.web(req, res, { target: 'https://api.feedbin.com', changeOrigin: true });
	});
}

module.exports = addFbProxyRoute;
