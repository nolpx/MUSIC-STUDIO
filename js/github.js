// KONEKSI API (TERLIPAT DI KANAN BAWAH) + TOMBOL RENDER & STATUS (TENGAH BAWAH)
(function () {
  const connMount = document.getElementById('connection-mount');
  const renderMount = document.getElementById('render-mount');
  const c = STUDIO.config;

  // 1. Panel Koneksi Terlipat di Kolom Kanan Bawah
  // Otomatis terbuka jika Token/API Key belum diisi; otomatis terlipat setelah terisi!
  const needSetup = !c.ghToken || !c.gdriveApiKey;
  if (connMount) {
    connMount.innerHTML = `
      <details class="collapsible" ${needSetup ? 'open' : ''}>
        <summary>⚙️ Koneksi & API Key</summary>

        <label>Google Drive API Key (Untuk baca folder & preview)</label>
        <input type="password" id="cfg-gdrive-key" placeholder="AIzaSy..." value="${(c.gdriveApiKey || '').replace(/"/g, '&quot;')}" />

        <label>Username GitHub</label>
        <input type="text" id="cfg-gh-owner" value="${(c.ghOwner || 'nolpx').replace(/"/g, '&quot;')}" />

        <label>Nama Repositori</label>
        <input type="text" id="cfg-gh-repo" value="${(c.ghRepo || 'MUSIC-STUDIO').replace(/"/g, '&quot;')}" />

        <label>GitHub Token (Izin: Actions Read/Write)</label>
        <input type="password" id="cfg-gh-token" placeholder="github_pat_..." value="${(c.ghToken || '').replace(/"/g, '&quot;')}" />

        <div class="hint">Semua kunci disimpan aman hanya di browser Anda (localStorage).</div>
      </details>
    `;

    [
      ['cfg-gdrive-key', 'gdriveApiKey'],
      ['cfg-gh-owner', 'ghOwner'],
      ['cfg-gh-repo', 'ghRepo'],
      ['cfg-gh-token', 'ghToken']
    ].forEach(([id, key]) => {
      document.getElementById(id).addEventListener('change', (e) => {
        c[key] = e.target.value.trim();
        STUDIO.saveConfig();
      });
    });
  }

  // 2. Tombol Render & Status Server di Kolom Tengah Bawah
  if (renderMount) {
    renderMount.innerHTML = `
      <div class="render-bar">
        <button id="btn-render-cloud" class="btn btn-primary" style="flex:1; padding:12px; font-size:14px;">
          🚀 Render Playlist di Server GitHub (Mode Turbo)
        </button>
        <button id="btn-check-status" class="btn btn-secondary">🔄 Cek Status</button>
      </div>

      <div class="status-box">
        <strong>📡 Status Server Render GitHub Actions:</strong>
        <div id="statusLog" style="margin-top:8px; color:#8b949e;">
          Pilih 1 Background & minimal 1 lagu di Kolom Kiri, atur tampilan di Kolom Kanan, lalu klik Render.
        </div>
      </div>
    `;

    document.getElementById('btn-render-cloud').addEventListener('click', triggerRender);
    document.getElementById('btn-check-status').addEventListener('click', checkStatus);
  }

  async function triggerRender() {
    const owner = (c.ghOwner || '').trim();
    const repo = (c.ghRepo || '').trim();
    const token = (c.ghToken || '').trim();
    const bg = STUDIO.media.selectedBg;
    const pl = STUDIO.media.playlist;

    if (!token) return alert('Isi GitHub Token dulu di "⚙️ Koneksi & API Key" (Kolom Kanan Bawah)!');
    if (!bg) return alert('Pilih 1 Background dari Folder Background (Kolom Kiri) dulu!');
    if (!pl.length) return alert('Tambahkan minimal 1 lagu ke kotak Playlist Terpilih (Kolom Kiri) dulu!');

    const btn = document.getElementById('btn-render-cloud');
    const log = document.getElementById('statusLog');
    btn.disabled = true;
    log.innerHTML = `⏳ Mengirim ${pl.length} lagu terpilih + pengaturan tampilan ke server GitHub...`;

    try {
      const playlistPayload = pl.map(s => ({ id: s.id, n: s.cleanName }));

      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/render.yml/dispatches`, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            bg_id: bg.id,
            bg_name: bg.name,
            playlist_json: JSON.stringify(playlistPayload),
            settings_json: JSON.stringify(STUDIO.settings)
          }
        })
      });

      if (res.status === 204) {
        log.innerHTML = `✅ Perintah diterima! Server GitHub sedang mengunduh ${pl.length} lagu dan merender dalam Mode Turbo...`;
        setTimeout(checkStatus, 4000);
      } else {
        const err = await res.text();
        log.innerHTML = `❌ Gagal (${res.status}): ${err}`;
      }
    } catch (e) {
      log.innerHTML = `❌ Error: ${e.message}`;
    } finally {
      btn.disabled = false;
    }
  }

  async function checkStatus() {
    const owner = (c.ghOwner || '').trim();
    const repo = (c.ghRepo || '').trim();
    const token = (c.ghToken || '').trim();
    if (!token) return alert('Isi GitHub Token dulu di "⚙️ Koneksi & API Key"!');

    const log = document.getElementById('statusLog');
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=5`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
      });
      const data = await res.json();
      const html = (data.workflow_runs || []).map(run => `
        <div class="run-item">
          <span><b>#${run.run_number}</b> (${run.name}) — ${run.status} (${run.conclusion || 'berjalan...'})</span>
          <a href="${run.html_url}" target="_blank">Buka Detail / Download ↗</a>
        </div>
      `).join('');
      log.innerHTML = html || 'Belum ada riwayat render.';
    } catch (e) {
      log.innerHTML = `❌ Gagal cek status: ${e.message}`;
    }
  }
})();
