// Jembatan data bersama antar semua kolom (disimpan otomatis di browser)
(function () {
  const DEFAULT_CONFIG = {
    ghOwner: 'nolpx',
    ghRepo: 'MUSIC-STUDIO',
    ghToken: '',
    gdriveApiKey: '',
    bgFolderUrl: '',
    songFolderUrl: ''
  };

  const DEFAULT_SETTINGS = {
    // Judul Video Utama
    titleEnabled: true,
    titleText: 'Relaxing Night Music',
    titleY: 8,         // Posisi vertikal (0 - 95% dari atas)
    titleSize: 52,     // Ukuran font di 1080p
    titleColor: '#ffffff',

    // Judul Lagu Otomatis (Now Playing dari nama file MP3)
    npEnabled: true,
    npPrefix: '♪  ',
    npAlign: 'center', // left | center | right
    npY: 93,           // Posisi vertikal (0 - 98% dari atas)
    npSize: 34,        // Ukuran font di 1080p
    npColor: '#eeeeee',

    // Visualizer Musik
    visStyle: 'bar',   // bar | wave | off
    visColor: '#00ffcc',
    visY: 78,          // Posisi vertikal (0 - 95% dari atas)
    visHeight: 150     // Tinggi visualizer di 1080p (px)
  };

  function loadJson(key, fallback) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      return saved ? { ...fallback, ...saved } : { ...fallback };
    } catch {
      return { ...fallback };
    }
  }

  const listeners = {};

  window.STUDIO = {
    config: loadJson('ms_config_v2', DEFAULT_CONFIG),
    settings: loadJson('ms_settings_v2', DEFAULT_SETTINGS),

    // Data sementara sesi aktif (hasil baca Google Drive)
    media: {
      bankBg: [],       // [{ id, name, mimeType, thumbnailLink, size }]
      selectedBg: null, // item terpilih dari bankBg
      bankSongs: [],    // [{ id, name, cleanName, size }]
      playlist: [],     // urutan lagu yang dipilih user untuk dirender
      playingIndex: 0
    },

    saveConfig() {
      localStorage.setItem('ms_config_v2', JSON.stringify(this.config));
    },

    saveSettings() {
      localStorage.setItem('ms_settings_v2', JSON.stringify(this.settings));
    },

    on(eventName, fn) {
      if (!listeners[eventName]) listeners[eventName] = [];
      listeners[eventName].push(fn);
    },

    emit(eventName, payload) {
      (listeners[eventName] || []).forEach(fn => fn(payload));
    },

    // Bersihkan nama file jadi judul lagu rapi (hapus ekstensi & underscore)
    cleanSongName(filename) {
      return filename
        .replace(/\.[^/.]+$/, '')
        .replace(/_/g, ' ')
        .trim();
    },

    // Ambil Folder ID dari link Google Drive apa pun
    extractFolderId(input) {
      if (!input) return '';
      const str = input.trim();
      const match = str.match(/folders\/([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
      const idParam = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idParam) return idParam[1];
      return str; // jika user langsung menempel Folder ID-nya
    },

    // URL stream media resmi via Google Drive API Key (untuk Preview & Play)
    gdriveMediaUrl(fileId) {
      const key = encodeURIComponent(this.config.gdriveApiKey || '');
      return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${key}`;
    }
  };
})();
