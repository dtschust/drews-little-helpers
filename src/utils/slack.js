const { WebClient } = require('@slack/web-api');
require('dotenv').config();

function getDrewsHelpfulRobot() {
	const token = process.env.SLACK_API_TOKEN || '';
	const web = new WebClient(token);

	function sendMessageToFollowShows(text) {
		return web.chat.postMessage({
			channel: process.env.PTP_SLACK_CHANNEL_ID,
			text,
		});
	}

	function sendMessageToCronLogs(text) {
		return web.chat.postMessage({
			channel: process.env.CRON_LOGS_CHANNEL_ID,
			text,
		});
	}

	function sendBlockMessageToFollowShows(blocks) {
		return web.chat.postMessage({
			channel: process.env.PTP_SLACK_CHANNEL_ID,
			blocks,
		});
	}

	return { web, sendMessageToFollowShows, sendMessageToCronLogs, sendBlockMessageToFollowShows };
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
