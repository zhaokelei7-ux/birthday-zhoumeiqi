#!/usr/bin/env python3
"""把 audio-src 下的录音统一转成浏览器可播放的 mp3，并生成 manifest。"""

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path
from shutil import which

# Windows 管道输出默认使用 GBK，统一成 UTF-8 以正确输出 ✓/✗ 等符号。
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SRC_EXTS = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac", ".amr"]
BROWSER_SAFE_FALLBACK = {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"}


def get_ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return which("ffmpeg")


def probe_duration(ffmpeg, path):
    path = Path(path)
    if not path.exists():
        return 0.0

    if not ffmpeg:
        if path.suffix.lower() == ".wav":
            try:
                import wave
                with wave.open(str(path), "rb") as handle:
                    return handle.getnframes() / float(handle.getframerate())
            except Exception:
                return 0.0
        return 0.0

    result = subprocess.run(
        [ffmpeg, "-hide_banner", "-i", str(path)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )
    for line in result.stderr.splitlines():
        line = line.strip()
        if not line.startswith("Duration:"):
            continue
        value = line.split("Duration:", 1)[1].split(",", 1)[0].strip()
        try:
            hours, minutes, seconds = value.split(":")
            return int(hours) * 3600 + int(minutes) * 60 + float(seconds)
        except ValueError:
            return 0.0
    return 0.0


def find_source(src_dir, name):
    if not src_dir.exists():
        return None
    exact = [src_dir / f"{name}{ext}" for ext in SRC_EXTS]
    for candidate in exact:
        if candidate.exists():
            return candidate
    for candidate in src_dir.iterdir():
        if candidate.is_file() and candidate.stem == name and candidate.suffix.lower() in SRC_EXTS:
            return candidate
    return None


def transcode(ffmpeg, src, dest):
    command = [
        ffmpeg,
        "-y",
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(src),
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "64k",
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11",
        str(dest),
    ]
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )
    return result.returncode == 0 and dest.exists() and dest.stat().st_size > 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    root = Path(args.root).resolve()

    people_path = root / "data" / "people.json"
    if not people_path.exists():
        print(f"✗ 找不到 {people_path}")
        return 1

    people = json.loads(people_path.read_text(encoding="utf-8"))
    src_dir = root / "audio-src"
    out_dir = root / "audio"
    out_dir.mkdir(exist_ok=True)

    ffmpeg = get_ffmpeg()
    if not ffmpeg:
        print("! 未找到 ffmpeg，将直接复制浏览器可播放的源文件")

    manifest = {}
    missing = []

    for index, person in enumerate(people, start=1):
        name = person["name"]
        source = find_source(src_dir, name)
        if not source:
            missing.append(name)
            print(f"✗ {name}: audio-src 中没有找到录音")
            continue

        mp3_path = out_dir / f"p{index:02d}.mp3"

        if ffmpeg:
            if not transcode(ffmpeg, source, mp3_path):
                print(f"✗ {name}: 转码失败（{source.name}）")
                if mp3_path.exists():
                    mp3_path.unlink()
                missing.append(name)
                continue
            relative = f"audio/{mp3_path.name}"
            duration = probe_duration(ffmpeg, mp3_path)
            if duration <= 0:
                print(f"✗ {name}: 无法读取转码后音频时长")
                missing.append(name)
                continue
        elif source.suffix.lower() in BROWSER_SAFE_FALLBACK:
            copy_path = out_dir / f"p{index:02d}{source.suffix.lower()}"
            shutil.copyfile(source, copy_path)
            relative = f"audio/{copy_path.name}"
            duration = probe_duration(None, source)
            if duration <= 0:
                print(f"✗ {name}: 无法读取音频时长，请安装 imageio-ffmpeg")
                missing.append(name)
                copy_path.unlink()
                continue
            print(f"! {name}: 未转码，直接使用 {copy_path.name}")
        else:
            print(f"✗ {name}: 无法处理 {source.suffix}，请安装 imageio-ffmpeg")
            missing.append(name)
            continue

        manifest[name] = {
            "file": relative,
            "duration": round(float(duration or 0.0), 2),
        }
        print(f"✓ {name} -> {relative} ({duration:.1f}s)")

    manifest_path = root / "data" / "audio-manifest.json"
    if not manifest and len(missing) == len(people) and manifest_path.exists():
        print("! 所有录音都未能处理，保留现有 manifest 不变")
        print("缺少或失败的名单：" + "、".join(missing))
        return 1

    manifest_text = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    tmp_path = manifest_path.with_suffix(".json.tmp")
    tmp_path.write_text(manifest_text, encoding="utf-8")
    tmp_path.replace(manifest_path)

    print(f"\n完成：{len(manifest)}/{len(people)} 段音频")
    print(f"manifest: {manifest_path}")
    if missing:
        print("缺少或失败的名单：" + "、".join(missing))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
