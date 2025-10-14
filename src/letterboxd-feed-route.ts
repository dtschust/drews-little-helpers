import dotenv from 'dotenv';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { parseString } from 'xml2js';
import innertext from 'innertext';

dotenv.config();

type LetterboxdItem = {
	title: string;
	link: string;
	poster?: string;
	review: string;
};

async function parseFeed(username: string): Promise<LetterboxdItem[]> {
	const response = await fetch(`https://letterboxd.com/${username}/rss/`).then((resp) =>
		resp.text()
	);
	const parsedResult = await new Promise<any>((resolve, reject) => {
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

type LetterboxdRequest = FastifyRequest<{ Params: { username: string } }>;

export default function addLetterboxdFeedRoute(fastify: FastifyInstance) {
	fastify.get('/letterboxd/:username', async (request: LetterboxdRequest, reply: FastifyReply) => {
		try {
			const { username } = request.params;
			const response = await parseFeed(username);
			reply.code(200).send(response);
		} catch (e) {
			reply.code(500).send();
		}
	});
}
