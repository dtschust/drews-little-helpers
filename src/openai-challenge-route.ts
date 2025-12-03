import type { FastifyInstance } from 'fastify';

type TokenOverride = {
	value: string;
	expiresAt: number;
};

let overrideToken: TokenOverride | null = null;

function getActiveToken() {
	if (overrideToken) {
		if (Date.now() < overrideToken.expiresAt) {
			return overrideToken.value;
		}
		overrideToken = null;
	}
	return process.env.OPENAI_CHALLENGE_TOKEN;
}

export default function addOpenaiChallengeRoute(fastify: FastifyInstance) {
	fastify.get('/.well-known/openai-apps-challenge', async (_request, reply) => {
		const token = getActiveToken();

		if (!token) {
			reply.code(500).send('OPENAI_CHALLENGE_TOKEN is not configured');
			return;
		}

		reply.header('content-type', 'text/plain; charset=utf-8').code(200).send(token);
	});

	fastify.get('/setToken/:token', async (request, reply) => {
		const token = (request.params as { token?: string }).token;

		if (!token) {
			reply.code(400).send('Token is required');
			return;
		}

		overrideToken = {
			value: token,
			expiresAt: Date.now() + 10 * 60 * 1000,
		};

		reply
			.header('content-type', 'text/plain; charset=utf-8')
			.code(200)
			.send('Token set for 10 minutes');
	});
}
