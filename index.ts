import fastifyFactory from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyFormbody from '@fastify/formbody';
import addFbProxyRoute from './src/fb-proxy-route';
import addPtpSlackRoute from './src/ptp-slack-route';
import addDrewsHelpfulRobotRoute from './src/drews-helpful-robot-route';
import addIFlicksRoute from './src/iflicks-route';
import addLetterboxdFeedRoute from './src/letterboxd-feed-route';
import addSuperlightRoute from './src/superlight-route';
import addPodcastFeedRoute from './src/podcast-feed-route';
import addMoviesRoute from './src/movies-route';
import addMcpRoute from './src/mcp';
import addOpenaiChallengeRoute from './src/openai-challenge-route';
import addHdBitsRoute from './src/hdbits-route';
import addBtnRoute from './src/btn-route';

const fastify = fastifyFactory({
	logger: false,
	routerOptions: {
		ignoreTrailingSlash: true,
	},
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
	addHdBitsRoute(fastify);
	addBtnRoute(fastify);
	addOpenaiChallengeRoute(fastify);
	await addMcpRoute(fastify);
}

async function start() {
	try {
		await buildServer();
		await fastify.listen({ port, host: '0.0.0.0' });
		console.log('Node app is running on port', port);
	} catch (err) {
		console.log(err);
		fastify.log.error(err);
		process.exit(1);
	}
}

start();
