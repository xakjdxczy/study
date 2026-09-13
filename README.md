# 学习资料站

网页目录按 **年级 → 学科** 组织，方便 VPS / GitHub Pages 直接浏览。

## 在线打开

- 总入口：https://xakjdxczy.github.io/study/
- 小学全科：https://xakjdxczy.github.io/study/小学/
- 阳光英语（五年级互动课本）：https://xakjdxczy.github.io/study/阳光英语/

## 目录结构

```
index.html                 # 总入口
小学/
  index.html               # 选年级
  <年级>/
    index.html             # 选学科
    <学科>/index.html      # 课程大纲页
content/小学/<年级>/<学科>/大纲.md   # Markdown 源文件（与网页同序）
阳光英语/                  # 原五年级英语互动站点
```

## 进度

- 一年级、二年级：八科大纲已填
- 三～六年级：大纲占位，待补
- 单元精讲与练习：逐步填充

## 本地预览

```bash
python3 -m http.server 8080
```

浏览器打开 http://localhost:8080
