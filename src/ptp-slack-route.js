require('dotenv').config();
require('isomorphic-fetch');
const { Dropbox } = require('dropbox');
require('./utils/mongoose-connect');

const TopMovies = require('./mongoose-models/Top-Movies');
const PtpCookie = require('./mongoose-models/Ptp-Cookie');
const getPtpLoginCookies = require('./utils/get-ptp-login-cookie');
const { getDrewsHelpfulRobot } = require('./utils/slack');

const { sendMessageToFollowShows, webMovies } = getDrewsHelpfulRobot();

const dbx = new Dropbox({ accessToken: process.env.DROPBOX_TOKEN });

let authKey;
let passKey;

let GroupIdMap = {};

// Wipe the map once an hour
setInterval(() => {
	GroupIdMap = {};
}, 60 * 1000 * 1000);

async function sendTopTenMoviesOfTheWeek(responseURL) {
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
	sendMessageToSlackResponseURL(responseURL, message);
}

async function publishViewForUser(user) {
	const { movies } = await TopMovies.findOne(undefined);
	const blocks = [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: '*Top 10 Movies of the Week*',
			},
		},
		{
			type: 'divider',
		},
	];
	movies.forEach(({ title, id, posterUrl, year }) => {
		// TODO: Action buttons
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*${title}* (${year})`,
			},
		});
		blocks.push({
			type: 'image',
			image_url: posterUrl,
			alt_text: title,
		});
		blocks.push({
			type: 'actions',
			elements: [
				{
					type: 'button',
					text: {
						type: 'plain_text',
						text: `${title} (${year})`,
					},
					action_id: `selectMovieAppHome ${title}`,
					value: JSON.stringify({ title, id, posterUrl, year }),
				},
			],
		});
		blocks.push({
			type: 'divider',
		});
	});

	const view = {
		type: 'home',
		title: {
			type: 'plain_text',
			text: 'what is this',
		},
		blocks,
	};

	return webMovies.views.publish({
		user_id: user,
		view: JSON.stringify(view),
	});
}
async function sendMessageToSlackResponseURL(responseURL, JSONmessage) {
	if (!responseURL) return;
	return fetch(responseURL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(JSONmessage),
	});
}

function sortTorrents(a, b) {
	if (a.Quality === 'Ultra High Definition' && !b.quality !== 'Ultra High Definition') {
		return -1;
	}

	if (b.Quality === 'Ultra High Definition' && !a.quality !== 'Ultra High Definition') {
		return 1;
	}

	if (a.GoldenPopcorn && !b.GoldenPopcorn) {
		return -1;
	}
	if (b.GoldenPopcorn && !a.GoldenPopcorn) {
		return 1;
	}

	if (a.Quality === 'High Definition' && !b.quality !== 'High Definition') {
		return -1;
	}

	if (b.Quality === 'High Definition' && !a.quality !== 'High Definition') {
		return 1;
	}

	return 0;
}

let COOKIE;
PtpCookie.findOne(undefined)
	.exec()
	.then((newCookie) => {
		if (newCookie) {
			COOKIE = newCookie.get('cookie');
		}
	});

async function getLoginCookies(query, responseURL, retry, groupId) {
	let message = {
		text: 'Oops, need to log in again, please hold!',
	};
	sendMessageToSlackResponseURL(responseURL, message);

	try {
		COOKIE = await getPtpLoginCookies();
	} catch (e) {
		message = {
			text: "Looks like I got captcha-ed and can't login, please stop trying for a bit!",
			replace_original: true,
		};
		sendMessageToSlackResponseURL(responseURL, message);
		return;
	}

	message = {
		text: `New login succeeded, ${retry ? 'searching again' : 'please search again!'}`,
		replace_original: true,
	};
	sendMessageToSlackResponseURL(responseURL, message);
	if (retry) {
		return searchAndRespond(query, responseURL, false, false, groupId);
	}
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

async function searchAndRespond(
	query,
	responseURL,
	retry = true,
	replaceOriginal = false,
	groupId = undefined
) {
	let apiResponse;
	try {
		apiResponse = await search(query);
	} catch (e) {
		console.error('exception parsing JSON body: ', e);
		return getLoginCookies(query, responseURL, retry, groupId);
	}

	authKey = apiResponse.AuthKey;
	passKey = apiResponse.PassKey;

	const movies = apiResponse.Movies.slice(0, 5);
	movies.forEach((movie) => {
		GroupIdMap[movie.GroupId] = movie;
	});

	if (groupId) {
		// We already know the id of the movie we want, so we can skip the results
		return selectMovie(query, groupId, responseURL);
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
		replace_original: replaceOriginal,
		attachments,
	};
	sendMessageToSlackResponseURL(responseURL, message);
}

function selectMovie(movieTitle, groupId, responseURL) {
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
	sendMessageToSlackResponseURL(responseURL, message);
	return torrents;
}

async function downloadMovieModal(resp) {
	const { title, torrentId } = JSON.parse(resp.actions[0].value);
	const viewId = resp.view.id;
	// TODO: Move this into its own util
	function updateModalWithText(text) {
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

	await updateModalWithText(
		`Chill, i'll download ${title} for you. If I fail, here's the url and you can do it yourself: https://passthepopcorn.me/torrents.php?action=download&id=${torrentId}&authkey=${authKey}&torrent_pass=${passKey}`
	);
	dbx.filesSaveUrl({
		url: `https://passthepopcorn.me/torrents.php?action=download&id=${torrentId}&authkey=${authKey}&torrent_pass=${passKey}`,
		path: `/torrents/${Date.now()}.torrent`,
	})
		.then(({ async_job_id: asyncJobId, '.tag': tag }) => {
			if (tag === 'complete') {
				updateModalWithText(`Successfully placed ${title} in dropbox, have a great day!!!`);
				sendMessageToFollowShows(`Started download of *${title}*`);
				return;
			}
			let thirtySecondCheck;
			let numTries = 0;
			const checkJobStatus = () => {
				dbx.filesSaveUrlCheckJobStatus({
					async_job_id: asyncJobId,
				})
					.then((response) => {
						if (response['.tag'] === 'complete') {
							updateModalWithText(
								`Successfully placed ${title} in dropbox, have a great day!`
							);
							sendMessageToFollowShows(`Started download of *${title}*`);
							clearTimeout(thirtySecondCheck);
						} else {
							updateModalWithText(
								`Saving ${title} in dropbox is taking a while, will try again in 30 seconds. This is attempt number ${numTries}. tag=${
									response['.tag']
								} ${JSON.stringify(response)}`
							);
							numTries += 1;
							if (numTries > 5) {
								clearTimeout(thirtySecondCheck);
								throw new Error('unable to save to dropbox, it appears');
							}
							thirtySecondCheck = setTimeout(checkJobStatus, 30000);
						}
					})
					.catch(() => {
						updateModalWithText(
							`I'm unable to check the status of job_id ${asyncJobId}, sorry!`
						);
					});
			};
			setTimeout(checkJobStatus, 5000);
		})
		.catch((error) => {
			updateModalWithText(
				`Oops, something went wrong. Sorry, here's your URL to do it manually: https://passthepopcorn.me/torrents.php?action=download&id=${torrentId}&authkey=${authKey}&torrent_pass=${passKey} . ${error}`
			);
		});
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
	const torrents = await searchAndRespond(title, undefined, true, false, id);
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
		if (reqBody.token !== process.env.PTP_SLACK_VERIFICATION_TOKEN) {
			res.status(403).end('Access forbidden');
		} else if (!query || !query.length) {
			sendTopTenMoviesOfTheWeek(responseURL);
		} else {
			const retry = true;
			searchAndRespond(query, responseURL, retry);
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

		if (name.indexOf('searchMovie') === 0) {
			const query = name.split('searchMovie ')[1];
			const retry = true;
			const replaceOriginal = true;
			searchAndRespond(query, payload.response_url, retry, replaceOriginal, groupId);
		} else if (name.indexOf('selectMovie') === 0) {
			const movieTitle = name.split('selectMovie ')[1];
			selectMovie(movieTitle, groupId, payload.response_url);
		} else if (name.indexOf('downloadMovie') === 0) {
			const torrentId = payload.actions[0].value;
			const movieTitle = payload.actions[0].name.split('downloadMovie ')[1];

			const message = {
				text: `Chill, i'll download ${movieTitle} for you. If I fail, here's the url and you can do it yourself: https://passthepopcorn.me/torrents.php?action=download&id=${torrentId}&authkey=${authKey}&torrent_pass=${passKey}`,
				replace_original: true,
			};
			sendMessageToSlackResponseURL(payload.response_url, message);

			dbx.filesSaveUrl({
				url: `https://passthepopcorn.me/torrents.php?action=download&id=${torrentId}&authkey=${authKey}&torrent_pass=${passKey}`,
				path: `/torrents/${Date.now()}.torrent`,
			})
				.then(({ async_job_id: asyncJobId, '.tag': tag }) => {
					if (tag === 'complete') {
						const successMessage = {
							text: `Successfully placed ${movieTitle} in dropbox, have a great day!!`,
							replace_original: true,
						};
						sendMessageToSlackResponseURL(payload.response_url, successMessage);
						sendMessageToFollowShows(`Started download of *${movieTitle}*`);
						return;
					}
					let thirtySecondCheck;
					let numTries = 0;
					const checkJobStatus = () => {
						dbx.filesSaveUrlCheckJobStatus({
							async_job_id: asyncJobId,
						})
							.then((response) => {
								if (response['.tag'] === 'complete') {
									const successMessage = {
										text: `Successfully placed ${movieTitle} in dropbox, have a great day!`,
										replace_original: true,
									};
									sendMessageToSlackResponseURL(
										payload.response_url,
										successMessage
									);
									sendMessageToFollowShows(`Started download of *${movieTitle}*`);
									clearTimeout(thirtySecondCheck);
								} else {
									const successMessage = {
										text: `Saving ${movieTitle} in dropbox is taking a while, will try again in 30 seconds. This is attempt number ${numTries}. tag=${
											response['.tag']
										} ${JSON.stringify(response)}`,
										replace_original: true,
									};
									sendMessageToSlackResponseURL(
										payload.response_url,
										successMessage
									);
									numTries += 1;
									if (numTries > 5) {
										clearTimeout(thirtySecondCheck);
										throw new Error('unable to save to dropbox, it appears');
									}
									thirtySecondCheck = setTimeout(checkJobStatus, 30000);
								}
							})
							.catch(() => {
								const failMessage = {
									text: `I'm unable to check the status of job_id ${asyncJobId}, sorry!`,
									replace_original: false,
								};
								sendMessageToSlackResponseURL(payload.response_url, failMessage);
							});
					};
					setTimeout(checkJobStatus, 5000);
				})
				.catch((error) => {
					const errorMessage = {
						text: `Oops, something went wrong. Sorry, here's your URL to do it manually: https://passthepopcorn.me/torrents.php?action=download&id=${torrentId}&authkey=${authKey}&torrent_pass=${passKey} . ${error}`,
						replace_original: false,
					};
					sendMessageToSlackResponseURL(payload.response_url, errorMessage);
				});
		} else {
			// Unknown action!
		}
	});
}

module.exports = addPtpSlackRoute;
