# 周美琪的生日祝福

一个可以发链接的生日祝福单页：夜空里挂着 28 颗星，四支队伍与志工各自连成星座，班主任是最高处那颗大星。点击姓名即点亮该星并开始播放录音，听完显示文字祝福；28 颗星全部点亮后下起流星雨。

## 项目结构

```
index.html            页面结构
styles.css            全部样式
js/geometry.js        星星坐标、星座连线与 SVG 路径（纯函数）
js/state.js           点亮/播放状态机（纯函数）
js/storage.js         localStorage 读写
js/audio.js           语音播放控制
js/finale.js          canvas 流星雨
js/app.js             页面渲染与事件
data/people.json      28 人名单与祝福
data/audio-manifest.json  音频清单（由脚本生成）
audio/                转码后的音频（部署用）
audio-src/            原始录音（不提交、不部署）
scripts/              音频转码与资源校验
tests/                自动化测试
```

## 本地预览

ES Modules 不能直接用 `file://` 打开，需要起一个本地服务器：

```bash
/d/miniconda/envs/finpy/python.exe -m http.server 8000
```

打开 http://localhost:8000/ 。

## 录音要求

- 每人一段，安静环境录制，离麦克风 10–20cm。
- 每段 2–15 秒（部署检查只强制要求大于 0.3 秒），开头直接说「周美琪，生日快乐！」。
- 文件名写姓名，例如 `宋书涵.m4a`。
- 支持的格式：`.mp3`、`.m4a`、`.aac`、`.wav`、`.ogg`、`.flac`、`.amr`。
- 把文件放进 `audio-src/`，不要放进 `audio/`。

## 导入录音

```bash
/d/miniconda/envs/finpy/python.exe scripts/convert_audio.py
```

脚本会：

1. 按 `data/people.json` 的顺序查找 `audio-src/<姓名>.<扩展名>`；
2. 转成 `audio/p01.mp3` … `audio/p28.mp3`（单声道 16kHz 64kbps，响度归一化）；
3. 生成 `data/audio-manifest.json`；
4. 打印缺失名单。

如果缺少 `imageio-ffmpeg`，先安装：

```bash
/d/miniconda/envs/finpy/python.exe -m pip install imageio-ffmpeg
```

没有 ffmpeg 时脚本只能直接复制 WAV（其余格式读不出时长，会被跳过并计入缺失名单），也不会统一音量；网页对这些缺失项只展示祝福、不播放语音。部署前请安装 `imageio-ffmpeg`。

## 校验

```bash
# 日常检查：音频不齐也能通过，只校验人员数据和已登记的音频
/d/miniconda/envs/finpy/python.exe scripts/check_assets.py

# 部署前严格检查（要求 28 段音频齐全且时长 > 0.3 秒）
/d/miniconda/envs/finpy/python.exe scripts/check_assets.py --strict
```

`--strict` 要求 manifest 中每个人对应的音频文件存在、非空、时长大于 0.3 秒。如果 manifest 已经存在但不完整，非严格检查也会报错。

## 测试

```bash
npm test
/d/miniconda/envs/finpy/python.exe -m unittest discover -s tests -p "test_*.py" -v
```

## 修改星空

- 星星坐标与名字标签的偏移在 `js/geometry.js` 的 `TEAM_POINTS`、`VOLUNTEER_POINTS`、`TEACHER_POINT`；移动后打开页面确认标签不互相压字。
- 队伍配色在 `js/geometry.js` 的 `GROUP_COLORS` 与 `styles.css` 的 `--team-*` 变量里，两处要一起改。
- 背景小星星的分布用固定随机种子，改 `backgroundStars()` 里的 `seed` 可以换一片星空。

## 修改祝福文案

直接编辑 `data/people.json` 的 `blessing` 字段。姓名必须与 `audio-src/` 中的录音文件名一致。祝福文案需为 8–300 个字符（长文案来自录音转写，卡片内会滚动显示），否则 `check_assets.py` 校验不通过。

## 部署到 GitHub Pages

首次部署：

1. 在 GitHub（账号 `zhaokelei7-ux`）新建仓库 `birthday-zhoumeiqi`，不要初始化 README。
2. 打开仓库 Settings → Pages，Source 选择「GitHub Actions」。先启用 Pages，再推送，否则第一次工作流可能失败；工作流里也加了 `enablement: true` 作为兜底。
3. 确认 28 段录音已转换并提交：

```bash
/d/miniconda/envs/finpy/python.exe scripts/convert_audio.py
git add audio data/audio-manifest.json
git commit -m "chore: add 28 recorded blessings"
```

4. 添加远端并推送：

```bash
git remote add origin https://github.com/zhaokelei7-ux/birthday-zhoumeiqi.git
git push -u origin main
```

5. 等待 Actions 完成，链接形如：
   `https://zhaokelei7-ux.github.io/birthday-zhoumeiqi/`

之后每次 push 到 `main` 都会自动校验并部署。如果还没提交 28 段音频就推送，严格校验会失败，这是预期行为。

## 隐私说明

- 页面加了 `noindex`，不会被搜索引擎收录。
- 免费版 GitHub Pages 要求仓库公开，姓名和音频理论上可被直接访问。
- 音频文件使用编号命名，不在 URL 中暴露姓名。
- 如果介意公开，可改用 Netlify / Vercel（源码可私有，站点仍公开），或使用 GitHub Pro 的私有仓库 Pages。
