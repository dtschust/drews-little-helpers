/*
TODO: Ability to refresh the Spotify API token. https://developer.spotify.com/documentation/general/guides/authorization-guide/#authorization-code-flow
I should be able to post to https://accounts.spotify.com/api/token with application/x-www-form-urlencoded
{
	grant_type: 'refresh_token',
	refresh_token: '',
	client_id: '',
	client_secret: ''
}

response will contain:
{
	access_token: '',
}

TODO: Ok, so I need to store the access token and refresh token in mongodb. On each
status check, if it fails I'll need to use the refresh token to get a new access token,
persist that to mongo db, and then refetch.
*/

require('isomorphic-fetch');
require('dotenv').config();
const childProcess = require('child_process');
const path = require('path');
const fs = require('fs');

const _ = require('lodash');

const { WebClient } = require('@slack/client');

const spotifyToken = process.env.SPOTIFY_TOKEN || '';
const token = process.env.SLACK_EMOJI_TOKEN || '';
const web = new WebClient(token);

let lastPlayingSongId = null;

async function getCurrentlyPlayingTrack() {
	const data = await fetch(
		'https://api.spotify.com/v1/me/player/currently-playing?market=us',
		{
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				Authorization: `Bearer ${spotifyToken}`,
			},
		},
	)
		.then(resp => resp.json())
		.catch(err => {
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

	const status = `:musical_note: Now Playing: ${songName} - ${artist}`;
	return {
		data,
		songName,
		albumArt,
		status,
	};
}

function downloadFile(fileUrl, DOWNLOAD_DIR = '.') {
	return new Promise((resolve, reject) => {
		// extract the file name
		const fileName = 'album.jpg';

		// compose the wget command
		const wget = `wget -P ${DOWNLOAD_DIR} -O album.jpg ${fileUrl}`;

		// excute wget using childProcess' exec function
		childProcess.exec(wget, (err, stdout, stderr) =>
			err ? reject(err) : resolve(fileName),
		);
	});
}

async function uploadNewAlbumArtEmoji() {
	return web
		.apiCall('emoji.remove', {
			mode: 'data',
			name: 'drew_currently_playing_album',
		})
		.then(() =>
			web.apiCall('emoji.add', {
				mode: 'data',
				name: 'drew_currently_playing_album',
				image: fs.readFileSync(path.resolve('.', 'album.jpg')),
			}),
		)
		.catch(err => {
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

async function updateStatus(status) {
	const profile = {
		status_text: status,
		status_emoji: ':drew_currently_playing_album:',
		status_expiration: (Date.now() + 5 * 60 * 1000) / 1000, // Five minutes from now
	};
	lastProfileSet = profile;
	return web.users.profile.set({
		profile,
	});
}

async function main() {
	console.log('Maybe updating status');
	const response = await getCurrentlyPlayingTrack();
	const { status, albumArt, error } = response || {};
	if (error) {
		const { status: errorStatus, message } = error;
		if (status === 401) {
			console.log('need to refresh auth');
		}
		console.error(`ERROR ${errorStatus}: ${message}`);
		process.exit(1);
		return;
	}
	if (!status || !albumArt) {
		return;
	}
	console.log(status);
	console.log(albumArt);
	const isStatusSafeToChange = await ensureStatusIsSafeToChange();
	if (!isStatusSafeToChange) {
		return;
		// process.exit(0);
	}
	await downloadFile(albumArt);
	await uploadNewAlbumArtEmoji();
	await updateStatus(status);
}

main();
setInterval(main, 30 * 1000);
