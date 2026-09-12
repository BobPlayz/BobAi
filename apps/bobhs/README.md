# BobHS

BobHS is BobAI's self-owned hosting layer. v0.1 adds a controller and node agent so BobAI can schedule containerized workloads onto machines we control instead of being tied to one commercial host.

## Quick start

Set `BOBAHS_MODE=controller`, `BOBAHS_CONTROLLER_TOKEN`, and `BOBAHS_JOIN_TOKEN` to random secrets of at least 32 characters. Run `npm install`, then `npm run bobhs`. The controller defaults to `127.0.0.1:8787`.

Check it with `GET http://127.0.0.1:8787/health`. Register a node with `POST /v1/nodes/register` using the join token and a JSON body such as `{"name":"dell7490","cpuCount":4,"memoryMb":8192,"labels":["windows","local-ai"]}`. The response contains a node ID and node token. The node token is shown once and must be stored outside git.

Run the node agent with `BOBAHS_MODE=node`, `BOBAHS_CONTROLLER_URL=http://127.0.0.1:8787`, `BOBAHS_NODE_ID=<returned-id>`, and `BOBAHS_NODE_TOKEN=<returned-token>`. Docker must be installed and running on the node. The node agent then polls for work and starts assigned images with bounded resources and hardened container flags.

Create a deployment from the controller with `POST /v1/deployments` and an authorization bearer token. Example body: `{"name":"hello","image":"nginx:alpine","replicas":1,"memoryMb":256,"cpus":0.5,"containerPort":80,"hostPort":8080}`. Check `GET /v1/deployments` until the deployment is `running`, then stop it with `POST /v1/deployments/<id>/stop`.

## Security

BobHS stores only node-token hashes. Controller and node APIs use bearer tokens and deployment input is tightly validated. Containers are started without privileged mode, with all Linux capabilities dropped, no-new-privileges, PID/memory/CPU limits, read-only roots, and a bounded tmpfs. Arbitrary host mounts, Docker socket mounts, shell commands, and capability additions are not accepted by the deployment API.

The controller should stay behind a private network or TLS reverse proxy until production ingress is implemented. Never expose a Docker daemon or BobHS join token publicly. v0.1 is not yet a multi-controller cloud: state is a local JSON file and there is no replicated database, persistent-volume scheduler, registry, rolling deployment engine, log streaming, automatic failover, or TLS termination.
