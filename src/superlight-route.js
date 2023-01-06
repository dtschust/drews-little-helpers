require('isomorphic-fetch');

function addSuperlightRoute(app) {
	app.all('/superlight/feed.json', (req, res) => {
		fetch('http://superlight.jimwhimpey.com/feed.json')
			.then((resp) => resp.json())
			.then((feed) => {
				const convertedFeed = {
					...feed,
					items: feed.items.map((item) => {
						return {
							...item,
							id: item.id.toString(),
						};
					}),
				};
				res.json(convertedFeed);
				res.status(200);
			});
	});
}

module.exports = addSuperlightRoute;
