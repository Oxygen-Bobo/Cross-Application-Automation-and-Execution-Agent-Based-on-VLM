# 跨应用自动化执行 Agent 宣传官网

这是主项目的独立宣传官网，不影响现有 Electron + Python 桌面 Agent 代码。

## 本地运行

```powershell
cd promo-site
npm install
npm run dev
```

构建静态文件：

```powershell
npm run build
```

## 素材路径

当前页面会读取：

- `public/assets/app-main.png`
- `public/assets/timeline.png`
- `public/assets/poster.png`
- `public/assets/floating-orb.png`

如果图片不存在，组件会显示内置占位 Mockup，不会出现空白。
