# Deploying IDStudio to Proxmox

This guide gets IDStudio running on your Proxmox server over HTTPS using Docker Compose.
The whole app stack (Next.js app, background worker, Postgres, Redis, MinIO, Caddy) runs
in a single Ubuntu VM.

## Why a VM (not an LXC container)
Running Docker inside an LXC container on Proxmox works but is finicky (nesting flags,
keyctl, storage-driver quirks). A dedicated VM is simpler, snapshots cleanly, and avoids
surprises. Use a VM.

---

## 1. Create the VM

In the Proxmox web UI:

1. Download an **Ubuntu Server 24.04 LTS** ISO (Datacenter → local → ISO Images → Download from URL).
2. **Create VM** with roughly:
   - 2 vCPU, 4 GB RAM, 40 GB disk (bump RAM/disk later as usage grows)
   - Guest agent enabled (optional but recommended)
3. Install Ubuntu, create your admin user, enable OpenSSH during setup.
4. Give the VM a **static IP** (via your router's DHCP reservation or netplan) so DNS stays valid.

## 2. Install Docker

SSH into the VM, then:

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl git
# Docker's official install script:
curl -fsSL https://get.docker.com | sudo sh
# Run docker without sudo (log out/in afterwards):
sudo usermod -aG docker $USER
```

Verify: `docker version` and `docker compose version`.

## 3. Get the code onto the VM

Clone the repository onto the VM:

```bash
git clone https://github.com/32bitcolor/idstudio.git
cd idstudio
```

> The repo is **private**, so the clone will ask you to authenticate. The easiest way
> is to install the GitHub CLI and log in first:
> ```bash
> sudo apt-get install -y gh        # or: see https://cli.github.com
> gh auth login                     # choose GitHub.com → HTTPS → login with a browser
> ```
> Then `git clone` works without prompting. (Alternatively, copy the project folder to
> the VM directly with `scp`/`rsync`.)

## 4. Configure environment

```bash
cp .env.example .env
nano .env
```

Set **real** values:

- `SESSION_SECRET` — generate with `openssl rand -base64 32`
- `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD` — strong unique passwords
- `DOMAIN` — the public hostname you'll use, e.g. `idstudio.yourteam.com`
- `ACME_EMAIL` — your email (optional; for Let's Encrypt expiry notices)
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — the first admin login (change the password!)

> The `DATABASE_URL` line in `.env` is only used if you run the app **outside** Docker.
> Inside Compose, the app builds its DB URL from `POSTGRES_*`.

## 5. DNS

Point your domain at the VM:

- **Public access:** create a DNS `A` record for `DOMAIN` → the VM's public IP, and forward
  ports **80** and **443** to the VM on your router/firewall. Caddy will obtain a real
  Let's Encrypt certificate automatically.
- **LAN-only:** set `DOMAIN` to a hostname your internal DNS resolves to the VM (or use the
  VM's IP). With `DOMAIN=localhost` Caddy serves a self-signed cert (browsers warn).

## 6. Launch

```bash
docker compose up -d
```

What happens:
1. `postgres`, `redis`, `minio` start; Compose waits for Postgres to be healthy.
2. The one-shot **`migrate`** service runs `prisma migrate deploy` then seeds the first admin, and exits.
3. **`app`** (Next.js) and **`worker`** (BullMQ) start.
4. **`caddy`** provisions TLS and reverse-proxies `DOMAIN` → the app.

Check status and logs:

```bash
docker compose ps
docker compose logs -f app
docker compose logs migrate     # confirm "created admin ..." or "already exists"
```

Open `https://<DOMAIN>` and sign in with your seeded admin. **Change the admin password
strategy / create your real accounts, then consider disabling open signup later.**

## 7. Updating

```bash
git pull                  # or copy new code
docker compose build      # rebuild app/worker/migrate images
docker compose up -d      # migrate service applies any new migrations on the way up
```

## 8. Backups (do this before you rely on it)

- **Database:** schedule a nightly dump.
  ```bash
  docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
    | gzip > "idstudio-$(date +%F).sql.gz"
  ```
  Copy these off the VM (restic/borg to remote storage is ideal).
- **Object storage:** back up the `idstudio_miniodata` volume (or `mc mirror` to remote).
- **Proxmox-level:** add this VM to your Proxmox **Backup** schedule as a second safety net.
- **Test a restore** at least once — an untested backup isn't a backup.

## Troubleshooting

| Symptom | Check |
| ------- | ----- |
| Caddy can't get a cert | Ports 80/443 reachable from the internet? DNS `A` record correct? |
| `app` restarts / 502 | `docker compose logs app`; is `migrate` showing success? Is `SESSION_SECRET` set? |
| `migrate` failed | `docker compose logs migrate`; is Postgres healthy? Are `POSTGRES_*` consistent? |
| Login always fails | Confirm you're using the seeded `SEED_ADMIN_*` credentials; check `app` logs. |

## Service overview

| Service  | Purpose                                   | Persistent volume |
| -------- | ----------------------------------------- | ----------------- |
| caddy    | HTTPS reverse proxy                       | caddydata, caddyconfig |
| app      | Next.js web app + API                     | — |
| worker   | BullMQ background jobs (LMS sync, exports) | — |
| postgres | Primary database                          | pgdata |
| redis    | Job queue / locks                         | redisdata |
| minio    | S3-compatible file storage (Phase 1+)     | miniodata |
| migrate  | One-shot: migrations + first-admin seed   | — |
