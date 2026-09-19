本次针对 iPhone Chrome 的 Room Controls、Citadels 和 Decrypto 卡住问题进行排查。

已复现的房间身份故障：创建 Citadels 房间并添加 3 个 Bot，断开并重新连接 Socket 后，页面仍显示原来的房间，但服务端的新 Socket 没有房间 session。点击 Start Game 返回 `not in room`。连接处理原来只刷新房间列表，没有恢复身份。现在使用已有 reconnect token 自动恢复，并在恢复前禁用房间操作；旧连接还没过心跳超时时，新连接也能凭正确 token 接管原座位。

线上只读探测访问了用户提供的 `http://47.100.82.242/` 和 `/api/games`。TCP 连接约 10 毫秒建立，但在 10–15 秒内没有任何 HTTP 响应字节。这证实故障期间网页请求本身也不响应，不能只归因于手机 UI。没有服务器进程、代理或内核日志，尚不能确认是 OOM、换页、进程阻塞还是其他服务端问题。近期 Room Controls 提交没有调整 Socket.IO 的心跳参数。

Decrypto 存在两处可验证的资源风险：

- 默认配置最多加载 240,000 个词向量，原来每个维度是单独的 Python float。以 300 维计算，本地测量每条旧向量约 9,720 字节，新紧凑 double 数组约 2,464 字节；24 万条对应约 2,225 MiB 和 564 MiB。这个估算只计算向量数据，不包括字典、词表等开销。紧凑存储保持 double 精度；相似度排序回归结果一致。
- 模型首次初始化没有线程锁，多个房间的 Bot 可以同时加载多份。现在初始化只执行一次。回合结算的诊断原来可能加载模型或运行分词相似度计算；现在这些诊断不再在服务端事件循环中执行。

这两处风险与资源受限服务器上“添加 Bot 后整站超时”的现象相符，但不是线上 OOM 的证明。新代码会记录超过 2 秒的事件循环延迟及正在计算的游戏类型。前端 Log 和 Copy State 会记录最近的连接原因、传输类型、页面可见性，不包含 reconnect token。

游戏列表现在在首屏提前加载，搜索和打开弹窗共享请求；失败有重试入口。HTML/JS/CSS 使用压缩，脚本保持顺序并使用 defer。浏览器测量静态资源压缩前约 4.16 MB，实际传输约 0.91 MB。

附件 document.json 实际是首页 HTML，不是游戏存档。下载改为先检查 HTTP 状态、Content-Type 和附件文件名；JSON 存档还会检查内容能否解析。404、HTML 回退页以及伪装成 application/json 的 HTML 都不会下载或导航到错误页。iOS 打开文件时使用独立页面，并延迟释放 Blob URL。

验证：

- 120 项相关 Python 测试通过，覆盖房间身份恢复、旧连接接管、错误 token、Citadels、Decrypto、模型并发初始化、紧凑存储精度和前端脚本接线。
- `tests/room_controls.browser.cjs` 在本地 Chrome 的触摸模式下通过，覆盖 320/393/1280 像素布局、Citadels 创建和添加 3 个 Bot、断网/刷新恢复后启动、不可用 localStorage、游戏列表失败重试、错误下载、Decrypto 加 3 个 Bot 提交 clue 后继续到下一轮及刷新恢复。它使用生成的 300 维测试词向量，不代表线上真实模型、真实 iPhone 或生产硬件的负载测试。
- 全量 unittest 运行 1,184 项，出现 17 项失败。其中 3 项为 script 属性顺序与已有测试正则不兼容，已调整属性顺序并单独回归通过；其余 10 项为 Guandan Bot、4 项为 Halli Galli，本次未修改这些游戏的逻辑。工作区同时存在其他任务对 Guandan 和 Gizmos 的修改。

本次没有部署或重启线上服务。部署后需要结合内核 OOM 日志、服务进程日志和新阻塞告警，确认线上整站超时的最终原因。

本地复测：先运行 `python3 -m uvicorn app:app --host 127.0.0.1 --port 8765`，然后运行 `node tests/room_controls.browser.cjs`。需要可用的 Chrome 和 Playwright；`PLAYWRIGHT_MODULE` 可指定已有 Playwright 安装路径。Python 专项命令：

```sh
python3 -m unittest tests.test_room_session tests.test_citadels_game tests.test_decrypto_game tests.test_decrypto_model_loading tests.test_frontend_script_names tests.test_ark_nova_integration tests.test_nine_upper_game tests.test_subtext_game
```
