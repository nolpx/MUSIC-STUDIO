// KOLOM TENGAH (ATAS): Layar Preview 16:9, Player Audio Asli & Real-Time Visualizer
(function () {
  const mount = document.getElementById('preview-mount');
  if (!mount) return;

  mount.innerHTML = `
    <div class="preview-box">
      <canvas id="previewCanvas" width="960" height="540"></canvas>
    </div>

    <div class="player-bar">
      <button class="btn btn-secondary btn-xs" id="btn-prev" title="Lagu Sebelumnya">⏮</button>
      <button class="btn btn-blue btn-xs" id="btn-play" title="Putar / Jeda">▶ Play Tes</button>
      <button class="btn btn-secondary btn-xs" id="btn-next" title="Lagu Berikutnya">⏭</button>
      <div class="player-track" id="player-track">Pilih lagu di Playlist Kiri untuk tes putar...</div>
      <div class="volume-wrap">
        <span>🔊</span>
        <input type="range" id="inp-vol" min="0" max="1" step="0.05" value="0.8" />
      </div>
    </div>
  `;

  const canvas = document.getElementById('previewCanvas');
  const ctx = canvas.getContext('2d');
  const btnPlay = document.getElementById('btn-play');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const trackLabel = document.getElementById('player-track');
  const inpVol = document.getElementById('inp-vol');

  // --- MEDIA BACKGROUND (GAMBAR / VIDEO AI DARI GDRIVE) ---
  let bgImg = null;
  let bgVideo = null;
  let bgStatusNote = '';

  function drawCover(source, sw, sh) {
    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.max(cw / sw, ch / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    ctx.drawImage(source, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  function loadSelectedBg(item) {
    if (!item) return;
    const url = STUDIO.gdriveMediaUrl(item.id);
    const isVid = (item.mimeType || '').startsWith('video/') || /\.(mp4|mov|mkv|webm)$/i.test(item.name);

    if (bgVideo) {
      bgVideo.pause();
      bgVideo.src = '';
      bgVideo = null;
    }

    if (isVid) {
      bgImg = null;
      bgStatusNote = '⏳ Memuat preview video AI...';
      const v = document.createElement('video');
      v.crossOrigin = 'anonymous';
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.src = url;
      v.oncanplay = () => {
        bgStatusNote = '';
        v.play().catch(() => {});
      };
      v.onerror = () => {
        bgStatusNote = '⚠️ Preview video terlalu besar/terblokir, tapi tetap aman saat dirender.';
      };
      bgVideo = v;
    } else {
      bgStatusNote = '⏳ Memuat gambar...';
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        bgImg = img;
        bgStatusNote = '';
      };
      img.onerror = () => {
        // Fallback ke thumbnail jika media utama gagal dimuat
        if (item.thumbnailLink) {
          const thumb = new Image();
          thumb.onload = () => { bgImg = thumb; bgStatusNote = ''; };
          thumb.src = item.thumbnailLink.replace(/=s\d+/, '=s1280');
        } else {
          bgStatusNote = '⚠️ Gagal memuat preview gambar.';
        }
      };
      img.src = url;
    }
  }

  // --- AUDIO PLAYER + WEB AUDIO ANALYSER (VISUALIZER IKUT IRAMA ASLI) ---
  const audio = new Audio();
  audio.crossOrigin = 'anonymous';
  audio.volume = 0.8;

  let audioCtx = null;
  let analyser = null;
  let freqData = null;
  let timeData = null;
  let isPlaying = false;
  let currentTrackId = '';

  function initAudioAnalyser() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
      const src = audioCtx.createMediaElementSource(audio);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      analyser.connect(audioCtx.destination);
      freqData = new Uint8Array(analyser.frequencyBinCount);
      timeData = new Uint8Array(analyser.fftSize);
    } catch {
      analyser = null;
    }
  }

  function updatePlayButton() {
    btnPlay.textContent = isPlaying ? '⏸ Pause' : '▶ Play Tes';
  }

  function getCurrentTrack() {
    const pl = STUDIO.media.playlist;
    if (!pl.length) return null;
    if (STUDIO.media.playingIndex >= pl.length) STUDIO.media.playingIndex = 0;
    return pl[STUDIO.media.playingIndex];
  }

  function playTrackAt(idx) {
    const pl = STUDIO.media.playlist;
    if (!pl.length) {
      trackLabel.textContent = 'Tambahkan lagu ke Playlist di Kolom Kiri dulu!';
      return;
    }
    STUDIO.media.playingIndex = (idx + pl.length) % pl.length;
    const track = pl[STUDIO.media.playingIndex];

    initAudioAnalyser();
    currentTrackId = track.id;
    audio.src = STUDIO.gdriveMediaUrl(track.id);
    trackLabel.textContent = `⏳ Memuat: #${STUDIO.media.playingIndex + 1} ${track.cleanName}`;

    audio.play().then(() => {
      isPlaying = true;
      updatePlayButton();
      trackLabel.textContent = `▶ #${STUDIO.media.playingIndex + 1} ${track.cleanName}`;
      STUDIO.emit('track-changed', STUDIO.media.playingIndex);
    }).catch(() => {
      isPlaying = false;
      updatePlayButton();
      trackLabel.textContent = `⚠️ Gagal memutar "${track.cleanName}" (cek API Key & izin share folder).`;
    });
  }

  btnPlay.addEventListener('click', () => {
    const track = getCurrentTrack();
    if (!track) return alert('Pilih minimal 1 lagu ke kotak Playlist Terpilih di Kolom Kiri dulu!');

    if (isPlaying) {
      audio.pause();
      isPlaying = false;
      updatePlayButton();
    } else if (currentTrackId === track.id && audio.src) {
      initAudioAnalyser();
      audio.play().then(() => {
        isPlaying = true;
        updatePlayButton();
      });
    } else {
      playTrackAt(STUDIO.media.playingIndex);
    }
  });

  btnPrev.addEventListener('click', () => playTrackAt(STUDIO.media.playingIndex - 1));
  btnNext.addEventListener('click', () => playTrackAt(STUDIO.media.playingIndex + 1));
  inpVol.addEventListener('input', () => { audio.volume = Number(inpVol.value); });

  audio.addEventListener('ended', () => {
    if (STUDIO.media.playlist.length > 1) {
      playTrackAt(STUDIO.media.playingIndex + 1);
    } else {
      isPlaying = false;
      updatePlayButton();
    }
  });

  // Hubungkan event dari Kolom Kiri
  STUDIO.on('bg-changed', loadSelectedBg);
  STUDIO.on('play-track', (idx) => playTrackAt(idx));
  STUDIO.on('playlist-changed', () => {
    const track = getCurrentTrack();
    if (!track) {
      audio.pause();
      isPlaying = false;
      currentTrackId = '';
      updatePlayButton();
      trackLabel.textContent = 'Pilih lagu di Playlist Kiri untuk tes putar...';
    } else if (!isPlaying) {
      trackLabel.textContent = `Siap putar: #${STUDIO.media.playingIndex + 1} ${track.cleanName}`;
    }
  });

  // --- LOOP ANIMASI PREVIEW 16:9 (SKALA 0.5x DARI 1920x1080) ---
  let tick = 0;

  function renderFrame() {
    tick += 0.06;
    const s = STUDIO.settings;
    const W = canvas.width;  // 960
    const H = canvas.height; // 540

    // 1. Gambar Background
    if (bgVideo && bgVideo.readyState >= 2 && bgVideo.videoWidth) {
      drawCover(bgVideo, bgVideo.videoWidth, bgVideo.videoHeight);
    } else if (bgImg && bgImg.naturalWidth) {
      drawCover(bgImg, bgImg.naturalWidth, bgImg.naturalHeight);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#10182b');
      grad.addColorStop(1, '#261a38');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Gambar Visualizer (Real-time saat Play, simulasi halus saat Pause)
    if (s.visStyle !== 'off') {
      const visW = 700; // 1400px di 1080p
      const visH = Math.max(20, s.visHeight * 0.5);
      const visX = (W - visW) / 2;
      const visTop = (s.visY / 100) * (H - visH);

      if (s.visStyle === 'bar') {
        const bars = 48;
        const step = visW / bars;
        const barW = Math.max(4, step * 0.65);
        ctx.fillStyle = s.visColor;

        if (isPlaying && analyser && freqData) {
          analyser.getByteFrequencyData(freqData);
        }

        for (let i = 0; i < bars; i++) {
          let ratio;
          if (isPlaying && analyser && freqData) {
            const idx = Math.floor((i / bars) * (freqData.length * 0.75));
            ratio = Math.max(0.06, freqData[idx] / 255);
          } else {
            ratio = (Math.sin(tick * 2 + i * 0.35) * 0.5 + 0.5) * 0.7 + 0.12;
          }
          const bh = ratio * visH;
          ctx.fillRect(visX + i * step, visTop + visH - bh, barW, bh);
        }
      } else if (s.visStyle === 'wave') {
        ctx.strokeStyle = s.visColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();

        if (isPlaying && analyser && timeData) {
          analyser.getByteTimeDomainData(timeData);
          const slice = visW / timeData.length;
          for (let i = 0; i < timeData.length; i++) {
            const v = (timeData[i] - 128) / 128;
            const x = visX + i * slice;
            const y = visTop + visH / 2 + v * (visH * 0.48);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
        } else {
          for (let x = 0; x <= visW; x += 6) {
            const y = visTop + visH / 2 + Math.sin(x * 0.03 + tick * 2.5) * (visH * 0.35) * Math.sin((x / visW) * Math.PI);
            x === 0 ? ctx.moveTo(visX + x, y) : ctx.lineTo(visX + x, y);
          }
        }
        ctx.stroke();
      }
    }

    // 3. Judul Video Utama
    if (s.titleEnabled && s.titleText) {
      const fSize = Math.round(s.titleSize * 0.5);
      const y = (s.titleY / 100) * H;
      ctx.font = `bold ${fSize}px "DejaVu Sans", "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillText(s.titleText, W / 2 + 2, y + 2);
      ctx.fillStyle = s.titleColor;
      ctx.fillText(s.titleText, W / 2, y);
    }

    // 4. Judul Lagu Otomatis (Now Playing)
    if (s.npEnabled) {
      const track = getCurrentTrack();
      const label = (s.npPrefix || '') + (track ? track.cleanName : 'Contoh Nama Lagu Otomatis');
      const fSize = Math.round(s.npSize * 0.5);
      const y = (s.npY / 100) * H;
      let x = W / 2;
      if (s.npAlign === 'left') x = 40;
      else if (s.npAlign === 'right') x = W - 40;

      ctx.font = `${fSize}px "DejaVu Sans", "Segoe UI", sans-serif`;
      ctx.textAlign = s.npAlign;
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(label, x + 1.5, y + 1.5);
      ctx.fillStyle = s.npColor;
      ctx.fillText(label, x, y);
    }

    // Catatan status loading background di pojok kiri atas preview
    if (bgStatusNote) {
      ctx.font = '13px Segoe UI';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(10, 10, 420, 26);
      ctx.fillStyle = '#ffd166';
      ctx.fillText(bgStatusNote, 18, 16);
    }

    requestAnimationFrame(renderFrame);
  }

  renderFrame();
})();
