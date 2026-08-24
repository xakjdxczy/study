# Agent notes

## Always return the VPS preview URL

At the end of **every completed task**, include the live preview address in the user-facing summary, even if the change was small or already deployed earlier:

**https://117.72.108.246/study/**

If the work changed the site, deploy first (`bash scripts/deploy-server.sh`), then return that URL.

## Every publish goes to the VPS

After textbook or site changes that should go live, deploy to the cloud server. Do not stop at GitHub Pages.

- Login **root** over SSH.
- Use Cursor environment secrets: `SSH_PRIVATE_KEY` and `SSH_HOST`.
- `SSH_HOST` may be a bare IP or an `http(s)://.../` URL. The deploy script strips the scheme and path.
- Remote directory: `/var/www/study` (nginx `location /study/`).
- Public URL: **https://117.72.108.246/study/**
- Do not upload via OSS. Do not overwrite `/var/www/chenaix` (the official site on `/`).

```bash
bash scripts/deploy-server.sh
```

Then open `https://117.72.108.246/study/` and confirm the new content.

If GitHub Actions also deploys, it still needs repo secrets `SSH_PRIVATE_KEY` and optional `SSH_HOST`. Agent runs should deploy themselves using the injected environment secrets.
