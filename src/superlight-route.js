async function fetchSuperlightFeed() {
	const resp = await fetch('http://superlight.jimwhimpey.com/feed.json');
	return resp.json();
}

function addSuperlightRoute(fastify) {
	fastify.all('/superlight/feed.json', async (request, reply) => {
		try {
			const feed = await fetchSuperlightFeed();
			const convertedFeed = {
				...feed,
				items: feed.items.map((item) => ({
					...item,
					id: item.id.toString(),
					summary: item.summary.replace(/\d{10}-/, ''),
				})),
			};
			reply.code(200).send(convertedFeed);
		} catch (e) {
			reply.code(500).send();
		}
	});
}

module.exports = addSuperlightRoute;
