require('dotenv').config();
require('isomorphic-fetch');
require('./utils/mongoose-connect');

const slackBlockBuilder = require('slack-block-builder');

const TopMovies = require('./mongoose-models/Top-Movies');
const PtpCookie = require('./mongoose-models/Ptp-Cookie');
const getPtpLoginCookies = require('./utils/get-ptp-login-cookie');
const { getDrewsHelpfulRobot } = require('./utils/slack');
const { sortTorrents, sendMessageToSlackResponseURL, saveUrlToDropbox } = require('./utils/ptp');

const { Surfaces, Blocks, Elements /* Bits, Utilities */ } = slackBlockBuilder;

const { webMovies } = getDrewsHelpfulRobot();

let authKey;
let passKey;

let GroupIdMap = {};

// Wipe the map once an hour
setInterval(() => {
	GroupIdMap = {};
}, 60 * 1000 * 1000);

async function sendTopTenMoviesOfTheWeek(provideFeedback) {
	const { movies } = await TopMovies.findOne(undefined);

	const attachments = movies.map(({ title, id, posterUrl, year }) => ({
		title,
		callback_id: title,
		image_url: posterUrl,
		actions: [
			{
				name: `searchMovie ${title}`,
				text: `Select ${title} (${year})`,
				type: 'button',
				value: id,
			},
		],
	}));

	const message = {
		text: `Top Ten Movies of the Week :`,
		attachments,
	};
	provideFeedback(message);
}

async function publishViewForUser(user) {
	const { movies } = await TopMovies.findOne(undefined);
	const blocks = [
		Blocks.Input().element(
			Elements.TextInput({
				actionId: 'searchMovieAppHome',
				initialValue: 'Search for a movie',
			}).label('Search for a movie')
		),
		Blocks.Section().text('*Top 10 Movies of the Week*'),
		Blocks.Divider(),
	];
	movies.forEach(({ title, id, posterUrl, year }) => {
		blocks.push(Blocks.Section().text(`*${title}* (${year})`));
		blocks.push(Blocks.Image({ imageUrl: posterUrl, altText: title }));
		blocks.push(
			Blocks.Actions().elements(
				Elements.Button({
					text: `${title} (${year})`,
					actionId: `selectMovieAppHome ${title}`,
					value: JSON.stringify({ title, id, posterUrl, year }),
				})
			)
		);
		blocks.push(Blocks.Divider());
	});

	const view = Surfaces.HomeTab().blocks(blocks).buildToJSON();

	return webMovies.views.publish({
		user_id: user,
		view,
	});
}

let COOKIE;
PtpCookie.findOne(undefined)
	.exec()
	.then((newCookie) => {
		if (newCookie) {
			COOKIE = newCookie.get('cookie');
		}
	});

async function getLoginCookies(provideFeedback, retry) {
	let message = {
		text: 'Oops, need to log in again, please hold!',
	};
	await provideFeedback(message);

	try {
		COOKIE = await getPtpLoginCookies();
	} catch (e) {
		message = {
			text: "Looks like I got captcha-ed and can't login, please stop trying for a bit!",
			replace_original: true,
		};
		await provideFeedback(message);
		return false;
	}

	message = {
		text: `New login succeeded, ${retry ? 'searching again' : 'please search again!'}`,
		replace_original: true,
	};
	await provideFeedback(message);
	return true;
}

function search(query) {
	const sanitizedQuery = query.replace(/’/g, "'");
	return fetch(
		`https://passthepopcorn.me/torrents.php?json=noredirect&order_by=relevance&searchstr=${sanitizedQuery}`,
		{
			headers: {
				cookie: COOKIE,
			},
		}
	).then((resp) => resp.json());
}

