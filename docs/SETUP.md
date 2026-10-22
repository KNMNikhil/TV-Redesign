# Setup

Placeholders in angle brackets, such as `<TV_IP>`, are values from your own TV. Never commit them or paste them into issues.

## 1. Prepare the tools

```bash
scripts/setup-tools.sh
```

This creates `venv/` (Python, `websockets` pinned) and installs LG's command-line tools into `tools/`, pinned and without running install scripts. Nothing is installed globally.

## 2. Put the TV in Developer Mode

1. On the TV, install LG's **Developer Mode** app from the LG Content Store and sign in with a free LG developer account.
2. Turn **Dev Mode Status** on (the TV restarts), then reopen the app and turn **Key Server** on. Note the TV's IP address and the passphrase it shows.

## 3. Register the TV

Run these from the project folder. Type the passphrase yourself when asked; do not put it in scripts or notes.

```bash
export PATH="$PWD/tools/node_modules/.bin:$PATH"
ares-setup-device -a lgtv -i "{'host':'<TV_IP>','port':'9922','username':'prisoner'}"
ares-novacom --device lgtv --getkey
ares-setup-device -m lgtv -i "{'privatekey':'lgtv_webos','passphrase':'<PASSPHRASE>'}"
ares-device -i -d lgtv
```

The last command should print your TV's details. Once registered you can turn **Key Server** off again; it is only needed for this step.

## 4. Wallpapers (optional)

```bash
scripts/make-wallpapers.sh one.png two.png three.png
```

Edit the names in `app/config.js` (`photos`). With no wallpapers the background is plain black.

## 5. Install

```bash
TV_HOST=<TV_IP> ./install.sh
```

The first run shows a pairing prompt on the TV: accept it. The script reads your TV's apps, packages the launcher, installs it and opens it. To open it again later, find **Home** in the TV's Apps list, or hold a number key on the remote while it is open to assign it to that key.

## Optional: Home button

LG's Home button always opens LG's home first. To switch to this launcher right after, run the watcher on a device that stays on:

```bash
venv/bin/python scripts/home_watch.py <TV_IP>
```

Press Home twice within three seconds to stay on LG's home. On a Mac, `TV_HOST=<TV_IP> scripts/home-watch-mac.sh` runs it at login (`scripts/home-watch-mac.sh uninstall` removes it); it only works while the Mac is awake.

## Removing everything

```bash
tools/node_modules/.bin/ares-install -d lgtv -r com.knmnikhil.tvredesign   # remove the launcher from the TV
scripts/home-watch-mac.sh uninstall                                        # only if you installed the watcher
tools/node_modules/.bin/ares-setup-device -r lgtv                          # forget the TV
```

You can also delete the Developer Mode app on the TV. LG's home screen is never modified, so nothing else needs restoring.

## Troubleshooting

- **"Failed to get ssh private key"**: the TV is unreachable or Key Server is off. Check the IP shown in the Developer Mode app and that both devices are on the same network.
- **"No route to host" on macOS**: allow your terminal (or Python) under System Settings → Privacy & Security → Local Network.
- **The launcher stops opening after a while**: Developer Mode sessions expire. Open the Developer Mode app on the TV and use **Extend Session Time**.
- **Pairing prompt does not appear**: enable the TV's option for connecting from mobile apps.
- **Plain black background**: no wallpapers were added, see step 4.
