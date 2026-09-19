# 庞氏骗局：组件数据来源

采用 2015 英文版行业数量（四类各 15 个）、完整 72 张资金牌及基础／进阶奢侈品计分。

资金牌数值来自 [peter-de-boer/ponzischeme_webapp 的 MIT 许可牌表](https://github.com/peter-de-boer/ponzischeme_webapp/blob/ddabfce7884aa04473fc98f4445a7077095f5c95/backend/games/game.py#L548)，固定版本 `ddabfce7884aa04473fc98f4445a7077095f5c95`。这里只改写数字数据，没有采用其规则引擎、客户端或美术。独立规则实现位于 `game/ponzi_scheme.py`。

- 本金为 9–80，各一张，共 72 张；9–17 是 9 张起始牌，18–64 是 47 张普通牌，65–80 是 16 张熊牌。
- [作者 Jesse Li 的公开勘误](https://www.flyingv.cc/projects/4303/comments)确认普通牌 47 张、熊牌 16 张正确，旧规则书所印 45／18 有误。
- [原版英文规则书](https://cdn.1j1ju.com/medias/0c/7f/67-ponzi-scheme-rulebook.pdf)第 1 页的 9／5／8、25／4／27、72／3／128，以及第 2 页九张起始牌，与此清单相符。这里只核对了公开示例和组件数量，没有声称逐张核验过实体牌。
- 奢侈品价格 30／56／78／96，分数 1／2／3／4；基础模式现金分档亦使用这些门槛。
- 作者众筹答复提及首轮跳过暗盘交易；默认采用该修正。房间可开启 `First-round trading` 以采用英文规则书所示的每轮完整流程。
- 不复用任何商业 UI、美术、图标或牌面图片；界面用 CSS、文字与 Emoji 原创呈现。

## 上游 MIT 许可

MIT License

Copyright (c) 2019 weisswurst

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
