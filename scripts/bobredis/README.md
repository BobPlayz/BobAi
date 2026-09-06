# BobRedis

BobRedis is BobAI's small Redis-compatible in-memory service. It intentionally implements the primitives BobAI needs instead of trying to reproduce every Redis feature.

Supported commands: `PING`, `AUTH`, `GET`, `SET`, `DEL`, `EXISTS`, `EXPIRE`, `TTL`, `INCR`, `DECR`, `LPUSH`, `RPUSH`, `LPOP`, `RPOP`, `LLEN`, `TYPE`, `DBSIZE`, `MEMORY USAGE`, `INFO`, `FLUSHDB`, `PUBLISH`, `SUBSCRIBE`, `UNSUBSCRIBE`, `QUIT`.

`SET` supports `NX`, `XX`, `EX`, and `PX`.

Defaults: port `6380`, append-only file `./data/bobredis.aof`, max memory `256 MiB`. Set `BOBREDIS_PASSWORD` to require authentication.

Run locally with `npm run bobredis`. Docker: `docker build -t bobredis ./apps/bobredis` then `docker run --rm -p 6380:6380 -v bobredis-data:/data -e BOBREDIS_PASSWORD=change-me bobredis`.

Neon/Postgres remains BobAI's durable source of truth; BobRedis is the fast shared cache/queue layer.
