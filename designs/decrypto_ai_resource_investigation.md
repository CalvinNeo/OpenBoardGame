# Decrypto AI 资源排查

2026-09-22。线上日志显示：加载 239,999 个 300 维词向量耗时 29.226 秒，模型初始化累计 33.898 秒；随后出现 19.81、2.42、5.23、663.62、68.58 秒的事件循环延迟。用户最初观察到进程仍在，但网页卡住、连接断开。

用户随后提供的内核日志已经确认发生了系统级 OOM。按日志显示的服务器时间，9 月 21 日 17:50:44 触发 OOM killer，17:50:58 内核杀掉 PID 179668 的 `python3`：

```text
oom-kill:constraint=CONSTRAINT_NONE,...,global_oom,...,task=python3,pid=179668,uid=0
Out of memory: Killed process 179668 (python3) total-vm:6556100kB, anon-rss:1280896kB, file-rss:2560kB, shmem-rss:0kB
```

- `global_oom` 表示这次是系统级内存耗尽，不是仅由某个容器的内存配额触发。
- 被杀进程的匿名常驻内存为 1,250.875 MiB，约 1.22 GiB，另有 2.5 MiB 文件映射常驻内存。`total-vm` 约 6.25 GiB 是虚拟地址空间，不能当成实际物理内存用量。
- `systemd invoked oom-killer` 表示 systemd 的一次内存分配触发了 OOM 处理，不说明 systemd 是主要内存占用者。
- OOM 已确认；是否发生 Swap 换页、换页持续多久，以及 PID 179668 是否就是本次游戏服务，需要结合完整 OOM 记录、启动日志或历史监控确认。仅凭 `python3` 名称不能唯一定位服务。Decrypto 的模型规模、应用停顿和该进程的内存量支持模型资源开销是重要排查方向。

可补取完整 OOM 上下文，包括内存、Swap 和各进程占用表；时间按服务器日志的时区填写：

```bash
sudo journalctl -k --since "2026-09-21 17:49:00" --until "2026-09-21 17:52:00" --no-pager
```

## 代码中的资源开销

- 默认配置原为 240,000 个词。即使使用已经压缩过的 double 数组，300 维向量的有效数据仍约 549 MiB，此外还有数组对象、词典、词表、范数以及整个游戏服务自身的内存。
- 每条未缓存的提示词搜索都用 Python 遍历全部向量，并为每个词创建得分元组再整体排序。一组三条提示需要三次搜索。多个房间可能同时搜索。
- `app.py` 已使用 `asyncio.to_thread` 执行 Bot，初始化也已有锁；线程不会隔离内存，也不能消除 Python 计算对 GIL 的竞争。正常的线程切换本身不足以解释 663 秒的停顿，需要结合系统记录判断。

## 本次修改

- 默认最多加载 20,000 个词；缺失或无效的词数限制也使用这个默认值。
- 独立的 `max_vector_mb` 默认值为 64，单位为 MiB。限制向量有效数据总量，不是整个进程的 RSS；旧的 240,000 词配置也受此限制。`.vec`、`.txt`、`.jsonl` 流式读取，达到限制就停止。
- 大型整体 JSON 会先被拒绝，避免 `json.load` 在应用限制之前把全部向量物化成 Python 对象。默认整体 JSON 文件大小上限为 8 MiB；大型模型应使用 `.vec` 或 `.jsonl`。
- 搜索通过堆只保留需要的前 N 项，保留原来的相似度计算精度和并列时按词排序的规则。
- 共享模型的重搜索串行执行，重复查询复用缓存；搜索缓存最多保留 128 项。

配置位于 `game/assets/decrypto_embeddings_config.json`。可用 `OPENBOARDGAME_DECRYPTO_EMBEDDINGS_MAX_WORDS` 和 `OPENBOARDGAME_DECRYPTO_EMBEDDINGS_MAX_VECTOR_MB` 覆盖，也支持去掉 `OPENBOARDGAME_` 前缀的名称。模型在进程内缓存，修改限制后需要重启服务才生效。降低加载量会减少 AI 词汇覆盖；仍保留原有缺词分词和备用词库逻辑。模型文件不需要重新下载或裁剪。

