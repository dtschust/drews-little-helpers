const httpProxy = require('http-proxy');

const apiProxy = httpProxy.createProxyServer({ secure: false });

function addFwProxyRoute(app) {
	app.all('/api/*', (req, res) => {
		apiProxy.web(req, res, { target: 'https://feedwrangler.net' });
	});
}

module.exports = addFwProxyRoute;
