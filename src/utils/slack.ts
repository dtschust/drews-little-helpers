import { WebClient } from '@slack/web-api';
import type { ChatPostMessageArguments } from '@slack/web-api';
import dotenv from 'dotenv';

dotenv.config();

type MessageArgs = Partial<ChatPostMessageArguments>;

export function getDrewsHelpfulRobot() {
	const token = process.env.SLACK_API_TOKEN ?? '';
	const web = new WebClient(token);

	// I think the robot has API limitations, so I'll only use it for the post message
	const robotToken = process.env.SLACK_ROBOT_TOKEN ?? '';
	const webRobot = new WebClient(robotToken);

	const moviesToken = process.env.SLACK_MOVIES_TOKEN ?? '';
	const webMovies = new WebClient(moviesToken);

	function sendMessageToFollowShows(text: string, args: MessageArgs = {}) {
		return webRobot.chat.postMessage({
			channel: process.env.PTP_SLACK_CHANNEL_ID ?? '',
			text,
			link_names: true,
			fallback: 'TODO',
			...args,
		});
	}

	function sendBlockMessageToFollowShows(
		blocks: ChatPostMessageArguments['blocks'],
		args: MessageArgs = {}
	) {
		return webRobot.chat.postMessage({
			channel: process.env.PTP_SLACK_CHANNEL_ID ?? '',
			blocks,
			text: 'TODO',
			link_names: true,
			fallback: 'TODO',
			...args,
		});
	}

	function sendMessageToCronLogs(text: string, args: MessageArgs = {}) {
		return webRobot.chat.postMessage({
			channel: process.env.CRON_LOGS_CHANNEL_ID ?? '',
			text,
			link_names: true,
			fallback: 'TODO',
			...args,
		});
	}

	function sendBlockMessageToCronLogs(
		blocks: ChatPostMessageArguments['blocks'],
		args: MessageArgs = {}
	) {
		return webRobot.chat.postMessage({
			channel: process.env.CRON_LOGS_CHANNEL_ID ?? '',
			blocks,
			text: 'TODO',
			link_names: true,
			fallback: 'TODO',
			...args,
		});
	}

	function sendMessageToFollowShowsAsMovies(text: string, args: MessageArgs = {}) {
		return webMovies.chat.postMessage({
			channel: process.env.PTP_SLACK_CHANNEL_ID ?? '',
			text,
			link_names: true,
			fallback: 'TODO',
			...args,
		});
	}

	function sendBlockMessageToFollowShowsAsMovies(
		blocks: ChatPostMessageArguments['blocks'],
		args: MessageArgs = {}
	) {
		return webMovies.chat.postMessage({
			channel: process.env.PTP_SLACK_CHANNEL_ID ?? '',
			blocks,
			text: 'TODO',
			link_names: true,
			fallback: 'TODO',
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

export function getOtherRobot(token?: string) {
	const web = new WebClient(token ?? '');
	function bindSendMessageToChannel(channel: string) {
		return function sendMessage(text: string) {
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
