import os
import sys
import json
import math
import subprocess
import gdown

# Baca parameter aman lewat Environment Variables
BG_ID = os.environ.get("BG_ID", "").strip()
BG_NAME = os.environ.get("BG_NAME", "background").strip()
PLAYLIST = json.loads(os.environ.get("PLAYLIST_JSON", "[]"))
SETTINGS = json.loads(os.environ.get("SETTINGS_JSON", "{}"))

if not BG_ID:
    sys.exit("ERROR: Background belum dipilih!")
if not PLAYLIST:
    sys.exit("ERROR: Playlist lagu kosong!")

os.makedirs("work/audio", exist_ok=True)


def download_gdrive(file_id, out_path, label):
    print(f"⬇️ Mengunduh {label} (ID: {file_id})...")
    result = gdown.download(id=file_id, output=out_path, quiet=False)
    if not result or not os.path.exists(out_path) or os.path.getsize(out_path) == 0:
        sys.exit(
            f"ERROR: Gagal mengunduh '{label}' dari Google Drive. "
            "Pastikan folder/file di-share 'Anyone with the link (Viewer)'."
        )


def get_duration(filepath, fallback=10.0):
    try:
        out = subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", filepath
        ]).decode().strip()
        val = float(out)
        return val if val > 0 else fallback
    except Exception:
        return fallback


def hex_to_ass_color(hex_str, default="&H00FFFFFF"):
    h = (hex_str or "").strip().lstrip("#")
    if len(h) == 6:
        r, g, b = h[0:2], h[2:4], h[4:6]
        return f"&H00{b}{g}{r}".upper()
    return default


def fmt_yt_time(sec):
    s = int(sec)
    h, m, s = s // 3600, (s % 3600) // 60, s % 60
    return f"{h}:{m:02d}:{s:02d}" if h > 0 else f"{m:02d}:{s:02d}"


def fmt_ass_time(sec):
    cs = int(round(sec * 100))
    h = cs // 360000
    m = (cs % 360000) // 6000
    s = (cs % 6000) // 100
    c = cs % 100
    return f"{h}:{m:02d}:{s:02d}.{c:02d}"


def safe_ass(text):
    return str(text or "").replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\n", " ")


# 1. Unduh Background terpilih
bg_raw = "work/bg_raw"
download_gdrive(BG_ID, bg_raw, BG_NAME)
mime_bg = subprocess.check_output(["file", "--mime-type", "-b", bg_raw]).decode().strip()
is_bg_image = mime_bg.startswith("image/")
print(f"Tipe Background: {mime_bg} ({'Gambar' if is_bg_image else 'Video'})")

# 2. Unduh & Normalisasi lagu-lagu terpilih di Playlist (sesuai urutan)
tracks = []
for idx, item in enumerate(PLAYLIST):
    file_id = item["id"]
    song_title = item.get("n") or f"Track {idx + 1}"
    raw_audio = f"work/audio/raw_{idx:03d}"
    norm_audio = os.path.abspath(f"work/audio/track_{idx:03d}.m4a")

    download_gdrive(file_id, raw_audio, song_title)

    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-i", raw_audio,
        "-vn", "-ar", "44100", "-ac", "2", "-c:a", "aac", "-b:a", "192k", norm_audio
    ], check=True)

    dur = get_duration(norm_audio, fallback=180.0)
    tracks.append((norm_audio, song_title, dur))
    os.remove(raw_audio)

total_sec = sum(t[2] for t in tracks)
print(f"🎵 Total {len(tracks)} lagu terpilih | Total durasi: {total_sec / 60:.2f} menit ({total_sec:.2f} dtk)")

# 3. Gabungkan semua audio instan (-c copy)
with open("work/concat_list.txt", "w", encoding="utf-8") as f:
    for path, _, _ in tracks:
        f.write(f"file '{path}'\n")

subprocess.run([
    "ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
    "-i", "work/concat_list.txt", "-c", "copy", "work/full_audio.m4a"
], check=True)

# 4. Buat Chapters YouTube & Subtitle (.ass) presisi sesuai slider Preview
title_on = bool(SETTINGS.get("titleEnabled", True))
title_text = (SETTINGS.get("titleText") or "").strip()
title_y_pct = float(SETTINGS.get("titleY", 8))
title_size = int(SETTINGS.get("titleSize", 52))
title_color = hex_to_ass_color(SETTINGS.get("titleColor", "#ffffff"))

np_on = bool(SETTINGS.get("npEnabled", True))
np_prefix = SETTINGS.get("npPrefix", "♪  ")
np_align = SETTINGS.get("npAlign", "center")
np_y_pct = float(SETTINGS.get("npY", 93))
np_size = int(SETTINGS.get("npSize", 34))
np_color = hex_to_ass_color(SETTINGS.get("npColor", "#eeeeee"))

chapters_lines = []
ass_events = []

if title_on and title_text:
    title_y_px = int(round((title_y_pct / 100.0) * 1080))
    ass_events.append(
        f"Dialogue: 0,0:00:00.00,{fmt_ass_time(total_sec)},Title,,0,0,0,,"
        f"{{\\an8\\pos(960,{title_y_px})}}{safe_ass(title_text)}"
    )

