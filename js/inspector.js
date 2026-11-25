// KOLOM KANAN (ATAS): Inspector Khusus Pengaturan Tulisan, Now Playing, & Visualizer
(function () {
  const mount = document.getElementById('inspector-mount');
  if (!mount) return;

  const s = STUDIO.settings;

  mount.innerHTML = `
    <!-- 1. JUDUL VIDEO UTAMA -->
    <div class="card">
      <div class="card-title"><span>✏️ Judul Video Utama</span></div>

      <label class="check-row">
        <input type="checkbox" id="set-title-on" ${s.titleEnabled ? 'checked' : ''} />
        Tampilkan Judul Utama
      </label>

      <label>Teks Judul</label>
      <input type="text" id="set-title-text" value="${s.titleText.replace(/"/g, '&quot;')}" />

      <div class="label-row">Posisi Vertikal (Atas ↔ Bawah) <span id="val-title-y">${s.titleY}%</span></div>
      <input type="range" id="set-title-y" min="0" max="90" value="${s.titleY}" />

      <div class="label-row">Ukuran Font <span id="val-title-size">${s.titleSize} px</span></div>
      <input type="range" id="set-title-size" min="24" max="96" value="${s.titleSize}" />

      <label>Warna Teks Judul</label>
      <input type="color" id="set-title-color" value="${s.titleColor}" />
    </div>

    <!-- 2. JUDUL LAGU OTOMATIS (NOW PLAYING) -->
    <div class="card" style="margin-top:14px;">
      <div class="card-title"><span>🎵 Judul Lagu Auto (Nama File)</span></div>

      <label class="check-row">
        <input type="checkbox" id="set-np-on" ${s.npEnabled ? 'checked' : ''} />
        Tampilkan Nama Lagu Otomatis
      </label>

      <label>Ikon / Awalan Teks</label>
      <input type="text" id="set-np-prefix" value="${(s.npPrefix || '').replace(/"/g, '&quot;')}" placeholder="contoh: ♪  atau Now Playing: " />

      <label>Perataan Teks</label>
      <select id="set-np-align">
        <option value="left" ${s.npAlign === 'left' ? 'selected' : ''}>Rata Kiri</option>
        <option value="center" ${s.npAlign === 'center' ? 'selected' : ''}>Rata Tengah</option>
        <option value="right" ${s.npAlign === 'right' ? 'selected' : ''}>Rata Kanan</option>
      </select>

      <div class="label-row">Posisi Vertikal (Atas ↔ Bawah) <span id="val-np-y">${s.npY}%</span></div>
      <input type="range" id="set-np-y" min="6" max="98" value="${s.npY}" />

      <div class="label-row">Ukuran Font <span id="val-np-size">${s.npSize} px</span></div>
      <input type="range" id="set-np-size" min="18" max="64" value="${s.npSize}" />

      <label>Warna Teks Lagu</label>
      <input type="color" id="set-np-color" value="${s.npColor}" />
    </div>

    <!-- 3. VISUALIZER MUSIK -->
    <div class="card" style="margin-top:14px;">
      <div class="card-title"><span>📊 Visualizer Musik</span></div>

      <label>Gaya Visualizer</label>
      <select id="set-vis-style">
        <option value="bar" ${s.visStyle === 'bar' ? 'selected' : ''}>Spectrum Bar (Batang)</option>
        <option value="wave" ${s.visStyle === 'wave' ? 'selected' : ''}>Gelombang Suara (Wave)</option>
        <option value="off" ${s.visStyle === 'off' ? 'selected' : ''}>Matikan (Render Tercepat!)</option>
      </select>

      <label>Warna Visualizer</label>
      <input type="color" id="set-vis-color" value="${s.visColor}" />

      <div class="label-row">Posisi Vertikal <span id="val-vis-y">${s.visY}%</span></div>
      <input type="range" id="set-vis-y" min="0" max="100" value="${s.visY}" />

      <div class="label-row">Tinggi Visualizer <span id="val-vis-h">${s.visHeight} px</span></div>
      <input type="range" id="set-vis-h" min="60" max="300" step="10" value="${s.visHeight}" />
    </div>
  `;

  function bind(id, key, type, valId, suffix) {
    const el = document.getElementById(id);
    const evt = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(evt, () => {
      if (type === 'bool') s[key] = el.checked;
      else if (type === 'num') s[key] = Number(el.value);
      else s[key] = el.value;

      if (valId) document.getElementById(valId).textContent = `${s[key]}${suffix || ''}`;
      STUDIO.saveSettings();
    });
  }

  bind('set-title-on', 'titleEnabled', 'bool');
  bind('set-title-text', 'titleText', 'str');
  bind('set-title-y', 'titleY', 'num', 'val-title-y', '%');
  bind('set-title-size', 'titleSize', 'num', 'val-title-size', ' px');
  bind('set-title-color', 'titleColor', 'str');

  bind('set-np-on', 'npEnabled', 'bool');
  bind('set-np-prefix', 'npPrefix', 'str');
  bind('set-np-align', 'npAlign', 'str');
  bind('set-np-y', 'npY', 'num', 'val-np-y', '%');
  bind('set-np-size', 'npSize', 'num', 'val-np-size', ' px');
  bind('set-np-color', 'npColor', 'str');

  bind('set-vis-style', 'visStyle', 'str');
  bind('set-vis-color', 'visColor', 'str');
  bind('set-vis-y', 'visY', 'num', 'val-vis-y', '%');
  bind('set-vis-h', 'visHeight', 'num', 'val-vis-h', ' px');
})();
