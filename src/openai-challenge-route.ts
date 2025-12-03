import type { FastifyInstance } from 'fastify';

export default function addOpenaiChallengeRoute(fastify: FastifyInstance) {
	fastify.get('/.well-known/openai-apps-challenge', async (_request, reply) => {
		const token = process.env.OPENAI_CHALLENGE_TOKEN;

		if (!token) {
			reply.code(500).send('OPENAI_CHALLENGE_TOKEN is not configured');
			return;
		}

		reply.header('content-type', 'text/plain; charset=utf-8').code(200).send(token);
	});
}