an_map = {"left": (1, 80), "center": (2, 960), "right": (3, 1840)}
np_an, np_x_px = an_map.get(np_align, (2, 960))
np_y_px = int(round((np_y_pct / 100.0) * 1080))

cursor = 0.0
for _, song_title, dur in tracks:
    chapters_lines.append(f"{fmt_yt_time(cursor)} {song_title}")
    if np_on:
        label = safe_ass(f"{np_prefix}{song_title}")
        ass_events.append(
            f"Dialogue: 0,{fmt_ass_time(cursor)},{fmt_ass_time(cursor + dur)},NowPlaying,,0,0,0,,"
            f"{{\\an{np_an}\\pos({np_x_px},{np_y_px})}}{label}"
        )
    cursor += dur

with open("chapters.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(chapters_lines))

has_ass = len(ass_events) > 0
if has_ass:
    ass_content = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,DejaVu Sans,{title_size},{title_color},{title_color},&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,2,8,40,40,40,1
Style: NowPlaying,DejaVu Sans,{np_size},{np_color},{np_color},&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,2,2,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(ass_events)
    with open("work/overlays.ass", "w", encoding="utf-8") as f:
        f.write(ass_content)

# 5. Pre-scale background 1x di awal + Loop TERBATAS (ANTI MACET di frame terakhir!)
vis_style = SETTINGS.get("visStyle", "bar")
vis_color = SETTINGS.get("visColor", "#00ffcc")
vis_y_pct = float(SETTINGS.get("visY", 78))
vis_h = int(max(40, min(400, int(SETTINGS.get("visHeight", 150)))))
vis_h = vis_h - (vis_h % 2)
vis_top = int(round((vis_y_pct / 100.0) * (1080 - vis_h)))

has_motion = (not is_bg_image) or (vis_style != "off")
fps = 24 if has_motion else 2

cmd = ["ffmpeg", "-y"]
if is_bg_image:
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-i", bg_raw,
        "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1",
        "-q:v", "2", "work/bg_ready.jpg"
    ], check=True)
    cmd += ["-framerate", str(fps), "-loop", "1", "-t", f"{total_sec + 1:.3f}", "-i", "work/bg_ready.jpg"]
else:
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-i", bg_raw, "-an",
        "-vf", f"scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps={fps},setsar=1,format=yuv420p",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "work/bg_ready.mp4"
    ], check=True)
    bg_dur = get_duration("work/bg_ready.mp4", fallback=10.0)
    loop_count = max(0, math.ceil(total_sec / bg_dur))
    print(f"🔁 Video AI durasi {bg_dur:.2f} dtk → di-loop terbatas {loop_count}x (anti macet)")
    cmd += ["-stream_loop", str(loop_count), "-i", "work/bg_ready.mp4"]

cmd += ["-i", "work/full_audio.m4a"]

# Rangkai Filter (Visualizer 100% full resolusi & tajam + trim presisi ke total_sec)
filters = [f"[0:v]trim=duration={total_sec:.3f},setpts=PTS-STARTPTS,format=yuv420p[v0]"]
cur = "v0"

if vis_style == "bar":
    filters.append(
        f"[1:a]showfreqs=s=1400x{vis_h}:mode=bar:ascale=sqrt:fscale=log:colors={vis_color},"
        f"fps={fps},format=rgba,colorkey=0x000000:0.12:0.12[vis]"
    )
    filters.append(f"[{cur}][vis]overlay=(W-w)/2:{vis_top}:eof_action=pass:format=auto[v1]")
    cur = "v1"
elif vis_style == "wave":
    filters.append(
        f"[1:a]showwaves=s=1400x{vis_h}:mode=cline:rate={fps}:colors={vis_color},"
        f"format=rgba,colorkey=0x000000:0.12:0.12[vis]"
    )
    filters.append(f"[{cur}][vis]overlay=(W-w)/2:{vis_top}:eof_action=pass:format=auto[v1]")
    cur = "v1"

if has_ass:
    filters.append(f"[{cur}]ass=work/overlays.ass[v2]")
    cur = "v2"

filters.append(f"[{cur}]format=yuv420p[vout]")

cmd += [
    "-filter_complex", ";".join(filters),
    "-map", "[vout]", "-map", "1:a",
    "-t", f"{total_sec:.3f}",
    "-c:v", "libx264", "-preset", "superfast", "-crf", "23",
    "-maxrate", "6000k", "-bufsize", "12000k", "-g", str(fps * 2),
    "-movflags", "+faststart",
]
if not has_motion:
    cmd += ["-tune", "stillimage"]

cmd += ["-c:a", "copy", "output.mp4"]

print("🚀 Memulai Render Mode Turbo (Anti Macet & Ukuran Ramping)...")
subprocess.run(cmd, check=True)

size_mb = os.path.getsize("output.mp4") / (1024 * 1024)
print(f"✅ RENDER SELESAI! Ukuran output.mp4: {size_mb:.1f} MB | Durasi: {total_sec / 60:.2f} menit")
