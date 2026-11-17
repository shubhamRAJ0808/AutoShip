# Manual – Simple CI/CD Pipeline (GitHub + npm + Docker + Docker Compose + Deployment)

## 1. What this project is
A tiny web app (Node.js) that talks to a PostgreSQL database and counts page visits.
Every `git push` to GitHub automatically **builds, tests, packages in Docker, and deploys** it.

| Technology | Where it is used |
|---|---|
| **GitHub** | Stores the code; triggers the pipeline on every push |
| **GitHub Actions** | Runs the pipeline – `.github/workflows/ci-cd.yml` |
| **Build tool (npm)** | `npm ci`, `npm run build`, `npm test` (`package.json`) |
| **Docker** | `Dockerfile` packages the web app into an image |
| **Docker Compose** | `docker-compose.yml` runs **web + database** (2 containers) |
| **Container registry (GHCR)** | Stores the built image (`ghcr.io/<you>/<repo>`) |
| **Deployment** | The last pipeline job SSHes into a server and runs `docker compose up -d` |

## 2. Project structure
```
simple-cicd-project/
├── .github/workflows/ci-cd.yml   # the CI/CD pipeline
├── test/app.test.js              # automated test
├── server.js                     # web app (Express + PostgreSQL)
├── package.json / package-lock.json   # build tool config (npm)
├── Dockerfile                    # builds the web image
├── docker-compose.yml            # web + db containers
├── .env.example                  # example settings
└── MANUAL.md                     # this file
```

## 3. How the pipeline works
```
git push ──► GitHub ──► Job 1: build-test ──► Job 2: docker ──► Job 3: deploy
                        npm ci/build/test     build image,       SSH to server,
                        compose up + curl     push to GHCR       pull + compose up
```
1. **build-test** – installs dependencies, builds, runs the test, then starts the full Docker Compose stack and checks `/health` and `/`.
2. **docker** – builds the image and pushes it to GitHub Container Registry (only on push to `main`).
3. **deploy** – connects to your server and restarts the containers with the new image (only if you enable it, see step 6).

Pull requests run only Job 1.

## 4. Run it on your own computer
Requirements: Docker Desktop (or Docker + Compose plugin).
```bash
docker compose up --build
```
Open http://localhost:3000 → you will see `{"message":"Hello from the CI/CD pipeline!","visits":1}`; refresh and the number grows (stored in PostgreSQL).
Health check: http://localhost:3000/health
Stop: `docker compose down` (add `-v` to also delete database data).

Optional (without Docker): `npm install && npm test`.

## 5. Push to GitHub
1. Create an empty repository on github.com (e.g. `simple-cicd-project`).
2. In this folder run:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/simple-cicd-project.git
git push -u origin main
```
3. Open the **Actions** tab – the pipeline starts automatically. Jobs 1 and 2 should turn green.

> If Job 2 fails with a permissions error: **Settings → Actions → General → Workflow permissions → "Read and write permissions" → Save**, then re-run the job.

## 6. Enable deployment (Job 3)
You need a Linux server (e.g. AWS EC2 / any VPS) that you can SSH into.

**On the server (one time):**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER      # then log out and log in again
```
Open port **3000** in the server's firewall / security group.

**On your computer:** create an SSH key pair for the pipeline
```bash
ssh-keygen -t ed25519 -f deploy_key -N ""
ssh-copy-id -i deploy_key.pub USER@SERVER_IP      # or paste deploy_key.pub into ~/.ssh/authorized_keys on the server
```

**On GitHub: Settings → Secrets and variables → Actions**

| Type | Name | Value |
|---|---|---|
| Secret | `SERVER_HOST` | server IP address |
| Secret | `SERVER_USER` | SSH username (e.g. `ubuntu`) |
| Secret | `SERVER_SSH_KEY` | full contents of the `deploy_key` file (private key) |
| Secret | `DB_PASSWORD` | any strong password for the database |
| **Variable** | `DEPLOY_ENABLED` | `true` |

Push any change → after the pipeline finishes open `http://SERVER_IP:3000`.

> The GHCR image is private by default. The pipeline logs in to GHCR using `GITHUB_TOKEN`, so no extra setup is needed.

## 7. Try the full flow
Edit the message in `server.js`, then:
```bash
git add . && git commit -m "Change message" && git push
```
Watch the **Actions** tab; a minute later the live site shows the new message.

## 8. Troubleshooting
| Problem | Fix |
|---|---|
| Job 2 "permission denied" to GHCR | Enable *Read and write permissions* (see step 5) |
| Job 3 is skipped | Variable `DEPLOY_ENABLED` is not set to `true` |
| Job 3 SSH fails | Check the 3 SSH secrets; the private key must include the `BEGIN/END` lines |
| Site not reachable on server | Open port 3000 in firewall / security group |
| `npm ci` fails | Make sure `package-lock.json` is committed |
| Port 3000 busy locally | Change `"3000:3000"` to `"8080:3000"` in `docker-compose.yml` |

## 9. Viva / explanation cheat sheet
- **CI (Continuous Integration):** every push is automatically built and tested.
- **CD (Continuous Delivery/Deployment):** a passing build is automatically packaged (Docker image) and deployed.
- **Why Docker?** Same environment everywhere – "works on my machine" problems disappear.
- **Why Compose?** Runs several containers (web + db) together with one command, with a health check so the web waits for the database.
- **Why a registry?** The server needs somewhere to download the built image from.
