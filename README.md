# dsh-concierge-ui
覆盖或新增 Web UI 视图，隐藏原生 DSH 的左侧工作区选择器与目录树，只暴露一个类似聊天软件的全局对话流，以及折叠的「后台任务状态卡片」。

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
