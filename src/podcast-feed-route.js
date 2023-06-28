const path = require('path');
const fs = require('fs').promises;

function addPodcastFeedRoute(app) {
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
