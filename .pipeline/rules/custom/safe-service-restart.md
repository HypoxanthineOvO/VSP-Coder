# safe-service-restart

- **标签**: guard
- **严格度**: error
- **钩子点**: always

## 规则内容

重启本项目本地服务时，禁止通过端口批量杀进程，例如禁止使用 `lsof -ti tcp:<port> | xargs kill` 或等价写法。

只能停止能证明属于 VSP-Coder 当前仓库服务的进程。优先使用项目本地 ignored PID 文件；如果 PID 文件已经失准、但端口仍被旧服务占用，可以检查监听端口的进程。停止前必须同时校验：

- PID 来自项目本地 ignored 状态文件，例如 `.vsp-coder/server.pid`，或来自 `ss -ltnp "sport = :${PORT:-4180}"` 的监听进程；
- 进程仍然存在；
- 进程命令必须是 `node apps/server/dist/index.js`，工作目录必须是当前仓库根目录；
- 不得杀 VS Code Remote、端口转发、shell、npm 父进程或其他共享基础设施进程。

如果无法安全证明目标进程归属，就不要杀进程；改用空闲端口启动新实例，或先向用户报告阻塞原因。
