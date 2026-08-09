# 星尘 · Stardust

一款轻量浏览器街机小游戏：接住坠落的流星，躲开陨石。

## 玩法

- 左右移动捕手接住 **流星**（+10 分）
- 躲开 **陨石**（撞到扣生命）
- 生命归零游戏结束；难度随时间上升

## 操作

| 输入 | 作用 |
| --- | --- |
| `←` `→` 或 `A` `D` | 移动 |
| 触屏 / 鼠标拖动 | 移动 |
| `空格` | 暂停 / 继续 |

## 运行

### iPad / 手机（推荐）

1. 合并本仓库到 `main` 后，打开 GitHub → **Settings** → **Pages**
2. Build and deployment 选 **GitHub Actions**
3. 等待 Actions 部署完成，用 Safari 打开：

   **https://xakjdxczy.github.io/study/**

也可临时：Settings → Pages → Deploy from a branch，选含游戏文件的分支、`/`（根目录）。

### 电脑本地

直接用浏览器打开 `index.html`，或：

```bash
python3 -m http.server 8080
```

然后访问 <http://localhost:8080>。
