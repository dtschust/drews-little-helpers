require('isomorphic-fetch');
require('dotenv').config();
const { Dropbox } = require('dropbox');
const { getDrewsHelpfulRobot } = require('./slack');

const { sendMessageToFollowShows } = getDrewsHelpfulRobot();
const dbx = new Dropbox({ accessToken: process.env.DROPBOX_TOKEN });

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

function saveUrlToDropbox({ torrentId, movieTitle, provideFeedback, authKey, passKey } = {}) {
	const message = {
		text: `Chill, i'll download ${movieTitle} for you. If I fail, here's the url and you can do it yourself: https://passthepopcorn.me/torrents.php?action=download&id=${torrentId}&authkey=${authKey}&torrent_pass=${passKey}`,
		replace_original: true,
	};
	provideFeedback(message);

	return dbx
		.filesSaveUrl({
			url: `https://passthepopcorn.me/torrents.php?action=download&id=${torrentId}&authkey=${authKey}&torrent_pass=${passKey}`,
			path: `/torrents/${Date.now()}.torrent`,
		})
		.then(({ async_job_id: asyncJobId, '.tag': tag }) => {
			if (tag === 'complete') {
				const successMessage = {
					text: `Successfully placed ${movieTitle} in dropbox, have a great day!!`,
					replace_original: true,
				};
				provideFeedback(successMessage);
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
							provideFeedback(successMessage);
							sendMessageToFollowShows(`Started download of *${movieTitle}*`);
							clearTimeout(thirtySecondCheck);
						} else {
							const successMessage = {
								text: `Saving ${movieTitle} in dropbox is taking a while, will try again in 30 seconds. This is attempt number ${numTries}. tag=${
									response['.tag']
								} ${JSON.stringify(response)}`,
								replace_original: true,
							};
							provideFeedback(successMessage);
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
						provideFeedback(failMessage);
					});
			};
			setTimeout(checkJobStatus, 5000);
		})
		.catch((error) => {
			const errorMessage = {
				text: `Oops, something went wrong. Sorry, here's your URL to do it manually: https://passthepopcorn.me/torrents.php?action=download&id=${torrentId}&authkey=${authKey}&torrent_pass=${passKey} . ${error}`,
				replace_original: false,
			};
			provideFeedback(errorMessage);
		});
}

module.exports = {
	sortTorrents,
	sendMessageToSlackResponseURL,
	saveUrlToDropbox,
};
