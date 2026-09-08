# 小肚子雷达 · Little Tummy Lab

适合手机使用的儿童食物探索单页面应用。React + TypeScript + Vite，纯静态部署，无后端、账号或照片上传。

## 本地使用

需要 Node.js 24 和 npm。

```sh
npm ci
npm run dev
```

访问终端给出的本地地址。同一 Wi-Fi 下的手机可访问终端中的 Network 地址。点击“开始扫描”，约 4 秒旋转三圈后显示预设结果。长按右上角“家长设置”1.5 秒打开菜单，电脑也可聚焦该按钮后按 Enter。

六档大小：蓝莓、草莓、小枣、鸡蛋、苹果、大苹果。默认第 4 档，食物默认苹果、香蕉和米饭。支持多选、结果预览、可选音效；默认静音。系统开启减少动态效果时，扫描缩短至 600 毫秒。

家长菜单“更多设置”提供胃部蠕动开关，以及独立的速度、幅度 1～5 级调节，附实时预览。默认关闭、速度 3 级、幅度 2 级；保存后作用于扫描结果并在刷新后保留。速度从每周期 6 秒到 1.2 秒，幅度从轻微到明显。旧版本设置自动补全默认值。系统开启减少动态效果时暂停蠕动。

## 照片与数据

“食物朋友”中可拍照或从图库选择，拖动、缩放裁剪后输入名称保存。图片本地生成 768 × 768 JPEG，渐变透明的边缘由 SVG 遮罩处理，所有食物统一裁切在胃内。照片不会自动去背景。单张输入上限 25 MB；浏览器无法解码的格式会提示转换。

设置保存在 localStorage，照片保存在 IndexedDB。照片保存/删除立即作用于素材库；食物选择和等级需要点击“保存设置”。清理浏览器数据会删除照片，不同域名、端口、浏览器及设备的数据不互通。图库删除无法撤销。

这是家长预设的趣味模拟，不测量真实胃部，也不提供健康判断。

## GitHub Pages 发布

1. 在 GitHub 新建一个空仓库。
2. 将本地仓库关联并推送（替换下面的地址）：

```sh
git remote add origin https://github.com/YOUR_NAME/YOUR_REPO.git
git push -u origin main
```

3. 打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
4. 工作流 `.github/workflows/deploy.yml` 自动测试、构建并部署；必要时在 Actions 中手动运行 “Deploy to GitHub Pages”。
5. 完成后，Pages 设置和工作流会显示网站地址，通常为 `https://YOUR_NAME.github.io/YOUR_REPO/`。

Vite 使用相对资源路径 `base: './'`，没有路径路由，支持仓库子目录部署；请使用带结尾 `/` 的网站根地址。工作流参考 [Vite 官方静态部署文档](https://vite.dev/guide/static-deploy.html#github-pages)。当前仅初始化本地仓库，未创建 GitHub 远程仓库或实际上线。

## 检查

```sh
npm test
npm run build
npm run preview
```

自动测试覆盖扫描状态、重复扫描、设置保存/取消、预览、损坏数据与存储失败、照片库增删与重新读取。生产构建先执行 TypeScript 检查。页面内使用 SVG/CSS 与系统 Emoji，无外部字体或素材服务依赖，Emoji 外观随系统不同。

布局含 320px 小屏、手机、横屏和桌面断点。已在 Wework 内置浏览器验证桌面扫描与结果；真实 iOS Safari / Android Chrome 的相机调用、照片裁剪手势及手机布局仍需设备验收。`capture="environment"` 是系统提示，具体选图菜单由设备决定；GitHub Pages 的 HTTPS 地址适合最终验收。