async function searchAndRespond({
	query,
	provideFeedback,
	retry = true,
	groupId = undefined,
} = {}) {
	let apiResponse;
	try {
		apiResponse = await search(query);
	} catch (e) {
		console.error('exception parsing JSON body: ', e);
		const success = await getLoginCookies(provideFeedback, retry);
		if (retry && success) {
			return searchAndRespond({
				query,
				provideFeedback,
				retry: false,
				groupId,
			});
		}
	}

	authKey = apiResponse.AuthKey;
	passKey = apiResponse.PassKey;

	const movies = apiResponse.Movies.slice(0, 5);
	movies.forEach((movie) => {
		GroupIdMap[movie.GroupId] = movie;
	});

	if (groupId) {
		// We already know the id of the movie we want, so we can skip the results
		return selectMovie(query, groupId, provideFeedback);
	}

	const attachments = movies.map((movie) => ({
		title: `${movie.Title} (${movie.Year})`,
		image_url: movie.Cover,
		callback_id: movie.GroupId,
		actions: [
			{
				name: `selectMovie ${movie.Title}`,
				text: `Select ${movie.Title}`,
				type: 'button',
				value: movie.GroupId,
			},
		],
	}));

	const message = {
		text: `Results for ${query} :`,
		attachments,
	};
	return provideFeedback(message);
}

async function selectMovie(movieTitle, groupId, provideFeedback) {
	const torrents = GroupIdMap[groupId].Torrents.slice(0).sort(sortTorrents).slice(0, 12);
	const attachments = torrents.map((t) => ({
		title: `\
${t.GoldenPopcorn ? ':popcorn: ' : ''}${t.Checked ? ':white_check_mark: ' : ''}\
${t.Quality} / ${t.Codec} / ${t.Container} / ${t.Source} /\
${t.Resolution} ${t.Scene ? '/ Scene ' : ''} ${t.RemasterTitle ? `/ ${t.RemasterTitle}` : ''}`,
		text: `Seeders: ${t.Seeders}, Snatched ${t.Snatched}, Size: ${t.Size / 1073741824} Gb`,
		callback_id: t.Id,
		actions: [
			{
				name: `downloadMovie ${movieTitle}`,
				text: `Download ${movieTitle}`,
				type: 'button',
				value: t.Id,
			},
		],
	}));
	const message = {
		text: `Available versions to download ${movieTitle}:`,
		replace_original: true,
		attachments,
	};
	await provideFeedback(message);
	return torrents;
}

async function downloadMovieModal(resp) {
	const { title, torrentId } = JSON.parse(resp.actions[0].value);
	const viewId = resp.view.id;
	function provideFeedback({ text } = {}) {
		return webMovies.views.update({
			view_id: viewId,
			view: {
				type: 'modal',
				callback_id: 'movieSelectedModal',
				title: {
					type: 'plain_text',
					text: `Downloading Movie`,
				},
				blocks: [
					{
						type: 'section',
						block_id: 'section-identifier',
						text: {
							type: 'mrkdwn',
							text,
						},
					},
				],
			},
		});
	}
	// TODO: Use hash when I add buttons here
	return saveUrlToDropbox({ torrentId, movieTitle: title, provideFeedback, authKey, passKey });
}

async function openMovieSelectedModal(triggerId, { title, id, posterUrl, year }) {
	const resp = await webMovies.views.open({
		trigger_id: triggerId,
		view: {
			type: 'modal',
			callback_id: 'movieSelectedModal',
			title: {
				type: 'plain_text',
				text: `Select Movie Version`,
			},
			blocks: [
				{
					type: 'section',
					block_id: 'section-identifier',
					text: {
						type: 'mrkdwn',
						text: 'loading',
					},
				},
			],
		},
	});
	const viewId = resp.view.id;

	async function provideFeedback({ text } = {}) {
		return webMovies.views.update({
			view_id: viewId,
			view: {
				type: 'modal',
				callback_id: 'movieSelectedModal',
				title: {
					type: 'plain_text',
					text: `Select Movie Version`,
				},
				blocks: [
					{
						type: 'section',
						block_id: 'section-identifier',
						text: {
							type: 'mrkdwn',
							text,
						},
					},
				],
			},
		});
	}

	const torrents = await searchAndRespond({
		query: title,
		provideFeedback,
		retry: true,
		groupId: id,
	});
	// TODO: Use hash when I add buttons here

	const blocks = [];
	torrents.forEach((t) => {
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `\
*${t.GoldenPopcorn ? ':popcorn: ' : ''}${t.Checked ? ':white_check_mark: ' : ''}\
${t.Quality} / ${t.Codec} / ${t.Container} / ${t.Source} /\
${t.Resolution} ${t.Scene ? '/ Scene ' : ''} ${t.RemasterTitle ? `/ ${t.RemasterTitle}` : ''}*
Seeders: ${t.Seeders}, Snatched ${t.Snatched}, Size: ${t.Size / 1073741824} Gb`,
			},
			accessory: {
				type: 'button',
				text: {
					type: 'plain_text',
					text: `Download ${title}`,
				},
				action_id: `downloadMovieAppHome ${title}`,
				value: JSON.stringify({ title, torrentId: t.Id, id, posterUrl, year }),
			},
		});
	});

	return webMovies.views.update({
		view_id: viewId,
		view: {
			type: 'modal',
			callback_id: 'movieSelectedModal',
			title: {
				type: 'plain_text',
				text: `Select Movie Version`,
			},
			blocks,
		},
	});
}

