# Kubernetes (local)

Manifests live in `infra/k8s/`; this doc covers running them locally
(minikube) before deploying to a real cluster. Mirrors `docker-compose.yml`:
the app + a Mongo instance, no Redis (app falls back to in-memory cache, see
root `CLAUDE.md`).

| File | What it is |
|---|---|
| `namespace.yaml` | `nestjs-base` namespace |
| `configmap.yaml` | non-secret env vars |
| `secret.example.yaml` | template — copy to `secret.yaml` (git-ignored) and fill in real values |
| `mongo.yaml` | PVC + Deployment + Service for local Mongo |
| `deployment.yaml` | app Deployment (probes, resource limits, security context) |
| `service.yaml` | NodePort Service for the app (`8080` → node port `30080`) |
| `kustomization.yaml` | ties the above together for `kubectl apply -k` |

## First-time setup

```bash
minikube start --ports=8080:30080
```
`--ports=8080:30080` publishes the app's NodePort (`30080`, set in
`service.yaml`) straight to `localhost:8080` on your Mac, at the Docker
container level — this is what makes `localhost:8080` work with no
`kubectl port-forward` needed (see next section). It only needs to be passed
once, when the cluster is created; a plain `minikube start` on subsequent
days reuses the same container and keeps the mapping.

```bash
eval $(minikube docker-env)
```
```bash
docker build -t nestjs-base:latest .
```
```bash
cp infra/k8s/secret.example.yaml infra/k8s/secret.yaml
```
Edit `JWT_SECRET` in `infra/k8s/secret.yaml`, then:
```bash
kubectl apply -k infra/k8s
```
```bash
kubectl -n nestjs-base get pods -w
```
Wait until both `mongo-...` and `nestjs-base-...` show `1/1 Running`.

`eval $(minikube docker-env)` points your shell's `docker` CLI at minikube's
own Docker daemon, so the image is built directly inside the cluster —
no registry push needed. Run it again any time you open a new terminal and
need to rebuild.

## ClusterIP vs NodePort

- **ClusterIP** (the default) gives a Service a virtual IP reachable only
  *inside* the cluster — no port opens on the host. That's what `mongo.yaml`
  uses: nothing outside the cluster needs to reach Mongo directly.
- **NodePort** does everything ClusterIP does, plus opens a fixed port
  (30000-32767, here `30080`) on every node. With a normal cluster that's
  enough to reach it from outside. With minikube's `docker` driver, though,
  the "node" is itself a Docker container, so NodePort alone still doesn't
  reach your Mac's `localhost` — that's why the cluster is started with
  `--ports=8080:30080`: it publishes that node port to the host the same way
  `docker run -p` would.
- `nestjs-base` (`service.yaml`) uses `NodePort` because it needs a stable
  entrypoint from the host without a manual `kubectl port-forward`. `mongo`
  stays `ClusterIP` because only the app talks to it.

## Accessing the app

`service.yaml` is `NodePort` with a fixed `nodePort: 30080`, and the cluster
is started with `--ports=8080:30080` (see above) — so as long as the cluster
is up, `http://localhost:8080` and `http://localhost:8080/swagger` just work.
No `kubectl port-forward`, no extra terminal to keep open.

This only holds for the *same* minikube container: the port mapping is set
once at `minikube start --ports=...` and persists across `minikube stop` /
`minikube start`, but is lost if you `minikube delete` — recreate with
`--ports=8080:30080` again afterwards (see "First-time setup").

If you ever change `service.yaml` back to `ClusterIP`, or need a quick check
from a machine/cluster where the `--ports` mapping wasn't set up, fall back to
a manual forward:
```bash
kubectl -n nestjs-base port-forward svc/nestjs-base 8080:8080
```
This blocks in the foreground — keep that terminal open while you work, and
`Ctrl+C` it when done (check for stray processes with `pgrep -fl port-forward`).

If pods are `Running` but you still can't connect, check in this order:
1. `kubectl -n nestjs-base get svc nestjs-base` — is it `NodePort` with `30080`?
2. Was the cluster started with `--ports=8080:30080`? (`minikube delete` wipes this — see above)
3. `kubectl -n nestjs-base get pods` — pods actually `1/1 Ready`, not just `Running`?

## Rebuilding after a code change

Deployment uses `image: nestjs-base:latest` with `imagePullPolicy: IfNotPresent`,
so Kubernetes won't notice a rebuilt image on its own — force a rollout:

```bash
eval $(minikube docker-env)
```
```bash
docker build -t nestjs-base:latest .
```
```bash
kubectl -n nestjs-base rollout restart deployment/nestjs-base
```
```bash
kubectl -n nestjs-base rollout status deployment/nestjs-base
```

## Changing config or secrets

