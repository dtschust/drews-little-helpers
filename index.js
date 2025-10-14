const fastifyFactory = require('fastify');
const fastifyCors = require('@fastify/cors');
const fastifyFormbody = require('@fastify/formbody');
const addFbProxyRoute = require('./src/fb-proxy-route');
const addPtpSlackRoute = require('./src/ptp-slack-route');
const addDrewsHelpfulRobotRoute = require('./src/drews-helpful-robot-route');
const addIFlicksRoute = require('./src/iflicks-route');
const addLetterboxdFeedRoute = require('./src/letterboxd-feed-route');
const addSuperlightRoute = require('./src/superlight-route');
const addPodcastFeedRoute = require('./src/podcast-feed-route');
const addMoviesRoute = require('./src/movies-route');
const addMcpRoute = require('./src/mcp');

const fastify = fastifyFactory({
	logger: false,
	ignoreTrailingSlash: true,
});

const port = Number(process.env.PORT) || 8000;

async function buildServer() {
	await fastify.register(fastifyCors, {
		origin: true,
		allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
		methods: ['GET', 'HEAD', 'POST', 'DELETE'],
	});
	await fastify.register(fastifyFormbody);

	addFbProxyRoute(fastify);
	addPtpSlackRoute(fastify);
	addIFlicksRoute(fastify);
	addDrewsHelpfulRobotRoute(fastify);
	addLetterboxdFeedRoute(fastify);
	addSuperlightRoute(fastify);
	addPodcastFeedRoute(fastify);
	addMoviesRoute(fastify);
	await addMcpRoute(fastify);
}

async function start() {
	try {
		await buildServer();
		await fastify.listen({ port, host: '0.0.0.0' });
		console.log('Node app is running on port', port);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
}

start();
