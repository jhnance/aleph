import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

fastify.get('/health', async () => ({ status: 'ok' }));

try {
  await fastify.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
