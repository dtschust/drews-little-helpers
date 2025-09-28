const path = require('path');
const fs = require('fs').promises;

const PODCAST_INDEX_HTML = [
	'<html><head></head><body>',
	'<ul>',
	'\t<li><a href="feeds/161410.xml">Peecast Blast</a></li>',
	'\t<li><a href="feeds/1001514.xml">Neighborhood Listen</a></li>',
	'\t<li><a href="feeds/1001522.xml">Big Grande Teacher\'s Lounge</a></li>',
	'\t<li><a href="feeds/1001557.xml">Andy Daly Podcast Pilot Project</a></li>',
	'\t<li><a href="feeds/1001575.xml">I Was There Too</a></li>',
	'\t<li><a href="feeds/1001823.xml">Celebrity Sighting! With Jonathan Biting!</a></li>',
	'\t<li><a href="feeds/474009.xml">The Gino Lombardo Show</a></li>',
	'</ul>',
	'</body></html>',
].join('\n');

function addPodcastFeedRoute(fastify) {
	fastify.get('/feeds/', async (request, reply) => {
		try {
			reply.type('text/html').code(200).send(PODCAST_INDEX_HTML);
		} catch (e) {
			console.log(e);
			reply.code(500).send();
		}
	});
	fastify.get('/feeds/:feedId', async (request, reply) => {
		try {
			const feedId = parseInt(request?.params?.feedId.match(/\d+/), 10);
			const feed = await fs.readFile(
				path.resolve('./static/feeds/', `${feedId}.xml`),
				'utf-8'
			);
			const modifiedFeed = feed.replace(/S3_BUCKET_URL/g, process.env.S3_BUCKET_URL);
			reply.type('application/xml');
			reply.code(200).send(modifiedFeed);
		} catch (e) {
			console.log(e);
			reply.code(500).send();
		}
	});
}

module.exports = addPodcastFeedRoute;
