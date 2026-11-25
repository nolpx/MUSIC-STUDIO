// KOLOM KIRI: Google Drive (Folder Background, Bank Lagu, & Playlist Terpilih)
(function () {
  const mount = document.getElementById('col-left');
  if (!mount) return;

  const AUDIO_EXT = /\.(mp3|wav|m4a|flac|ogg|aac)$/i;
  const MEDIA_EXT = /\.(jpg|jpeg|png|webp|mp4|mov|mkv|webm)$/i;

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatMB(bytes) {
    const b = Number(bytes || 0);
    return b > 0 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : '';
  }

  // Ambil seluruh isi folder Google Drive via Drive API v3 (mendukung >100 file)
  async function fetchDriveFolder(folderUrl) {
    const apiKey = (STUDIO.config.gdriveApiKey || '').trim();
    if (!apiKey) {
      throw new Error('Google Drive API Key belum diisi! Buka menu "Koneksi & API Key" di Kolom Kanan.');
    }

    const folderId = STUDIO.extractFolderId(folderUrl);
    if (!folderId) {
      throw new Error('Link Folder Google Drive belum diisi.');
    }

    let files = [];
    let pageToken = '';

    do {
      const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
      const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,size,thumbnailLink)');
      let url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000&orderBy=name&key=${encodeURIComponent(apiKey)}`;
      if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

      const res = await fetch(url);
      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          const data = await res.json();
          if (data.error && data.error.message) msg = data.error.message;
        } catch {}
        throw new Error(msg);
      }

      const data = await res.json();
      files = files.concat(data.files || []);
      pageToken = data.nextPageToken || '';
    } while (pageToken);

    return files;
  }

  // Render kerangka UI Kolom Kiri
  mount.innerHTML = `
    <h1 class="brand-title">🎬 MUSIC-STUDIO</h1>

    <!-- 1. FOLDER BACKGROUND -->
    <div class="card">
      <div class="card-title">
        <span>📁 Folder Background</span>
        <span id="bg-count">0 file</span>
      </div>
      <div class="input-inline">
        <input id="inp-bg-folder" type="text" placeholder="Tempel Link Folder Background GDrive..." />
        <button class="btn btn-blue" id="btn-load-bg">Muat</button>
      </div>
      <div id="bg-status" class="hint">Pastikan folder di-share "Anyone with the link (Viewer)".</div>
      <div id="bg-grid" class="bg-grid"></div>
    </div>

    <!-- 2. BANK LAGU GOOGLE DRIVE -->
    <div class="card">
      <div class="card-title">
        <span>📂 Bank Lagu (GDrive)</span>
        <span id="bank-count">0 lagu</span>
      </div>
      <div class="input-inline">
        <input id="inp-song-folder" type="text" placeholder="Tempel Link Folder Lagu GDrive..." />
        <button class="btn btn-blue" id="btn-load-songs">Muat</button>
      </div>
      <div id="song-status" class="hint">Pilih lagu dengan tombol (+) untuk masuk ke Playlist.</div>

      <input id="inp-song-search" type="search" placeholder="🔍 Cari nama lagu..." style="margin-top:8px;" />

      <div id="bank-list" class="list-box">
        <div class="list-empty">Belum ada lagu dimuat.</div>
      </div>

      <div class="btn-group">
        <button class="btn btn-secondary btn-xs" onclick="GDRIVE_UI.addRandom(10)">+10 Acak</button>
        <button class="btn btn-secondary btn-xs" onclick="GDRIVE_UI.addRandom(20)">+20 Acak</button>
        <button class="btn btn-secondary btn-xs" onclick="GDRIVE_UI.addAllFiltered()">+Semua</button>
      </div>
    </div>

    <!-- 3. PLAYLIST TERPILIH (ANTREAN RENDER) -->
    <div class="card">
      <div class="card-title">
        <span>🎵 Playlist Terpilih</span>
        <span id="pl-summary">0 lagu • ~0 mnt</span>
      </div>

      <div id="playlist-box" class="list-box">
        <div class="list-empty">Klik (+) pada Bank Lagu di atas untuk menyusun playlist.</div>
      </div>

      <div class="btn-group">
        <button class="btn btn-secondary btn-xs" onclick="GDRIVE_UI.shufflePlaylist()">🔀 Acak Urutan</button>
        <button class="btn btn-danger btn-xs" onclick="GDRIVE_UI.clearPlaylist()">🗑 Kosongkan</button>
      </div>
      <div class="hint">Klik judul lagu di Playlist untuk langsung mengetesnya di Preview Tengah.</div>
    </div>
  `;

  // Isi link folder tersimpan
  const inpBgFolder = document.getElementById('inp-bg-folder');
  const inpSongFolder = document.getElementById('inp-song-folder');
  const inpSearch = document.getElementById('inp-song-search');

  inpBgFolder.value = STUDIO.config.bgFolderUrl || '';
  inpSongFolder.value = STUDIO.config.songFolderUrl || '';

  inpBgFolder.addEventListener('change', () => {
    STUDIO.config.bgFolderUrl = inpBgFolder.value.trim();
    STUDIO.saveConfig();
  });

  inpSongFolder.addEventListener('change', () => {
    STUDIO.config.songFolderUrl = inpSongFolder.value.trim();
    STUDIO.saveConfig();
  });

  inpSearch.addEventListener('input', renderBankSongs);

  // --- RENDER GALERI BACKGROUND ---
  function renderBgGrid() {
    const grid = document.getElementById('bg-grid');
    const list = STUDIO.media.bankBg;
    document.getElementById('bg-count').textContent = `${list.length} file`;

    if (!list.length) {
      grid.innerHTML = '';
      return;
    }

    const activeId = STUDIO.media.selectedBg ? STUDIO.media.selectedBg.id : '';
    grid.innerHTML = list.map((item, idx) => {
      const isVid = (item.mimeType || '').startsWith('video/') || /\.(mp4|mov|mkv|webm)$/i.test(item.name);
      const badge = isVid ? '🎬 ' : '🖼️ ';
      const fallbackSvg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='112'><rect width='100%' height='100%' fill='%2310182b'/><text x='50%' y='55%' fill='%238b949e' font-size='14' text-anchor='middle'>${isVid ? 'VIDEO' : 'IMAGE'}</text></svg>`;
      const thumb = item.thumbnailLink || fallbackSvg;
      return `
        <div class="bg-item ${item.id === activeId ? 'active' : ''}" onclick="GDRIVE_UI.selectBg(${idx})" title="${esc(item.name)}">
          <img src="${esc(thumb)}" onerror="this.src='${fallbackSvg}'" alt="" />
          <div class="bg-name">${badge}${esc(item.name)}</div>
        </div>
      `;
    }).join('');
  }

  // --- RENDER BANK LAGU ---
  function getFilteredBank() {
    const q = (inpSearch.value || '').trim().toLowerCase();
    return STUDIO.media.bankSongs
      .map((song, originalIndex) => ({ song, originalIndex }))
      .filter(({ song }) => !q || song.cleanName.toLowerCase().includes(q) || song.name.toLowerCase().includes(q));
  }

  function renderBankSongs() {
    const box = document.getElementById('bank-list');
    const filtered = getFilteredBank();
    document.getElementById('bank-count').textContent = `${STUDIO.media.bankSongs.length} lagu`;

    if (!STUDIO.media.bankSongs.length) {
      box.innerHTML = '<div class="list-empty">Belum ada lagu dimuat.</div>';
      return;
    }
    if (!filtered.length) {
      box.innerHTML = '<div class="list-empty">Tidak ada lagu yang cocok dengan pencarian.</div>';
      return;
    }

    const selectedIds = new Set(STUDIO.media.playlist.map(s => s.id));
    box.innerHTML = filtered.map(({ song, originalIndex }) => {
      const addedMark = selectedIds.has(song.id) ? '✓ ' : '';
      return `
        <div class="list-item">
          <span class="item-name" title="${esc(song.name)}">${addedMark}${esc(song.cleanName)}</span>
          <div class="item-actions">
            <span class="hint" style="margin:0 4px 0 0;">${formatMB(song.size)}</span>
            <button class="btn btn-primary btn-xs" onclick="GDRIVE_UI.addSong(${originalIndex})">+</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- RENDER PLAYLIST TERPILIH ---
  function renderPlaylist() {
    const box = document.getElementById('playlist-box');
    const pl = STUDIO.media.playlist;

    // Perkiraan durasi kasar (~1.4 MB per menit pada rata-rata MP3 192kbps)
    const totalBytes = pl.reduce((acc, s) => acc + Number(s.size || 0), 0);
    const estMinutes = Math.round((totalBytes / (1024 * 1024)) / 1.4);
    document.getElementById('pl-summary').textContent = `${pl.length} lagu • ~${estMinutes} mnt`;

    if (!pl.length) {
      box.innerHTML = '<div class="list-empty">Klik (+) pada Bank Lagu di atas untuk menyusun playlist.</div>';
      renderBankSongs();
      return;
    }

    box.innerHTML = pl.map((song, idx) => `
      <div class="list-item ${idx === STUDIO.media.playingIndex ? 'playing' : ''}">
        <span class="item-name" style="cursor:pointer;" onclick="GDRIVE_UI.playFromPlaylist(${idx})" title="Klik untuk tes putar: ${esc(song.cleanName)}">
          <b>#${idx + 1}</b> ${esc(song.cleanName)}
        </span>
        <div class="item-actions">
          <button class="btn btn-secondary btn-xs" onclick="GDRIVE_UI.moveSong(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>▲</button>
          <button class="btn btn-secondary btn-xs" onclick="GDRIVE_UI.moveSong(${idx}, 1)" ${idx === pl.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="btn btn-danger btn-xs" onclick="GDRIVE_UI.removeSong(${idx})">✕</button>
        </div>
      </div>
    `).join('');

    renderBankSongs();
  }

  // --- AKSI TOMBOL MUAT ---
  document.getElementById('btn-load-bg').addEventListener('click', async () => {
    const status = document.getElementById('bg-status');
    STUDIO.config.bgFolderUrl = inpBgFolder.value.trim();
    STUDIO.saveConfig();
    status.textContent = '⏳ Membaca isi folder Background...';

    try {
      const files = await fetchDriveFolder(STUDIO.config.bgFolderUrl);
      STUDIO.media.bankBg = files.filter(f =>
        (f.mimeType || '').startsWith('image/') ||
        (f.mimeType || '').startsWith('video/') ||
        MEDIA_EXT.test(f.name)
      );

      if (!STUDIO.media.bankBg.length) {
        status.textContent = '⚠️ Folder kosong / tidak ada gambar & video (cek izin share folder).';
      } else {
        status.textContent = `✅ Ditemukan ${STUDIO.media.bankBg.length} file background. Klik 1 untuk preview.`;
      }
      renderBgGrid();
    } catch (err) {
      status.textContent = `❌ ${err.message}`;
    }
  });

  document.getElementById('btn-load-songs').addEventListener('click', async () => {
    const status = document.getElementById('song-status');
    STUDIO.config.songFolderUrl = inpSongFolder.value.trim();
    STUDIO.saveConfig();
    status.textContent = '⏳ Membaca isi folder Lagu...';

    try {
      const files = await fetchDriveFolder(STUDIO.config.songFolderUrl);
      STUDIO.media.bankSongs = files
        .filter(f => (f.mimeType || '').startsWith('audio/') || AUDIO_EXT.test(f.name))
        .map(f => ({
          id: f.id,
          name: f.name,
          cleanName: STUDIO.cleanSongName(f.name),
          size: f.size || 0
        }));

      if (!STUDIO.media.bankSongs.length) {
        status.textContent = '⚠️ Folder kosong / tidak ada file audio (cek izin share folder).';
      } else {
        status.textContent = `✅ Ditemukan ${STUDIO.media.bankSongs.length} lagu siap dipilih.`;
      }
      renderBankSongs();
    } catch (err) {
      status.textContent = `❌ ${err.message}`;
    }
  });

  // --- API GLOBAL UNTUK AKSI KLIK DI UI ---
  window.GDRIVE_UI = {
    selectBg(idx) {
      const item = STUDIO.media.bankBg[idx];
      if (!item) return;
      STUDIO.media.selectedBg = item;
      renderBgGrid();
      STUDIO.emit('bg-changed', item);
    },

    addSong(originalIndex) {
      const song = STUDIO.media.bankSongs[originalIndex];
      if (!song) return;
      STUDIO.media.playlist.push({ ...song });
      renderPlaylist();
      STUDIO.emit('playlist-changed', STUDIO.media.playlist);
    },

    addRandom(count) {
      const pool = [...STUDIO.media.bankSongs];
      if (!pool.length) return alert('Muat Bank Lagu terlebih dahulu!');
      // Utamakan lagu yang belum masuk playlist
      const existingIds = new Set(STUDIO.media.playlist.map(s => s.id));
      let candidates = pool.filter(s => !existingIds.has(s.id));
      if (!candidates.length) candidates = pool;

      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      candidates.slice(0, count).forEach(s => STUDIO.media.playlist.push({ ...s }));
      renderPlaylist();
      STUDIO.emit('playlist-changed', STUDIO.media.playlist);
    },

    addAllFiltered() {
      const filtered = getFilteredBank();
      if (!filtered.length) return;
      filtered.forEach(({ song }) => STUDIO.media.playlist.push({ ...song }));
      renderPlaylist();
      STUDIO.emit('playlist-changed', STUDIO.media.playlist);
    },

    moveSong(idx, dir) {
      const pl = STUDIO.media.playlist;
      const target = idx + dir;
      if (target < 0 || target >= pl.length) return;
      [pl[idx], pl[target]] = [pl[target], pl[idx]];
      renderPlaylist();
      STUDIO.emit('playlist-changed', pl);
    },

    removeSong(idx) {
      STUDIO.media.playlist.splice(idx, 1);
      if (STUDIO.media.playingIndex >= STUDIO.media.playlist.length) {
        STUDIO.media.playingIndex = 0;
      }
      renderPlaylist();
      STUDIO.emit('playlist-changed', STUDIO.media.playlist);
    },

    shufflePlaylist() {
      const pl = STUDIO.media.playlist;
      for (let i = pl.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pl[i], pl[j]] = [pl[j], pl[i]];
      }
      STUDIO.media.playingIndex = 0;
      renderPlaylist();
      STUDIO.emit('playlist-changed', pl);
    },

    clearPlaylist() {
      STUDIO.media.playlist = [];
      STUDIO.media.playingIndex = 0;
      renderPlaylist();
      STUDIO.emit('playlist-changed', []);
    },

    playFromPlaylist(idx) {
      STUDIO.media.playingIndex = idx;
      renderPlaylist();
      STUDIO.emit('play-track', idx);
    }
  };

  // Ikuti perubahan lagu yang sedang diputar di Preview Tengah
  STUDIO.on('track-changed', renderPlaylist);
})();
