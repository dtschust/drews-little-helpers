require('dotenv').config();
require('isomorphic-fetch');
const request = require('request');
const mongoose = require('mongoose');
const { Dropbox } = require('dropbox');
const { WebClient } = require('@slack/client');

const token = process.env.SLACK_API_TOKEN || '';
const web = new WebClient(token);

const dbx = new Dropbox({ accessToken: process.env.DROPBOX_TOKEN });

mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGO_DB_URI, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
});

const Cookie = mongoose.model('Cookie', {
	cookie: String,
});

let authKey;
let passKey;

let GroupIdMap = {};

// Wipe the map once an hour
setInterval(() => {
	GroupIdMap = {};
}, 60 * 1000 * 1000);

function sendMessageToSlackResponseURL(responseURL, JSONmessage) {
	const postOptions = {
		uri: responseURL,
		method: 'POST',
		headers: {
			'Content-type': 'application/json',
		},
		json: JSONmessage,
	};
	request(postOptions, (error /* response, body */) => {
		if (error) {
			// TODO: handle errors as you see fit
		}
	});
}

function sortTorrents(a, b) {
	if (a.GoldenPopcorn && !b.GoldenPopcorn) {
		return -1;
	}
	if (b.GoldenPopcorn && !a.GoldenPopcorn) {
		return 1;
	}
	if (
		a.Quality === 'Ultra High Definition' &&
		!b.quality !== 'Ultra High Definition'
	) {
		return -1;
	}

	if (
		b.Quality === 'Ultra High Definition' &&
		!a.quality !== 'Ultra High Definition'
	) {
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
Cookie.findOne(undefined)
	.exec()
	.then((newCookie) => {
		if (newCookie) {
			COOKIE = newCookie.get('cookie');
		}
	});

function getLoginCookies(query, responseURL, retry) {
	let message = {
		text: 'Oops, need to log in again, please hold!',
	};
	sendMessageToSlackResponseURL(responseURL, message);

	request.post(
		'https://passthepopcorn.me/ajax.php?action=login',
		{
			form: {
				username: process.env.PTP_USERNAME,
				password: process.env.PTP_PASSWORD,
				passkey: process.env.PTP_PASSKEY,
				// WhatsYourSecret:
				// 	'Hacker! Do you really have nothing better do than this?',
				keeplogged: 1,
			},
		},
		(error, response) => {
			if (response.statusCode === 403) {
				message = {
					text:
						"Looks like I got captcha-ed and can't login, please stop trying for a bit!",
					replace_original: true,
				};
				sendMessageToSlackResponseURL(responseURL, message);
				return;
			}

			const cookies = response.headers['set-cookie'];
			const cookieString = cookies
				.map((cookie) => `${cookie.split(';')[0]};`)
				.join('');
			COOKIE = cookieString;

			// remove all persisted cookies now that they are bad
			Cookie.remove(undefined, (err) => {
				console.log('Error removing cookie', err);
				// eslint-disable-line no-unused-vars
				const cookieToPersist = new Cookie({ cookie: cookieString });
				// store the new cookie!
				cookieToPersist.save((saveErr) => {
					message = {
						text: `New login succeeded, ${retry ? 'searching again': 'please search again!'}`,
						replace_original: true,
					};
					if (saveErr) {
						message.text = saveErr;
					}
					sendMessageToSlackResponseURL(responseURL, message);
					if (retry) {
						searchAndRespond(query, responseURL, false);
					}
				});
			});
		},
	);
}
function search(query, cb) {
	request(
		{
			url: `https://passthepopcorn.me/torrents.php?json=noredirect&order_by=relevance&searchstr=${query}`,
			headers: {
				cookie: COOKIE,
			},
		},
		cb,
	);
}

function searchAndRespond(query, responseURL, retry = true) {
			search(query, (error, response, body) => {
				let apiResponse;
				try {
					apiResponse = JSON.parse(body);
				} catch (e) {
					console.error('exception parsing JSON body: ', e);
					console.error('Body is ', body);
					getLoginCookies(query, responseURL, retry);
					return;
				}

				authKey = apiResponse.AuthKey;
				passKey = apiResponse.PassKey;

				const movies = apiResponse.Movies.slice(0, 5);
				movies.forEach((movie) => {
					GroupIdMap[movie.GroupId] = movie;
				});

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
				sendMessageToSlackResponseURL(responseURL, message);
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
		} else {
			const retry = true;
			searchAndRespond(query, responseURL, retry);
		}
	});

	app.post('/action-endpoint', (req, res) => {
		res.status(200).end();

		const actionJSONPayload = JSON.parse(req.body.payload);

		if (actionJSONPayload.token !== process.env.PTP_SLACK_VERIFICATION_TOKEN) {
			res.status(403).end('Access forbidden');
			return;
		}
		const { name, value: groupId } = actionJSONPayload.actions[0];

		if (name.indexOf('selectMovie') === 0) {
			const movieTitle = name.split('selectMovie ')[1];
			const torrents = GroupIdMap[groupId].Torrents.slice(0)
				.sort(sortTorrents)
				.slice(0, 8);
			const attachments = torrents.map((t) => ({
				title: `\
${t.GoldenPopcorn ? ':popcorn: ' : ''}${t.Checked ? ':white_check_mark: ' : ''}\
${t.Quality} / ${t.Codec} / ${t.Container} / ${t.Source} /\
${t.Resolution} ${t.Scene ? '/ Scene ' : ''} ${
					t.RemasterTitle ? `/ ${t.RemasterTitle}` : ''
				}`,
				text: `Seeders: ${t.Seeders}, Snatched ${t.Snatched}, Size: ${
					t.Size / 1073741824
				} Gb`,
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
			sendMessageToSlackResponseURL(actionJSONPayload.response_url, message);
		} else if (name.indexOf('downloadMovie') === 0) {
			const torrentId = actionJSONPayload.actions[0].value;
			const movieTitle = actionJSONPayload.actions[0].name.split(
				'downloadMovie ',
			)[1];

			const message = {
				text: `Chill, i'll download ${movieTitle} for you. If I fail, here's the url and you can do it yourself: https://passthepopcorn.me/torrents.php?action=download&id=${torrentId}&authkey=${authKey}&torrent_pass=${passKey}`,
				replace_original: true,
			};
			sendMessageToSlackResponseURL(actionJSONPayload.response_url, message);

			dbx
				.filesSaveUrl({
					url: `https://passthepopcorn.me/torrents.php?action=download&id=${torrentId}&authkey=${authKey}&torrent_pass=${passKey}`,
					path: `/torrents/${Date.now()}.torrent`,
				})
				.then(({ async_job_id: asyncJobId }) => {
					let thirtySecondCheck;
					const checkJobStatus = () => {
						dbx
							.filesSaveUrlCheckJobStatus({
								async_job_id: asyncJobId,
							})
							.then((response) => {
								if (response['.tag'] === 'complete') {
									const successMessage = {
										text: `Successfully placed ${movieTitle} in dropbox, have a great day!`,
										replace_original: true,
									};
									sendMessageToSlackResponseURL(
										actionJSONPayload.response_url,
										successMessage,
									);
									sendMessage(`Started download of *${movieTitle}*`)
									clearTimeout(thirtySecondCheck);
								}
							})
							.catch(() => {
								const failMessage = {
									text: `I'm unable to check the status of job_id ${asyncJobId}, sorry!`,
									replace_original: false,
								};
								sendMessageToSlackResponseURL(
									actionJSONPayload.response_url,
									failMessage,
								);
							});
					};
					setTimeout(checkJobStatus, 5000);
					thirtySecondCheck = setTimeout(checkJobStatus, 30000);
				})
				.catch((error) => {
					const errorMessage = {
						text: `Oops, something went wrong. Sorry, here's your URL to do it manually: https://passthepopcorn.me/torrents.php?action=download&id=${torrentId}&authkey=${authKey}&torrent_pass=${passKey} . ${error}`,
						replace_original: false,
					};
					sendMessageToSlackResponseURL(
						actionJSONPayload.response_url,
						errorMessage,
					);
				});
		} else {
			// Unknown action!
		}
	});
}

module.exports = addPtpSlackRoute;

function sendMessage(text) {
	return web.chat
		.postMessage({
			channel: process.env.PTP_SLACK_CHANNEL_ID,
			text,
		})
		.then(() => {
			console.log('Message sent: ', text);
		})
		.catch(err => {
			console.log('Error:', err);
		});
}
