# 网站图标

`jiangcheng-icon.png` 是 512×512 的图标，`favicon.ico` 包含 16、32、48、64 像素四档尺寸。
图案使用黄鹤楼意象、江水笔触和朱砂落日，匹配页面的宣纸、墨色与朱砂配色。

页面在 `src/00-shell.html` 中以 data URL 内嵌 ICO，运行 `./build.sh` 后，
`dist/index.html` 无需携带外部图标文件即可显示 favicon。
更新 ICO 时须同步替换该 data URL，并重新构建。

生成方式：内置 imagegen 生成原图，再通过 Pillow 缩放、导出 PNG 和多尺寸 ICO。

## 生成提示词

Create one square favicon / app icon for 水墨江城, a Chinese ink painting interactive 3D map of Wuhan. Minimal bold iconic design legible at 16 and 32 pixels. A large centered near-black #1f1e1b silhouette of Wuhan Yellow Crane Tower, simplified to three boldly separated upward-curving roof tiers, strong wide eaves and a small finial. Below it two short flowing horizontal ink strokes suggest the Yangtze river. A single small cinnabar red #b5432f sun upper right of tower. Warm solid rice paper #E6E3DA background filling the entire square, very subtle print texture only. Flat graphic logo with just a touch of woodcut brush character, high contrast, clean sparse shapes, minimal interior details, generous but not excessive margins, tower fills about 75 percent of image. No text, no letters, no borders, no mockup, no shadows, no gradient, no extra landscape. Generate exactly one polished square icon.

## 江岸街巷

`lane-materials.webp` 是砖墙、石灰抹面、灰瓦和木纹的四格水墨材质。`lane-windows.webp` 绘有帘布茶壶、柳影、竹帘与陶瓶、靛布晾衣四种窗内景。`lane-earth.webp` 为院落沙土、砾石与苔痕。三张原画由 ImageGen 为此项目生成，缩放为 1024 或 512 像素的 WebP。构建时嵌入 HTML，模型按局部坐标取样，远景逐渐淡去。

`lane-foliage.webp` 是透明底的樟树枝梢，原画用工笔勾枝、没骨点叶，叶群以灰绿、靛青和淡赭分层。裁缩后保留透明叶隙，供近树的三维枝冠取样。

`river-sky.webp` 是江上薄雾的浅色写生，以冷灰、淡紫和浅赭晕染天空。页面按镜头方向显示云气，天际与江面的实景轮廓由模型绘制。
