require('dotenv').config();
const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
mongoose.connect(
	process.env.MONGO_DB_URI,
	{
		useNewUrlParser: true,
		useUnifiedTopology: true,
	},
);

const RecDiffsEpisodesModel = mongoose.model('RecDiffsEpisodes', {
	episodes: Object,
	order: [String],
});

function addRecDiffsPodcastRoute(app) {
	app.get('/recdiffs', (req, res) => {
		let storedEpisodesModel;
		RecDiffsEpisodesModel.findOne(undefined)
			.exec()
			.then(newStoredEpisodesModel => {
				storedEpisodesModel = newStoredEpisodesModel || {
					episodes: {},
					order: [],
				};
				if (!storedEpisodesModel) {
					console.log('nothing to serve!');
					res.status(500).end();
					return;
				}
				const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
<title>RecDiffs Pirate Feed</title>
<link>https://www.relay.fm/rd</link>
<language>en-us</language>
<itunes:author>Merlin Mann and John Siracusa</itunes:author>
<itunes:summary>John Siracusa and Merlin Mann try to figure out exactly how they got this way.</itunes:summary>
<description>John Siracusa and Merlin Mann try to figure out exactly how they got this way.</description>
<itunes:owner>
	<itunes:name>Reconcilable Differences</itunes:name>
</itunes:owner>
<itunes:explicit>no</itunes:explicit>
<itunes:image href="https://relayfm.s3.amazonaws.com/uploads/broadcast/image_3x/18/rd_artwork.png" />

${storedEpisodesModel.order
					.slice()
					.reverse()
					.map(key => {
						const {
							url,
							title,
							pubDate,
						} = storedEpisodesModel.episodes[key];
						return `<item>
	<title>${title}</title>
	<itunes:summary>${title}</itunes:summary>
	<description>${title}</description>
	<link>${url}</link>
	<enclosure url="${url}" type="audio/mpeg" length="1024"></enclosure>
	<pubDate>${pubDate}</pubDate>
	<itunes:author>Merlin Mann and John Siracusa</itunes:author>
	<itunes:duration>00:32:16</itunes:duration>
	<itunes:explicit>no</itunes:explicit>
	<guid>${url}</guid>
</item>`;
					})
					.join('\n')}

</channel>
</rss>
`;
				res.status(200);
				res.type('application/xml');
				res.send(xml);
			})
			.catch(e => {
				console.log('Huh, we have an error', e);
				process.exit(0);
			});
	});
}

module.exports = addRecDiffsPodcastRoute;
