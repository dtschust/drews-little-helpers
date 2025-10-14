import dotenv from 'dotenv';
import type { FastifyInstance } from 'fastify';
import { sendMessageToSlackResponseURL } from './utils/ptp';

dotenv.config();

export default function addIFlicksRoute(fastify: FastifyInstance) {
	fastify.post('/iflicks', (request, reply) => {
		const reqBody = (request.body as Record<string, any>) || {};
		const responseURL = process.env.IFLICKS_WEBHOOK_URL;
		if (reqBody.token !== process.env.PTP_SLACK_VERIFICATION_TOKEN) {
			console.log('Early return, access forbidden');
			reply.code(403).send('Access forbidden');
			return;
		}
		if (responseURL) {
			sendMessageToSlackResponseURL(responseURL, {
				text: `${reqBody.text} - converted and ready to watch`,
			});
		}
		reply.code(200).send();
	});
}
