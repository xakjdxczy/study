# 阳光英语 · 八年级全一册

给初中二年级（八年级 / 初二）同学的互动英语课本。十二个单元覆盖人教版八年级常见话题：假期、生活习惯、比较级、最高级、电视节目、职业打算、未来预测、制作步骤、健康建议、礼貌请求、过去进行时，以及现在完成时。

课文、对话和练习均为原创，方便在课堂上或家里点开就用。

## 打开

### 平板 / 手机

云服务器（每次发布都会同步，更新更快）：

**https://117.72.108.246/study/**

GitHub Pages 备份地址：<https://xakjdxczy.github.io/study/>

### 电脑本地

```bash
python3 -m http.server 8080
```

然后访问 <http://localhost:8080>。

打开后先看到 **主目录**，再选 Hello World、26 字母游戏、课本、单元、生词本或进度。

## 怎么用

- **26 字母游戏**：认 A–Z、听字母、按顺序点、大小写翻牌、找缺的字母、看图选开头
- 点英文、对话或短文可以听朗读（浏览器语音）
- 单词页可以把会的词标成「我会了」
- 每个单元有「练一练」：选择、填空、连词成句、判断、听选
- 进度和星星保存在这台设备的浏览器里
- 左右方向键可以翻页

## 单元

| 单元 | 题目 | 重点 |
| --- | --- | --- |
| 1 | Where Did You Go? | 一般过去时 |
| 2 | How Often Do You Exercise? | 频率副词 |
| 3 | I'm More Outgoing | 比较级 |
| 4 | What's the Best Place? | 最高级 |
| 5 | Do You Want to Watch a Show? | want to / 邀请 |
| 6 | I'm Going to Study Computer Science | be going to |
| 7 | Will People Have Robots? | will 预测 |
| 8 | How Do You Make a Milk Shake? | 步骤 / how much |
| 9 | What's the Matter? | should 建议 |
| 10 | Could You Please Help? | 礼貌请求 |
| 11 | What Were You Doing? | 过去进行时 |
| 12 | Have You Ever Been There? | 现在完成时 |

## 检查课文数据

```bash
node tests/validate-content.js
```

## 发布到云服务器

用 root 账号 SSH 同步到 `/var/www/study`（密钥来自环境变量 `SSH_PRIVATE_KEY` / `SSH_HOST`）：

```bash
bash scripts/deploy-server.sh
```
