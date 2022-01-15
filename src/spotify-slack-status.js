require('isomorphic-fetch');
require('dotenv').config();
const childProcess = require('child_process');
const path = require('path');
const fs = require('fs');

const _ = require('lodash');

const { WebClient } = require('@slack/client');

let spotifyToken = process.env.SPOTIFY_TOKEN || '';
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const spotifyRefreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
const token = process.env.SLACK_EMOJI_TOKEN || '';
const web = new WebClient(token);

let lastPlayingSongId = null;

async function getNewSpotifyToken() {
	console.log('fetching new spotify token');
	const data = await fetch(
		`https://accounts.spotify.com/api/token?grant_type=refresh_token&refresh_token=${spotifyRefreshToken}&client_id=${spotifyClientId}&client_secret=${spotifyClientSecret}`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		}
	)
		.then((resp) => resp.json())
		.catch((err) => {
			console.error(err);
			throw err;
		});

	const { access_token: accessToken } = data;
	spotifyToken = accessToken;
	console.log('New spotify token fetched!', accessToken);
	return accessToken;
}

async function getCurrentlyPlayingTrack() {
	const data = await fetch('https://api.spotify.com/v1/me/player/currently-playing?market=us', {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${spotifyToken}`,
		},
	})
		.then((resp) => resp.json())
		.catch((err) => {
			console.error(err);
			throw err;
		});

	const error = _.get(data, 'error');
	if (error) {
		return {
			error,
		};
	}

	const isPlaying = _.get(data, 'is_playing');
	if (!isPlaying) {
		console.log('No song playing');
		console.log('nothing is playing, cleaning up');
		lastPlayingSongId = null;
		await writePlaceholderCustomEmoji();
		const isStatusSafeToChange = await ensureStatusIsSafeToChange();
		if (isStatusSafeToChange) {
			await clearStatus();
		}
		return {};
	}

	if (lastPlayingSongId && _.get(data, 'item.id') === lastPlayingSongId) {
		console.log('Song has not changed, nothing to do');
		return {};
	}

	lastPlayingSongId = _.get(data, 'item.id');

	const artist = _.get(data, 'item.artists', [{ name: 'Unknown Arist' }])
		.map(({ name }) => name)
		.join(', ');
	const songName = _.get(data, 'item.name');
	const albumArt = _.get(data, 'item.album.images[1].url');
	const duration = _.get(data, 'item.duration_ms');

	const status = `:musical_note: Now Playing: ${songName} - ${artist}`.slice(0, 100);
	return {
		data,
		songName,
		albumArt,
		status,
		duration,
	};
}

function downloadFile(fileUrl, DOWNLOAD_DIR = '.') {
	return new Promise((resolve, reject) => {
		// extract the file name
		const fileName = 'album.jpg';

		// compose the wget command
		const wget = `wget -P ${DOWNLOAD_DIR} -O album.jpg ${fileUrl}`;

		// excute wget using childProcess' exec function
		// eslint-disable-next-line no-unused-vars
		childProcess.exec(wget, (err, stdout, stderr) => (err ? reject(err) : resolve(fileName)));
	});
}

async function maybeDeleteCustomEmoji() {
	return web
		.apiCall('emoji.remove', {
			mode: 'data',
			name: 'drew_currently_playing_album',
		})
		.then(() => {
			console.log('custom emoji deleted');
		})
		.catch(() => {
			console.log('no custom emoji to delete, but that is ok.');
		});
}

async function writePlaceholderCustomEmoji() {
	return uploadNewAlbumArtEmoji('noMusic.png');
}

async function uploadNewAlbumArtEmoji(filename = 'album.jpg') {
	return maybeDeleteCustomEmoji()
		.then(() =>
			web.apiCall('emoji.add', {
				mode: 'data',
				name: 'drew_currently_playing_album',
				image: fs.readFileSync(path.resolve('.', filename)),
			})
		)
		.catch((err) => {
			console.error(err);
			throw err;
		});
}

let lastProfileSet = null;

async function ensureStatusIsSafeToChange() {
	const { profile } = await web.users.profile.get();
	const { status_text: statusText, status_emoji: statusEmoji } = profile;
	if (_.isEmpty(statusText) && _.isEmpty(statusEmoji)) {
		return true;
	}

	if (
		lastProfileSet &&
		lastProfileSet.status_text === statusText &&
		lastProfileSet.status_emoji
	) {
		return true;
	}

	if (statusText.indexOf(':musical_note:') === 0) {
		return true;
	}

	console.log('Status has been manually changed, not safe to update!');
	return false;
}

async function updateStatus(
	status,
	emoji = ':drew_currently_playing_album:',
	duration = 5 * 60 * 1000
) {
	const profile = {
		status_text: status,
		status_emoji: emoji,
		status_expiration: (Date.now() + duration) / 1000, // Five minutes from now, or the length of the song
	};
	lastProfileSet = profile;
	return web.users.profile.set({
		profile,
	});
}

async function clearStatus() {
	console.log('Clearing status');
	const profile = {
		status_text: '',
		status_emoji: '',
		status_expiration: 0,
	};
	return web.users.profile
		.set({
			profile,
		})
		.then(() => {
			console.log('status cleared.');
		});
}

async function main() {
	console.log('Maybe updating status');
	const response = await getCurrentlyPlayingTrack();
	const { status, albumArt, error, duration } = response || {};
	if (error) {
		const { status: errorStatus, message } = error;
		if (status === 401) {
			console.log('need to refresh auth');
		}
		console.error(`ERROR ${errorStatus}: ${message}`);
		await getNewSpotifyToken();
		main();
		return;
	}
	if (!status) {
		return;
	}
	console.log(status);
	console.log(albumArt);
	const isStatusSafeToChange = await ensureStatusIsSafeToChange();
	if (!isStatusSafeToChange) {
		return;
	}
	if (albumArt) {
		await downloadFile(albumArt);
		await uploadNewAlbumArtEmoji();
	}
	await updateStatus(status, albumArt ? undefined : ':dancing_penguin:', duration);
}

main();
setInterval(main, 30 * 1000);

process.stdin.resume(); // so the program will not close instantly

async function exitHandler(/* options, exitCode */) {
	await writePlaceholderCustomEmoji();

	const isStatusSafeToChange = await ensureStatusIsSafeToChange();
	if (isStatusSafeToChange) {
		await clearStatus();
	}
	process.exit();
	// console.log('exiting', options, exitCode);
	// if (options.cleanup) console.log('clean');
	// if (exitCode || exitCode === 0) console.log(exitCode);
	// if (options.exit) process.exit();
}

// do something when app is closing
// process.on('exit', exitHandler.bind(null, { cleanup: true }));

// catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// catches "kill pid" (for example: nodemon restart)
// process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
// process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

// catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
