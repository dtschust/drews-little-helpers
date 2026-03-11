import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import './utils/mongoose-connect';
import Notification from './mongoose-models/Notification';

type CreateNotifQuery = {
	message?: string;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function addNotifsRoute(fastify: FastifyInstance) {
	fastify.post(
		'/notifs',
		async (request: FastifyRequest<{ Querystring: CreateNotifQuery }>, reply: FastifyReply) => {
			const { message } = request.query;

			if (!message) {
				reply.code(400).send({ error: 'Missing `message` query parameter' });
				return;
			}

			try {
				await Notification.create({
					timestamp: Date.now(),
					message,
				});
				reply.code(201).send();
			} catch (error) {
				console.error(error);
				reply.code(500).send({ error: 'Failed to create notification' });
			}
		}
	);

	fastify.get('/notifs', async (_request, reply) => {
		try {
			const notifications = await Notification.find({}).sort({ timestamp: -1 }).lean().exec();
			reply.code(200).send(notifications);

			const cutoff = Date.now() - SEVEN_DAYS_MS;
			void Notification.deleteMany({ timestamp: { $lt: cutoff } }).catch((error) => {
				console.error('Failed to cleanup old notifications', error);
			});
		} catch (error) {
			console.error(error);
			reply.code(500).send({ error: 'Failed to load notifications' });
		}
	});
}