function addPtpSlackRoute(app) {
	app.post('/slash-command', (req, res) => {
		res.status(200).end();
		const reqBody = req.body;
		const responseURL = reqBody.response_url;
		const query = reqBody.text;
		async function provideFeedback(message) {
			return sendMessageToSlackResponseURL(responseURL, message);
		}

		if (reqBody.token !== process.env.PTP_SLACK_VERIFICATION_TOKEN) {
			res.status(403).end('Access forbidden');
		} else if (!query || !query.length) {
			sendTopTenMoviesOfTheWeek(provideFeedback);
		} else {
			const retry = true;
			searchAndRespond({ query, provideFeedback, retry });
		}
	});

	app.post('/action-endpoint', (req, res) => {
		if (req.body.type === 'url_verification') {
			res.send(req.body.challenge).status(200).end();
			return;
		}
		if (req.body.type === 'event_callback') {
			const { event } = req.body;
			const { user, type } = event;
			if (type === 'app_home_opened') {
				publishViewForUser(user);
			}
			res.status(200).end();
			return;
		}
		const payload = JSON.parse(req.body.payload);
		if (payload.type === 'block_actions') {
			if (payload.view && payload.view.type === 'home') {
				if (payload.actions[0].action_id.indexOf('selectMovieAppHome') === 0) {
					openMovieSelectedModal(
						payload.trigger_id,
						JSON.parse(payload.actions[0].value)
					);
				} else if (payload.actions[0].action_id.indexOf('searchMovieAppHome') === 0) {
					console.log(JSON.stringify(payload));
					// TODO: open search results modal
				}
			} else if (payload.view && payload.view.type === 'modal') {
				if (payload.actions[0].action_id.indexOf('downloadMovieAppHome') === 0) {
					downloadMovieModal(payload);
				}
			}
			res.status(200).end();
			return;
		}
		res.status(200).end();

		if (payload.token !== process.env.PTP_SLACK_VERIFICATION_TOKEN) {
			res.status(403).end('Access forbidden');
			return;
		}

		if (!payload.actions) {
			// This is not a legacy slash comand, so it's probably a workflow
			return;
		}
		const { name, value: groupId } = payload.actions[0];

		async function provideFeedback(message) {
			return sendMessageToSlackResponseURL(payload.response_url, message);
		}
		if (name.indexOf('searchMovie') === 0) {
			const query = name.split('searchMovie ')[1];
			const retry = true;
			searchAndRespond({ query, provideFeedback, retry, groupId });
		} else if (name.indexOf('selectMovie') === 0) {
			const movieTitle = name.split('selectMovie ')[1];
			selectMovie(movieTitle, groupId, provideFeedback);
		} else if (name.indexOf('downloadMovie') === 0) {
			const torrentId = payload.actions[0].value;
			const movieTitle = payload.actions[0].name.split('downloadMovie ')[1];

			saveUrlToDropbox({ torrentId, movieTitle, provideFeedback, authKey, passKey });
		} else {
			// Unknown action!
		}
	});
}

module.exports = addPtpSlackRoute;
