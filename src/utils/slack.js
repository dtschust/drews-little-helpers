const { WebClient } = require('@slack/web-api');
require('dotenv').config();

function getDrewsHelpfulRobot() {
	const token = process.env.SLACK_API_TOKEN || '';
	const web = new WebClient(token);

	// I think the robot has API limitations, so I'll only use it for the post message
	const robotToken = process.env.SLACK_ROBOT_TOKEN || '';
	const webRobot = new WebClient(robotToken);

	const moviesToken = process.env.SLACK_MOVIES_TOKEN || '';
	const webMovies = new WebClient(moviesToken);

	function sendMessageToFollowShows(text, args = {}) {
		return webRobot.chat.postMessage({
			channel: process.env.PTP_SLACK_CHANNEL_ID,
			text,
			link_names: true,
			...args,
		});
	}

	function sendBlockMessageToFollowShows(blocks, args = {}) {
		return webRobot.chat.postMessage({
			channel: process.env.PTP_SLACK_CHANNEL_ID,
			blocks,
			link_names: true,
			...args,
		});
	}

	function sendMessageToCronLogs(text, args = {}) {
		return webRobot.chat.postMessage({
			channel: process.env.CRON_LOGS_CHANNEL_ID,
			text,
			link_names: true,
			...args,
		});
	}

	function sendBlockMessageToCronLogs(blocks, args = {}) {
		return webRobot.chat.postMessage({
			channel: process.env.CRON_LOGS_CHANNEL_ID,
			blocks,
			link_names: true,
			...args,
		});
	}

	function sendMessageToFollowShowsAsMovies(text, args = {}) {
		return webMovies.chat.postMessage({
			channel: process.env.PTP_SLACK_CHANNEL_ID,
			text,
			link_names: true,
			...args,
		});
	}

	function sendBlockMessageToFollowShowsAsMovies(blocks, args = {}) {
		return webMovies.chat.postMessage({
			channel: process.env.PTP_SLACK_CHANNEL_ID,
			blocks,
			link_names: true,
			...args,
		});
	}

	return {
		web,
		webRobot,
		webMovies,
		sendMessageToFollowShows,
		sendBlockMessageToFollowShows,
		sendMessageToFollowShowsAsMovies,
		sendBlockMessageToFollowShowsAsMovies,
		sendMessageToCronLogs,
		sendBlockMessageToCronLogs,
	};
}

function getOtherRobot(token) {
	const web = new WebClient(token || '');
	function bindSendMessageToChannel(channel) {
		return function sendMessage(text) {
			return web.chat.postMessage({
				channel,
				text,
			});
		};
	}

	return {
		web,
		bindSendMessageToChannel,
	};
}

module.exports = {
	getDrewsHelpfulRobot,
	getOtherRobot,
};
