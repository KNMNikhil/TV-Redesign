// Launcher configuration. Edit this file, then run ./install.sh to put the change on the TV.
// App ids: run `venv/bin/python scripts/sync_apps.py <TV_IP> --list` (or look in app/apps.js after a sync).
window.CONFIG = {
  // Apps on the home list, in this order (up to 12; 6 show at a time, the list scrolls). Missing apps are skipped. Changed on the TV via All apps > hold OK.
  dockApps: ['netflix', 'amazon', 'youtube.leanback.v4', 'hotstar', 'com.sun.sunnxt', 'com.zee5.app', 'spotify-beehive', 'aha', 'com.sonyliv2.tvapp'],

  // Apps never shown as tiles (inputs and Live TV are already in the Inputs menu).
  hiddenApps: [
    'com.knmnikhil.tvredesign',
    'com.webos.app.livetv',
    'com.webos.app.hdmi1', 'com.webos.app.hdmi2', 'com.webos.app.hdmi3', 'com.webos.app.hdmi4',
    'com.webos.app.lgchannels',        // LG Channels
    'shortcutcopilot',                 // Copilot
    'com.webos.app.sportsteamsettings', // Sports
    'epoxyaisports',                   // LG Sports Playbook
    'webos.day',                       // LG Streaming Week
    'com.webos.app.homeconnect',       // Home Hub
    'com.twin.app.gamingportal',       // LG Gaming Portal
    'io.we3world.artlume',             // Artlume
    'com.famobi.ctr', 'com.playworks.app.hillrider', 'com.miniclip.eightballpool', // games
    'com.webos.app.multiviewsettings', // Multi View
    'com.webos.app.storagemanager',    // Memory Care
    'com.webos.app.lglink-full'        // LG Link
  ],

  // The Live TV app, offered at the end of the Inputs menu. Leave empty to omit.
  liveTvApp: 'com.webos.app.livetv',

  // Shorter names for long app titles.
  names: { 'spotify-beehive': 'Spotify', 'com.sun.sunnxt': 'Sun NXT', 'com.zee5.app': 'ZEE5', 'com.sonyliv2.tvapp': 'SonyLIV', 'aha': 'aha', 'com.blacknut.app': 'Blacknut', 'com.viacom18.media.ondemand': 'JioCinema' },

  // First day of the week in the calendar: 0 = Sunday, 1 = Monday.
  weekStartsOn: 0,

  // Seconds without a key press before the dimmed clock screen appears.
  idleSeconds: 90,

  // Wallpapers: your own images in app/wallpapers/. thumb = small picker preview, blur = tiny copy that is
  // enlarged behind All apps (a pre-blurred image costs the TV nothing; live blur is slow).
  photos: [
    { file: 'wallpapers/1.png', thumb: 'wallpapers/thumb/1.png', blur: 'wallpapers/blur/1.png', name: 'Sunrise Peaks' },
    { file: 'wallpapers/2.png', thumb: 'wallpapers/thumb/2.png', blur: 'wallpapers/blur/2.png', name: 'Valley River' },
    { file: 'wallpapers/3.png', thumb: 'wallpapers/thumb/3.png', blur: 'wallpapers/blur/3.png', name: 'Island Castle' }
  ],
  defaultWallpaper: 'photo:wallpapers/1.png'
};
