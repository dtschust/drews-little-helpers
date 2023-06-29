const path = require('path');
const fs = require('fs').promises;

function addPodcastFeedRoute(app) {
	app.get('/feeds/', async (req, res) => {
		try {
			res.status(200)
				.send(
					`
<html><head></head><body>
<ul>
	<li><a href="161410.xml">Peecast Blast</a></li>
	<li><a href="1001514.xml">Neighborhood Listen</a></li>
	<li><a href="1001522.xml">Big Grande Teacher's Lounge</a></li>
	<li><a href="1001557.xml">Andy Daly Podcast Pilot Project</a></li>
	<li><a href="1001575.xml">I Was There Too</a></li>
	<li><a href="1001823.xml">Celebrity Sighting! With Jonathan Biting!</a></li>
	<li><a href="474009.xml">The Gino Lombardo Show</a></li>
</ul>
</body></html>`
				)
				.end();
		} catch (e) {
			console.log(e);
			res.status(500).end();
		}
	});
	app.get('/feeds/:feedId', async (req, res) => {
		try {
			const feedId = parseInt(req?.params?.feedId.match(/\d+/), 10);
			const feed = await fs.readFile(
				path.resolve('./static/feeds/', `${feedId}.xml`),
				'utf-8'
			);
			const modifiedFeed = feed.replace(/S3_BUCKET_URL/g, process.env.S3_BUCKET_URL);
			res.type('application/xml');
			res.status(200).send(modifiedFeed).end();
		} catch (e) {
			console.log(e);
			res.status(500).end();
		}
	});
}

module.exports = addPodcastFeedRoute;
