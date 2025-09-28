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

function addLetterboxdFeedRoute(fastify) {
	fastify.get('/letterboxd/:username', async (request, reply) => {
		try {
			const username = request?.params?.username;
			const response = await parseFeed(username);
			reply.code(200).send(response);
		} catch (e) {
			reply.code(500).send();
		}
	});
}

module.exports = addLetterboxdFeedRoute;
