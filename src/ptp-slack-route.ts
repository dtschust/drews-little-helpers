import dotenv from 'dotenv';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import './utils/mongoose-connect';
import { Surfaces, Blocks, Elements, BlockCollection } from 'slack-block-builder';
import TopMovies from './mongoose-models/Top-Movies';
import { getDrewsHelpfulRobot } from './utils/slack';
import { sortTorrents, sendMessageToSlackResponseURL, saveUrlToDropbox } from './utils/ptp';

dotenv.config();

const { sendMessageToCronLogs, webMovies } = getDrewsHelpfulRobot();

type Feedback = (message: any) => Promise<unknown> | unknown;

interface PtpTorrent {
	Id: number;
	GoldenPopcorn: boolean;
	Checked: boolean;
	Quality: string;
	Codec: string;
	Container: string;
	Source: string;
	Resolution: string;
	Scene: boolean;
	RemasterTitle?: string;
	Seeders: number;
	Snatched: number;
	Size: number;
}

interface PtpMovie {
	GroupId: string;
	Title: string;
	Year: string;
	Cover: string;
	ImdbId?: string;
	Torrents: PtpTorrent[];
	[key: string]: unknown;
}

interface SearchResponse {
	AuthKey: string;
	PassKey: string;
	Movies: Array<PtpMovie & { GroupId: string | number; Year: string | number }>;
}

let authKey: string | undefined;
let passKey: string | undefined;
let groupIdMap: Record<string, PtpMovie> = {};

// Wipe the map once an hour
setInterval(
	() => {
		groupIdMap = {};
	},
	60 * 1000 * 1000
);

async function sendTopTenMoviesOfTheWeek(provideFeedback: Feedback) {
	const doc = await TopMovies.findOne(undefined);
	const movies: any[] = doc?.movies ?? [];

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
	return provideFeedback(message);
}