Non-secret vars go in `configmap.yaml`; secrets (`JWT_SECRET`, `MONGO_URI`,
...) go in your local `secret.yaml`. Either way, a running pod does **not**
pick up the change automatically — apply, then restart:

```bash
kubectl apply -k infra/k8s
```
```bash
kubectl -n nestjs-base rollout restart deployment/nestjs-base
```

## Day-to-day commands

| Task | Command |
|---|---|
| List pods | `kubectl -n nestjs-base get pods` |
| Follow app logs | `kubectl -n nestjs-base logs -f -l app=nestjs-base` |
| Follow mongo logs | `kubectl -n nestjs-base logs -f -l app=mongo` |
| Debug a pod | `kubectl -n nestjs-base describe pod -l app=nestjs-base` |
| Mongo shell | `kubectl -n nestjs-base exec -it deploy/mongo -- mongosh` |
| Everything in the namespace | `kubectl -n nestjs-base get all` |

## Stopping / cleaning up

```bash
minikube stop
```
Keeps the cluster (and Mongo data) on disk; `minikube start` resumes it later.

```bash
kubectl delete -k infra/k8s
```
Removes the app/namespace/PVC but keeps the minikube cluster itself.

```bash
minikube delete
```
Wipes the cluster entirely, including the `--ports` host mapping (needed if
it gets into a bad state) — after this, redo "First-time setup" above,
`--ports=8080:30080` included.

## Resuming after a reboot / Docker Desktop restart

The cluster survives, but its container ports and internal state can drift:

```bash
minikube start
```

If `kubectl` commands then fail to connect (`kubeconfig: Misconfigured` in
`minikube status`), Docker Desktop reassigned the API server's port:

```bash
minikube update-context
```

If the app pod crashes right after this with a Mongo `EAI_AGAIN` DNS error in
its logs, CoreDNS restarted at the same time and wasn't ready yet when the
app tried to connect — it's transient, just recreate the pod:

```bash
kubectl -n nestjs-base delete pod -l app=nestjs-base
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `kubeconfig: Misconfigured` | Docker Desktop changed the minikube container's port after a restart | `minikube update-context` |
| App pod errors right after cluster start, logs show `EAI_AGAIN` | CoreDNS not ready yet when the app connected to Mongo | `kubectl -n nestjs-base delete pod -l app=nestjs-base` |
| `ImagePullBackOff` / `pull access denied` for `nestjs-base:latest` | Image was never built into minikube's Docker daemon (forgot `eval $(minikube docker-env)` before `docker build`) | Rebuild per "First-time setup" |
| `CreateContainerConfigError`: `runAsNonRoot ... non-numeric user` | Base image's user isn't a numeric UID, so kubelet can't verify non-root | Already pinned via `runAsUser: 65532` in `deployment.yaml` (the distroless `nonroot` UID) — revisit if the base image changes |
| `docker build`/image pull fails with `no space left on device` | Host disk nearly full | `docker builder prune -af` frees Docker's own build cache (safe, regenerable); if still low, free up disk space on the Mac itself |
| Pods `Running` but `localhost:8080` refuses connections | Cluster wasn't started with `--ports=8080:30080` (e.g. after a `minikube delete`) | `minikube delete` then `minikube start --ports=8080:30080`, or fall back to `kubectl -n nestjs-base port-forward svc/nestjs-base 8080:8080` |

## Why plain Kustomize instead of Helm

Kustomize (native `kubectl apply -k`) was chosen over Helm for this setup:

| | Kustomize | Helm |
|---|---|---|
| Strengths | Ships with `kubectl`, no extra tool; pure YAML + patches — what you read is what gets applied; a natural fit for base + per-env overlays | Versioned releases with `helm upgrade`/`rollback`; real templating (loops, conditionals) for many env-specific values; huge ecosystem of ready-made charts (databases, ingress controllers, cert-manager); install/upgrade hooks |
| Weaknesses | No release/version tracking or built-in rollback; no templating logic, so many small per-env differences get verbose; no ecosystem of prebuilt charts — `mongo.yaml` here is hand-rolled | Extra tool and learning curve; Go-template YAML is harder to read/debug (need `helm template` to see the real output); packaging/versioning is overhead when there's only one app and one deploy target |

This repo is one app, deployed locally for now, with no need yet for
third-party charts or multiple parallel releases — squarely Kustomize's
strength. Revisit Helm if any of these show up: swapping `mongo.yaml` for a
production-grade community chart (e.g. Bitnami's), distributing this app as
an installable chart for other teams/clusters, or enough per-environment
parameters that Kustomize overlays become unwieldy. Until then, adding
`infra/k8s/overlays/{local,uat,prod}/` on top of the existing base is enough
to cover more environments without switching tools.
