# Web 对话界面技术参考

完整应用使用五个私有插件仓库，需要已获全部读取权限的 Git 凭据。在公开仓库根目录执行 `node scripts/checkout.mjs` 后进入 `runtime/`，再从该目录运行 npm、配置和启动命令。官网和使用文档可公开访问。[棱镜官网](https://prism.dsh-plug.in/)

插件在 DSH Web 服务器上挂载独立对话页。用户视图包含聊天流、折叠任务卡、模型选择器以及按需读取的任务会话记录。

前端使用 React 18 和 `@dsh-plugin/dsh-ui-components@next`。工作区锁文件记录解析后的确切版本，使用 `npm ci` 可复现同一构建。输入框、模型选择浮层、发送按钮、任务卡和只读弹窗均使用该库中的组件。

在项目根目录运行 `npm run build`，会同时编译插件和浏览器资源。独立页面在自己的 React 根挂载 `DshProvider`，从同源加载 Arco 与 DSH 主题。

## Web 入口

加载插件后，使用 `dsh web` 打印的登录链接。DSH 完成令牌与 Cookie 的交换，随后跳转至 `/prism`。界面使用宿主已认证的 `owner` 主体，将会话持久键固定为 `web:owner`。同一宿主的多个已登录窗口共享对话。

输入框右下角的模型选择器位于发送按钮左侧。打开后可查看各 L1 模型的能力介绍，再切换当前模型。聊天流通过 SSE 接收当前会话快照，显示用户消息、L1 显式发送的消息与任务卡。展开任务后可单独读取其正式会话，记录由协调器校验任务归属。刷新页面会恢复对话，底层记录仅在用户打开或刷新查看器时请求。

| 入口 | 用途 |
| --- | --- |
| `GET /prism/api/view` | 当前对话与允许选择的模型 |
| `GET /prism/api/events` | 初始快照、后续状态变化及重连恢复 |
| `POST /prism/api/message` | 提交 `text` 与防重复的 `requestId` |
| `POST /prism/api/model` | 使用 `modelId` 切换 L1 模型 |
| `GET /prism/api/trace?task=<id>` | 读取所属任务的只读记录 |

写请求使用 JSON 和 `X-Prism-Request: 1`。插件在宿主的授权钩子中限定公开路由，并拒绝原生管理 RPC、WebSocket 升级和原生前端资源。跨机调用通过 Mesh 自行认证的 `POST /prism/mesh/v1`。

## 语言与界面交互

服务端根据 HTTP `Accept-Language` 选择 `de`、`en`、`es`、`fr`、`ja`、`pt`、`ru` 或 `zh` 的界面文案。在浏览器中改变语言偏好并重新加载后，初始 HTML、错误文案及查看器采用匹配的目录。用户输入和模型消息保留原文。

出站 POST 与入站 SSE 快照按发生顺序协调，较迟返回的旧 POST 快照不会覆盖更近的 SSE 状态。模型切换保留草稿，提交失败重试会复用请求 ID。输入法组字时按 Enter 保留候选输入；Shift + Enter 换行。页面在 SSE 中断时重连，页面从往返缓存恢复后重建订阅。Mesh 以及启用的 IM 签名回调各自负责校验相应平台身份。