async function publishViewForUser(user: string) {
	const doc = await TopMovies.findOne(undefined);
	const movies: any[] = doc?.movies ?? [];
	const blocks = [
		Blocks.Input()
			.dispatchAction(true)
			.element(
				Elements.TextInput({
					actionId: 'searchMovieAppHome',
				})
			)
			.label('Search for a movie'),
		Blocks.Section().text('*Top 10 Movies of the Week*'),
		Blocks.Divider(),
	];
	movies.forEach(({ title, id, posterUrl, year }) => {
		blocks.push(Blocks.Section().text(`*${title.slice(0, 30)}* (${year})`));
		blocks.push(Blocks.Image({ imageUrl: posterUrl, altText: title }));
		blocks.push(
			Blocks.Actions().elements(
				Elements.Button({
					text: `${title.slice(0, 30)} (${year})`,
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

function sanitizeQuery(query: string) {
	return query.replace(/’/g, "'");
}

async function search(query: string): Promise<SearchResponse> {
	const sanitizedQuery = sanitizeQuery(query);
	const response = await fetch(
		`https://passthepopcorn.me/torrents.php?json=noredirect&order_by=relevance&searchstr=${sanitizedQuery}`,
		{
			headers: {
				ApiUser: process.env.PTP_API_USER ?? '',
				ApiKey: process.env.PTP_API_KEY ?? '',
			},
		}
	);
	return (await response.json()) as SearchResponse;
}

async function searchAndRespond({
	query,
	provideFeedback = () => true,
	retry = true,
	groupId,
}: {
	query: string;
	provideFeedback?: Feedback;
	retry?: boolean;
	groupId?: string;
}) {
	let apiResponse: SearchResponse | undefined;
	try {
		apiResponse = await search(query);
	} catch (e) {
		console.error('exception parsing JSON body: ', e);
		const success = false;
		if (retry && success) {
			return searchAndRespond({
				query,
				provideFeedback,
				retry: false,
				groupId,
			});
		}
	}

	if (!apiResponse) {
		return [];
	}

	authKey = apiResponse.AuthKey;
	passKey = apiResponse.PassKey;

	const movies = (apiResponse.Movies || []).slice(0, 5).map((movie) => ({
		...movie,
		GroupId: String(movie.GroupId),
		Year: String(movie.Year),
		Torrents: Array.isArray(movie.Torrents) ? movie.Torrents : [],
	}));

	movies.forEach((movie) => {
		groupIdMap[movie.GroupId] = movie;
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
	provideFeedback(message);
	return movies;
}

async function selectMovie(movieTitle: string, groupId: string, provideFeedback: Feedback) {
	const movie = groupIdMap[groupId];
	if (!movie) {
		throw new Error(`Unknown movie for group ${groupId}`);
	}
	const torrents = movie.Torrents.slice(0).sort(sortTorrents).slice(0, 12);
	const attachments = torrents.map((t) => ({
		title: `\
${t.GoldenPopcorn ? ':popcorn: ' : ''}${t.Checked ? ':white_check_mark: ' : ''}\
${t.Quality} / ${t.Codec} / ${t.Container} / ${t.Source} /\
${t.Resolution} ${t.Scene ? '/ Scene ' : ''} ${t.RemasterTitle ? `/ ${t.RemasterTitle}` : ''}`,
		text: `Seeders: ${t.Seeders}, Snatched ${t.Snatched}, Size: ${t.Size / 1073741824} Gb`,
		callback_id: t.Id,
		actions: [
			{
				name: `downloadMovie ${movieTitle.slice(0, 30)}`,
				text: `Download ${movieTitle.slice(0, 30)}`,
				type: 'button',
				value: t.Id,
			},
		],
	}));
	const message = {
		text: `Available versions to download ${movieTitle.slice(0, 30)}:`,
		replace_original: true,
		attachments,
	};
	await provideFeedback(message);
	return torrents;
}

async function downloadMovieModal(payload: any) {
	const { title, torrentId } = JSON.parse(payload.actions[0].value);
	const viewId = payload.view.id;
	function provideFeedback({ text }: { text?: string } = {}) {
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

async function openMovieSearchModal(triggerId: string, query = '') {
	const resp = await webMovies.views.open({
		trigger_id: triggerId,
		view: {
			type: 'modal',
			callback_id: 'movieSelectedModal',
			title: {
				type: 'plain_text',
				text: `Select Movie`,
			},
			blocks: [
				{
					type: 'section',
					block_id: 'section-identifier',
					text: {
						type: 'mrkdwn',
						text: `Searching for *${query.slice(0, 30)}*...`,
					},
				},
			],
		},
	});

	const viewId = resp.view.id;

	const movies = (await searchAndRespond({
		query,
		retry: true,
	})) as PtpMovie[];

	const blocks: any[] = [];
	movies.forEach(({ Title: title, GroupId: id, Cover: posterUrl, Year: year }) => {
		blocks.push(Blocks.Section().text(`*${title}* (${year})`));
		blocks.push(Blocks.Image({ imageUrl: posterUrl, altText: title }));
		blocks.push(
			Blocks.Actions().elements(
				Elements.Button({
					text: `${title.slice(0, 30)} (${year})`,
					actionId: `selectMovieAppHome ${title}`,
					value: JSON.stringify({ title, id, posterUrl, year }),
				})
			)
		);
		blocks.push(Blocks.Divider());
	});
	return webMovies.views.update({
		view_id: viewId,
		view: {
			type: 'modal',
			callback_id: 'movieSelectedModal',
			title: {
				type: 'plain_text',
				text: `Select Movie`,
			},
			blocks: BlockCollection(blocks),
		},
	});
}

async function openMovieSelectedModal(
	{ triggerId, viewId: inViewId }: { triggerId?: string; viewId?: string },
	{ title, id, posterUrl, year }: { title: string; id: string; posterUrl: string; year: string }
) {
	let viewId: string;
	if (!inViewId) {
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
		viewId = resp.view.id;
	} else {
		viewId = inViewId;
	}

	async function provideFeedback({ text }: { text?: string } = {}) {
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

	const torrents = (await searchAndRespond({
		query: title,
		provideFeedback,
		retry: true,
		groupId: id,
	})) as PtpTorrent[];
	// TODO: Use hash when I add buttons here

	const blocks = torrents.map((t) => ({
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
				text: `Download ${title.slice(0, 30)}`,
			},
			action_id: `downloadMovieAppHome ${title}`,
			value: JSON.stringify({ title, torrentId: t.Id, id, posterUrl, year }),
		},
	}));

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

export default function addPtpSlackRoute(fastify: FastifyInstance) {
	fastify.get(
		'/get-top-movies/:username',
		async (request: FastifyRequest<{ Params: { username: string } }>, reply: FastifyReply) => {
			try {
				const { username } = request.params;
				if (username !== 'brook') {
					reply.code(500).send();
					return;
				}
			} catch (e) {
				reply.code(500).send();
				return;
			}
			try {
				const doc = await TopMovies.findOne(undefined);
				const movies: any[] = doc?.movies ?? [];
				const result = movies.map(({ title, posterUrl, year, imdbId }) => ({
					title,
					poster_url: posterUrl,
					year,
					imdb_id: imdbId,
				}));
				reply.code(200).send(result);
			} catch (e) {
				console.log(e);
				reply.code(200).send();
				// don't care
			}
		}
	);

	fastify.post('/update-top-movies', async (request, reply) => {
		const reqBody = (request.body as any) || {};
		if (reqBody.token !== process.env.PTP_SLACK_VERIFICATION_TOKEN) {
			reply.code(403).send('Access forbidden');
			return;
		}
		try {
			const { movies } = reqBody;
			if (movies && movies.length) {
				const topMoviesModel = new TopMovies({
					movies,
				});
				await TopMovies.deleteMany();
				await topMoviesModel.save();
			}
			sendMessageToCronLogs(`✅ Successfully loaded top movies! Movies in 🧵`).then(
				({ ts }) => {
					if (ts) {
						sendMessageToCronLogs(
							movies.map(({ title }: any) => `• ${title}`).join('\n'),
							{
								thread_ts: ts,
							}
						);
					}
				}
			);
			reply.code(200).send();
		} catch (e) {
			console.log(e);
			reply.code(200).send();
			// don't care
		}
	});

	fastify.post('/slash-command', (request, reply) => {
		const reqBody = (request.body as any) || {};
		if (reqBody.token !== process.env.PTP_SLACK_VERIFICATION_TOKEN) {
			reply.code(403).send('Access forbidden');
			return;
		}
		reply.code(200).send();

		const responseURL = reqBody.response_url;
		const query = reqBody.text;
		async function provideFeedback(message: any) {
			return sendMessageToSlackResponseURL(responseURL, message);
		}

		if (!query || !query.length) {
			sendTopTenMoviesOfTheWeek(provideFeedback);
		} else {
			const retry = true;
			searchAndRespond({ query, provideFeedback, retry });
		}
	});

	fastify.post('/action-endpoint', (request, reply) => {
		const body = (request.body as any) || {};
		if (body.type === 'url_verification') {
			reply.code(200).send(body.challenge);
			return;
		}
		if (body.type === 'event_callback') {
			const { event } = body;
			const { user, type } = event;
			if (type === 'app_home_opened') {
				publishViewForUser(user);
			}
			reply.code(200).send();
			return;
		}
		const payload = JSON.parse(body.payload);
		if (payload.token !== process.env.PTP_SLACK_VERIFICATION_TOKEN) {
			reply.code(403).send('Access forbidden');
			return;
		}
		if (payload.type === 'block_actions') {
			if (payload.view && payload.view.type === 'home') {
				if (payload.actions[0].action_id.indexOf('selectMovieAppHome') === 0) {
					openMovieSelectedModal(
						{ triggerId: payload.trigger_id },
						JSON.parse(payload.actions[0].value)
					);
				} else if (payload.actions[0].action_id.indexOf('searchMovieAppHome') === 0) {
					openMovieSearchModal(payload.trigger_id, payload.actions[0].value);
				}
			} else if (payload.view && payload.view.type === 'modal') {
				if (payload.actions[0].action_id.indexOf('selectMovieAppHome') === 0) {
					openMovieSelectedModal(
						{ viewId: payload.view.id },
						JSON.parse(payload.actions[0].value)
					);
				} else if (payload.actions[0].action_id.indexOf('downloadMovieAppHome') === 0) {
					downloadMovieModal(payload);
				}
			}
			reply.code(200).send();
			return;
		}
		reply.code(200).send();

		if (!payload.actions) {
			// This is not a legacy slash comand, so it's probably a workflow
			return;
		}
		const { name, value: groupId } = payload.actions[0];

		async function provideFeedback(message: any) {
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
