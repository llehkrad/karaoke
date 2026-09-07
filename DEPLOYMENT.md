# Deploying to AWS Lightsail

This gets the karaoke app onto the public internet so guests can join from
anywhere, not just your home WiFi.

## 1. Create the Lightsail instance

1. AWS Console → Lightsail → Create instance
2. Platform: **Linux/Unix**, Blueprint: **OS Only → Ubuntu 22.04 LTS**
3. Choose a plan — the cheapest tier ($3.50-5/mo) is plenty for a
   personal karaoke app (it's mostly idle except during parties)
4. Name it (e.g. `karaoke-server`), create it

## 2. Networking

In the instance's **Networking** tab:
- Attach a **static IP** (free while attached to a running instance) so the
  address doesn't change on reboot
- Open ports: **80** (HTTP), **443** (HTTPS), **22** (SSH, usually already open)
- You do NOT need to open port 3001 externally — nginx will proxy to it
  internally

If you own a domain, point an A record at the static IP now (e.g.
`karaoke.yourdomain.com`). You can also just use the raw IP if you don't
want a domain, but HTTPS setup (step 6) needs a domain name to work.

## 3. Connect and install Node.js

SSH in (Lightsail's browser-based SSH button works fine), then:

```bash
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install nginx (reverse proxy + serves the built frontend)
sudo apt install -y nginx

# Install pm2 (keeps the server running, restarts it if it crashes)
sudo npm install -g pm2
```

## 4. Get the code onto the server

Simplest path: upload the project as a zip and unpack it there (or use git
if you push this to a repo — recommended long-term, but zip works fine to
get started).

```bash
# On the server:
mkdir -p ~/karaoke-app
cd ~/karaoke-app
# upload your zip here (e.g. via `scp` from your own machine), then:
unzip karaoke-app.zip
```

## 5. Configure and start the backend

```bash
cd ~/karaoke-app/server
cp .env.example .env
nano .env
```

Fill in:
```
PORT=3001
CORS_ORIGIN=https://karaoke.yourdomain.com
YOUTUBE_API_KEY=your_real_key_here
ADMIN_PASSWORD=pick_a_strong_password
```

`ADMIN_PASSWORD` gates the `/admin` control panel (list all rooms, live
pitch/pause/resume/restart/skip, manage the playlist) — it's a master key
valid for every room, so treat it like any other production secret. Leave
it blank to disable `/admin` entirely.

> **If you use the `extension/` Chrome extension (pitch sync) against this
> deployment:** it opens its own Socket.IO connection from a
> `chrome-extension://<id>` origin, which the single-string `CORS_ORIGIN`
> above will reject once it's no longer `*`. `server/src/index.js` passes
> `CORS_ORIGIN` straight through to Socket.IO's `cors.origin` — that
> option also accepts an array or a function, so this needs a small code
> change (not yet done) to allow both the real frontend origin and the
> extension's `chrome-extension://<id>` origin before pitch sync will work
> against a hardened production CORS setting.

Then:
```bash
npm install
pm2 start src/index.js --name karaoke-server
pm2 save
pm2 startup    # follow the printed instructions to enable auto-start on reboot
```

## 6. Build and serve the frontend

```bash
cd ~/karaoke-app/client
echo "VITE_SERVER_URL=https://karaoke.yourdomain.com" > .env.production
npm install
npm run build     # produces client/dist/
```

## 7. Configure nginx

Create `/etc/nginx/sites-available/karaoke`:

```nginx
server {
    listen 80;
    server_name karaoke.yourdomain.com;

    root /home/ubuntu/karaoke-app/client/dist;
    index index.html;

    # React Router: let the app handle all non-file routes
    location / {
        try_files $uri /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
    }

    # Socket.IO (needs upgrade headers for websockets)
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/karaoke /etc/nginx/sites-enabled/
sudo nginx -t          # test the config
sudo systemctl reload nginx
```

At this point `http://karaoke.yourdomain.com` should work. Next, HTTPS:

## 8. HTTPS (recommended — do this before actual parties)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d karaoke.yourdomain.com
```

Follow the prompts (enter your email, agree to terms). Certbot edits your
nginx config automatically and sets up auto-renewal.

## 9. Test it

- Open `https://karaoke.yourdomain.com` on your laptop → create a room
- Scan the QR code with your phone (on cellular data, not WiFi, to confirm
  it truly works over the public internet) → you should land on the guest
  search page

## Updating the app later

```bash
cd ~/karaoke-app
# re-upload/pull new code, then:
cd server && npm install && pm2 restart karaoke-server
cd ../client && npm install && npm run build
```

(No nginx changes needed for a normal code update — it always serves
whatever's currently in `client/dist/`.)
