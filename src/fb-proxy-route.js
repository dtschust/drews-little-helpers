const httpProxy = require('http-proxy');

const apiProxy = httpProxy.createProxyServer({ secure: false });

function addFbProxyRoute(app) {
	app.all('/v2/*', (req, res) => {
		apiProxy.web(req, res, { target: 'https://api.feedbin.com', changeOrigin: true });
	});
}

module.exports = addFbProxyRoute;
