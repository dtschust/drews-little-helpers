const { parseString } = require('xml2js');
const innertext = require('innertext');

require('dotenv').config();

async function parseFeed(username) {
	const response = await fetch(`https://letterboxd.com/${username}/rss/`).then((resp) =>
		resp.text()
	);
	const parsedResult = await new Promise((resolve, reject) => {
		parseString(response, (err, result) => {
			if (err) {
				reject(err);
			}
			resolve(result);
		});
	});
	const feed = parsedResult.rss.channel[0].item;

	const structuredData = feed
		.filter(({ 'letterboxd:filmTitle': isFilm }) => !!isFilm)
		.map((movie) => {
			const imgScraperRegex = /<img src="(.*)"/;
			return {
				title: movie['letterboxd:filmTitle'][0],
				link: movie.link[0],
				poster: movie.description[0].match(imgScraperRegex)?.[1],
				review: innertext(movie.description[0]),
			};
		});
	return structuredData;
}

function addLetterboxdFeedRoute(app) {
	app.get('/letterboxd/:username', async (req, res) => {
		try {
			const username = req?.params?.username;
			const response = await parseFeed(username);
			res.status(200).json(response).end();
		} catch (e) {
			res.status(500).end();
		}
	});
}

module.exports = addLetterboxdFeedRoute;
