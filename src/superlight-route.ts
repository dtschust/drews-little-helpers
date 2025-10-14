import type { FastifyInstance } from 'fastify';

type SuperlightItem = {
	id: string | number;
	summary: string;
	[key: string]: unknown;
};

type SuperlightFeed = {
	items: SuperlightItem[];
	[key: string]: unknown;
};

async function fetchSuperlightFeed(): Promise<SuperlightFeed> {
	const resp = await fetch('http://superlight.jimwhimpey.com/feed.json');
	return (await resp.json()) as SuperlightFeed;
}

export default function addSuperlightRoute(fastify: FastifyInstance) {
	fastify.all('/superlight/feed.json', async (request, reply) => {
		try {
			const feed = await fetchSuperlightFeed();
			const convertedFeed = {
				...feed,
				items: feed.items.map((item) => ({
					...item,
					id: item.id.toString(),
					summary: item.summary ? item.summary.replace(/\d{10}-/, '') : item.summary,
				})),
			};
			reply.code(200).send(convertedFeed);
		} catch (e) {
			reply.code(500).send();
		}
	});
}
