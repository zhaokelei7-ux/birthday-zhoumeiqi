import json
import math
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONVERT = ROOT / "scripts" / "convert_audio.py"
CHECK = ROOT / "scripts" / "check_assets.py"
PYTHON = sys.executable


def have_ffmpeg():
    try:
        import imageio_ffmpeg
        if imageio_ffmpeg.get_ffmpeg_exe():
            return True
    except Exception:
        pass
    return shutil.which("ffmpeg") is not None


HAVE_FFMPEG = have_ffmpeg()


def make_wav(path, seconds=0.6, freq=440.0):
    path.parent.mkdir(parents=True, exist_ok=True)
    rate = 16000
    frames = bytearray()
    for i in range(int(rate * seconds)):
        value = int(0.25 * 32767 * math.sin(2 * math.pi * freq * i / rate))
        frames += struct.pack("<h", value)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(bytes(frames))


class AudioToolsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "data").mkdir()
        people = json.loads((ROOT / "data" / "people.json").read_text(encoding="utf-8"))
        (self.root / "data" / "people.json").write_text(
            json.dumps(people, ensure_ascii=False), encoding="utf-8"
        )
        (self.root / "audio-src").mkdir()
        for index, person in enumerate(people):
            make_wav(self.root / "audio-src" / f"{person['name']}.wav", 0.6, 300 + index * 10)

    def tearDown(self):
        self.tmp.cleanup()

    def run_script(self, script, *args):
        return subprocess.run(
            [PYTHON, str(script), "--root", str(self.root), *args],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )

    def test_convert_creates_manifest_and_audio(self):
        result = self.run_script(CONVERT)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

        manifest_path = self.root / "data" / "audio-manifest.json"
        self.assertTrue(manifest_path.exists())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        people = json.loads((self.root / "data" / "people.json").read_text(encoding="utf-8"))
        self.assertEqual(len(manifest), len(people))

        for entry in manifest.values():
            audio_path = self.root / entry["file"]
            self.assertTrue(audio_path.exists())
            self.assertGreater(audio_path.stat().st_size, 0)
            self.assertGreater(entry["duration"], 0.3)

    def test_check_assets_passes_after_conversion(self):
        conversion = self.run_script(CONVERT)
        self.assertEqual(conversion.returncode, 0, conversion.stdout + conversion.stderr)

        result = self.run_script(CHECK, "--strict")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_check_assets_fails_when_audio_missing(self):
        result = self.run_script(CHECK, "--strict")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("audio-manifest.json", result.stdout)

    def test_nonstrict_check_allows_partial_audio(self):
        sources = sorted((self.root / "audio-src").glob("*.wav"))
        for source in sources[1:]:
            source.unlink()

        conversion = self.run_script(CONVERT)
        self.assertEqual(conversion.returncode, 1, conversion.stdout + conversion.stderr)

        relaxed = self.run_script(CHECK)
        self.assertEqual(relaxed.returncode, 0, relaxed.stdout + relaxed.stderr)
        self.assertIn("仍缺", relaxed.stdout)

        strict = self.run_script(CHECK, "--strict")
        self.assertNotEqual(strict.returncode, 0)

    def test_convert_preserves_existing_manifest_when_no_sources(self):
        manifest_path = self.root / "data" / "audio-manifest.json"
        existing = {
            "宋书涵": {"file": "audio/p01.mp3", "duration": 1.23},
        }
        manifest_path.write_text(
            json.dumps(existing, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        before = manifest_path.read_bytes()
        shutil.rmtree(self.root / "audio-src")
        (self.root / "audio-src").mkdir()

        result = self.run_script(CONVERT)

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertEqual(manifest_path.read_bytes(), before)
        self.assertIn("保留现有 manifest", result.stdout)

    def test_check_assets_rejects_manifest_files_outside_audio(self):
        people = json.loads((self.root / "data" / "people.json").read_text(encoding="utf-8"))
        (self.root / "audio").mkdir()
        (self.root / "audio" / "ok.mp3").write_bytes(b"fake mp3")
        (Path(self.tmp.name) / "people.json").write_text("[]", encoding="utf-8")
        target = people[0]["name"]
        manifest_path = self.root / "data" / "audio-manifest.json"

        bad_files = ["../people.json", str(self.root / "data" / "people.json")]
        for bad_file in bad_files:
            manifest = {
                person["name"]: {
                    "file": bad_file if person["name"] == target else "audio/ok.mp3",
                    "duration": 1.0,
                }
                for person in people
            }
            manifest_path.write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            result = self.run_script(CHECK, "--strict")

            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn(f"✗ {target}", result.stdout)
            self.assertIn("manifest file 必须是 audio/ 下的相对路径", result.stdout)

    @unittest.skipUnless(HAVE_FFMPEG, "需要 ffmpeg 才能验证转码失败路径")
    def test_convert_fails_when_transcode_fails(self):
        root = Path(self.tmp.name) / "corrupt"
        (root / "data").mkdir(parents=True)
        people = [
            {
                "name": "测试员",
                "group": "teacher",
                "team": "班主任",
                "blessing": "周美琪，生日快乐！愿你天天开心。",
            }
        ]
        (root / "data" / "people.json").write_text(
            json.dumps(people, ensure_ascii=False), encoding="utf-8"
        )
        (root / "audio-src").mkdir()
        (root / "audio-src" / "测试员.m4a").write_bytes(b"this is not audio")

        result = subprocess.run(
            [PYTHON, str(CONVERT), "--root", str(root)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )

        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("转码失败", result.stdout)
        self.assertFalse((root / "audio" / "p01.mp3").exists())


if __name__ == "__main__":
    unittest.main()
