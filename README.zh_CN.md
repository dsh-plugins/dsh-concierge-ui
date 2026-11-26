<div align="center">

<img src="icon.svg" width="256" height="256" alt="dsh-concierge-ui 图标">

# dsh-concierge-ui

**在浏览器给棱镜发消息、跟进后台任务，并按需打开只读会话。**

[English](README.md) | 简体中文

</div>

## 在 DSH 网页端安装

在 DSH 的 **插件 → 添加插件** 中按安装指南列出的顺序安装并启用五个 `@dsh-prism` 包。此包可按完整包名 `@dsh-prism/dsh-concierge-ui@0.1.1` 安装。[前端安装图解](https://prism.dsh-plug.in/zh/guide/start)

在 **设置 → 模型** 添加模型提供商，在工作区选好模型。打开 **设置 → 棱镜** 添加项目目录和代理工具权限，再打开棱镜发送跨项目请求。任务卡可展开查看进度，也可进入执行代理的只读会话。[双项目操作示例](https://prism.dsh-plug.in/zh/guide/start)

## 从源码运行独立宿主

需要 Node.js 24.9 或更高版本、npm、Git，以及对五个私有插件仓库的 Git 读取权限。检出脚本把匹配的插件和启动文件放入本机的 `runtime/` 目录，后续安装、配置和运行命令均在该目录执行。公开使用指南可直接阅读。需要调用示例模型时，请先在 DSH 凭据存储中配置 DeepSeek 凭据，或设置环境变量 `DEEPSEEK_API_KEY`。[安装指南](https://prism.dsh-plug.in/zh/)

```sh
git clone https://github.com/dsh-plugins/dsh-prism.git
cd dsh-prism
node scripts/checkout.mjs
cd runtime
npm ci
npm run build
npm start
```

## 开始对话

打开棱镜宿主打印的登录链接。DSH 完成浏览器认证后会打开 `/prism`。输入请求，按 Enter 发送，按 Shift + Enter 换行。例如，可以问「这个项目在哪里校验模型切换？」

## 选择模型与查看进展

打开发送按钮左侧的模型选择器，阅读能力介绍，选择后续对话使用的 L1 模型。代理派发请求后，对话中会出现默认折叠的任务卡。展开卡片可查看状态和执行步骤，点击「查看只读会话」可阅读实际处理记录。刷新页面会恢复对话。界面会采用浏览器偏好的受支持语言。

[棱镜使用指南](https://prism.dsh-plug.in/zh/) · [技术参考](docs/TECH.md)
