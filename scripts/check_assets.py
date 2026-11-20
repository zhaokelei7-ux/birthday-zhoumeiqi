#!/usr/bin/env python3
"""校验人员数据与音频资源，供本地检查和 CI 使用。"""

import argparse
import json
import sys
from pathlib import Path

# Windows 管道输出默认使用 GBK，统一成 UTF-8 以正确输出 ✓/✗ 等符号。
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

EXPECTED_GROUPS = {"classmate": 20, "volunteer": 7, "teacher": 1}
EXPECTED_TEAMS = ["冲刺队", "战神队", "超越队", "力量队"]


def check_people(root):
    path = root / "data" / "people.json"
    if not path.exists():
        print(f"✗ 找不到 {path}")
        return None, False

    try:
        people = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        print(f"✗ people.json 不是合法 JSON：{error}")
        return None, False

    ok = True
    if len(people) != 28:
        print(f"✗ 人数应为 28，实际 {len(people)}")
        ok = False

    names = [person.get("name", "") for person in people]
    if len(set(names)) != len(names):
        print("✗ 存在重名")
        ok = False

    for group, expected in EXPECTED_GROUPS.items():
        actual = sum(1 for person in people if person.get("group") == group)
        if actual != expected:
            print(f"✗ {group} 数量应为 {expected}，实际 {actual}")
            ok = False

    for team in EXPECTED_TEAMS:
        actual = sum(
            1
            for person in people
            if person.get("group") == "classmate" and person.get("team") == team
        )
        if actual != 5:
            print(f"✗ {team} 应有 5 人，实际 {actual}")
            ok = False

    for person in people:
        name = person.get("name", "?")
        blessing = person.get("blessing", "")
        if not isinstance(blessing, str) or not blessing.strip():
            print(f"✗ {name} 缺少祝福文案")
            ok = False
        elif not 8 <= len(blessing.strip()) <= 300:
            print(f"✗ {name} 的祝福长度不合适：{len(blessing.strip())} 字")
            ok = False

        group = person.get("group")
        team = person.get("team")
        if group == "classmate" and team not in EXPECTED_TEAMS:
            print(f"✗ {name} 的队伍无效：{team}")
            ok = False
        if group == "volunteer" and team != "志工团":
            print(f"✗ {name} 的志工分组应为「志工团」")
            ok = False
        if group == "teacher" and team != "班主任":
            print(f"✗ {name} 的班主任分组应为「班主任」")
            ok = False

    if ok:
        print(f"✓ 人员数据通过：{len(people)} 人")
    return people, ok


def check_audio(root, people, strict):
    manifest_path = root / "data" / "audio-manifest.json"
    if not manifest_path.exists():
        message = "! 缺少 audio-manifest.json"
        print(message + ("（--strict 下视为失败）" if strict else "（非严格模式忽略）"))
        return not strict

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        print(f"✗ audio-manifest.json 不是合法 JSON：{error}")
        return False

    ok = True
    missing = []
    for person in people:
        name = person["name"]
        entry = manifest.get(name)
        if not entry:
            missing.append(name)
            if strict:
                ok = False
            continue

        file_value = entry.get("file")
        if not isinstance(file_value, str) or not file_value.strip():
            print(f"✗ {name} 的 manifest file 字段无效：{file_value!r}")
            ok = False
            continue

        relative = Path(file_value)
        if relative.is_absolute() or not relative.parts or relative.parts[0] != "audio":
            print(f"✗ {name} 的 manifest file 必须是 audio/ 下的相对路径：{file_value}")
            ok = False
            continue

        audio_root = (root / "audio").resolve()
        audio_path = (root / relative).resolve()
        if not audio_path.is_relative_to(audio_root):
            print(f"✗ {name} 的 manifest file 越出 audio/ 目录：{file_value}")
            ok = False
            continue

        if not audio_path.is_file() or audio_path.stat().st_size == 0:
            print(f"✗ {name} 的音频文件不存在或为空：{file_value}")
            ok = False
            continue

        duration = entry.get("duration")
        if not isinstance(duration, (int, float)) or duration <= 0.3:
            print(f"✗ {name} 的音频时长异常：{duration}")
            ok = False

    if missing:
        print("✗ 缺少音频：" + "、".join(missing))

    if ok and missing:
        print(f"! 已登记的 {len(people) - len(missing)} 段音频有效，仍缺 {len(missing)} 段（非严格模式忽略）")
    elif ok:
        print(f"✓ 音频资源通过：{len(people)} 段")
    return ok


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=Path(__file__).resolve().parents[1])
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()
    root = Path(args.root).resolve()

    people, people_ok = check_people(root)
    if not people_ok or people is None:
        return 1

    audio_ok = check_audio(root, people, args.strict)
    return 0 if audio_ok else 1


if __name__ == "__main__":
    sys.exit(main())