## 本地验证

使用同样的 300 维合成向量、独立 Python 进程测量，构造模型后执行一次未缓存的前 50 项搜索：

| 指标 | 修改前 | 新默认配置 |
| --- | ---: | ---: |
| 词数 | 240,000 | 20,000 |
| 模型构造 | 2.06 秒 | 0.15 秒 |
| 单次搜索 | 2.44 秒 | 0.18 秒 |
| 进程峰值 RSS | 950.8 MiB | 343.2 MiB |

这包含导入游戏模块的内存，不包含读取真实文本模型的耗时，也不代表线上硬件的性能。收益主要来自缩小默认加载量，不能解释为相同词库下提速了十多倍。原始结果在本地 `tmp/decrypto-ai-investigation/baseline.json` 和 `after.json`。

另用 20,001 行、300 维的合成文本模型从冷启动同时驱动两个房间的 Bot，实际加载 20,000 词，两个房间都完成第一轮。加载及行动共 2.04 秒，进程峰值 RSS 337.1 MiB，10 毫秒心跳探针测得最大事件循环延迟 0.131 秒。该检查验证线程调用和游戏行动衔接，不验证真实词库的出题质量；原始结果在 `tmp/decrypto-ai-investigation/two_rooms.json`。

以下 50 项测试通过，覆盖向量精度、加载上限、并发初始化、并发搜索复用、搜索临时内存、排序、缓存限制、Decrypto 游戏规则以及房间会话：

```bash
python3 -m unittest tests.test_decrypto_model_loading tests.test_decrypto_game tests.test_room_session
```

未部署或重启线上服务。

## 服务已经关闭时查历史

关闭应用进程通常不会清除内核日志。按实际故障时间调整查询窗口：

```bash
sudo journalctl -k --since "2 hours ago" --no-pager \
  | grep -Ei 'oom|out of memory|killed process|memory cgroup|page allocation failure|blocked for more than|soft lockup'

sudo dmesg -T \
  | grep -Ei 'oom|out of memory|killed process|memory cgroup|page allocation failure|blocked for more than|soft lockup'
```

如果期间整机重启过，且 journal 保留了历史启动记录：

```bash
sudo journalctl --list-boots
sudo journalctl -k -b -1 --no-pager \
  | grep -Ei 'oom|out of memory|killed process|memory cgroup|page allocation failure|blocked for more than|soft lockup'
```

如果故障前已启用 sysstat 历史采集，可用 `sar -r`、`sar -S`、`sar -W` 分别看当天内存、Swap 占用和换页速率。跨天时通过 `sar -f` 指定故障当天的数据文件，常见目录为 `/var/log/sa/` 或 `/var/log/sysstat/`。

没有 OOM 日志不能排除内存问题。严重换页通常没有明确的内核报错；未开启历史监控时，事后不能还原当时的换页速率。

## 再次运行时查实时状态

```bash
free -h
ps -eo pid,ppid,stat,%cpu,%mem,rss,comm --sort=-rss | head -n 20
vmstat 1 60

PID=12345  # 替换为实际 Python/Uvicorn worker PID
grep -E 'VmRSS|VmHWM|VmSwap|Threads' /proc/$PID/status
cat /proc/pressure/memory
pidstat -r -u -p "$PID" 1 60  # 需要安装 sysstat
```

`vmstat` 第一行主要是开机以来的平均数据，看后续采样。低 available、持续非零的 si/so、增加的 VmSwap 和升高的 memory pressure 支持换页/内存压力判断；仅有 Swap 已用量不够。CPU 持续满一个核而 si/so 为零、内存充裕，更偏向计算瓶颈。若使用 Docker，还要用 `docker stats --no-stream` 核对容器上限，不能只看整机内存。
