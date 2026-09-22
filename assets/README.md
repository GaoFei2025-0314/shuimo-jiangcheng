# 网站图标

`jiangcheng-icon.png` 是 512×512 的图标，`favicon.ico` 包含 16、32、48、64 像素四档尺寸。
图案使用黄鹤楼意象、江水笔触和朱砂落日，匹配页面的宣纸、墨色与朱砂配色。

页面在 `src/00-shell.html` 中以 data URL 内嵌 ICO，运行 `./build.sh` 后，
`dist/index.html` 无需携带外部图标文件即可显示 favicon。
更新 ICO 时须同步替换该 data URL，并重新构建。

生成方式：内置 imagegen 生成原图，再通过 Pillow 缩放、导出 PNG 和多尺寸 ICO。

## 生成提示词

Create one square favicon / app icon for 水墨江城, a Chinese ink painting interactive 3D map of Wuhan. Minimal bold iconic design legible at 16 and 32 pixels. A large centered near-black #1f1e1b silhouette of Wuhan Yellow Crane Tower, simplified to three boldly separated upward-curving roof tiers, strong wide eaves and a small finial. Below it two short flowing horizontal ink strokes suggest the Yangtze river. A single small cinnabar red #b5432f sun upper right of tower. Warm solid rice paper #E6E3DA background filling the entire square, very subtle print texture only. Flat graphic logo with just a touch of woodcut brush character, high contrast, clean sparse shapes, minimal interior details, generous but not excessive margins, tower fills about 75 percent of image. No text, no letters, no borders, no mockup, no shadows, no gradient, no extra landscape. Generate exactly one polished square icon.
