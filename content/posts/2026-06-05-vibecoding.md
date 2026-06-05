# VibeCoding学习笔记
* 学习视频[VibeCoding就该这么做！](https://www.bilibili.com/video/BV1YP5W6ZEP9)有感

* 对AI的相关提示词可以划分为下面四个部分:
  1. 目标：当前阶段/步骤所需要的最终效果
  2. 输入：当前阶段/步骤需要给AI提供的参考或者使用工具/环境等
  3. 输出：当前阶段/步骤所得到的最终产物
  4. 步骤: 当前阶段/步骤所需要做的具体步骤 (**建议必带: 不要猜测我的意图, 不明确的地方都必须向我提问**) (当涉及到不了解的相关知识时, 可以和AI进行提问`即使用提问的方式帮我xxx`)

## VibeCoding步骤:
1. 需求文档(灵活的和AI进行讨论)
   - 从技术的角度分析当前项目究竟是要做什么
   - 最终生成proposal.md需求文档作为产物
```py
# 以python开发 fc模拟器为例子
目标:
    用python开发一个fc模拟器, 最终能跑超级玛丽.
    现在帮我完成需求文档
输入:
    当前目录是一个uv的python工程
    rom目录下有超级玛丽镜像
输出:
    请在doc目录下生成需求文档proposal.md
步骤:
    我不了解任何fc模拟器的知识,使用提问的方式帮助我确认需求, 不要揣测我的意图, 不明确的地方都必须向我提问
```

2. 设计文档
   - 设计分为概要设计(high-level-design)和详细设计(detailed-design), 概要是划分模块, 详细是实现细节
   - 如果需求文档中没有概要设计, 则可根据需求文档区生成概要设计，要求划分模块，识别模块与模块之间的关系
   - 详细设计中步骤需要要求根据需求+概要文档中的内容根据模块编写详细设计文档, 并且要求模块和模块之间尽量保持相互独立, 可以独立的进行测试(满足高内聚低耦合原则)
```py
# 如果需要概要设计:
目标:
    根据需求文档生成概要设计
输入:
    需求文档 doc/proposal.md
输出:
    概要设计文档: doc/high-level-design.md
步骤:
    根据需求文档的内容, 划分出模块，识别模块与模块之间的关系.
    生成概要设计文档.
    不要揣测我的意图, 不明确的地方都必须向我提问.

# 详细设计
目标:
    根据需求文档生成详细设计文档
输入:
    需求文档 doc/proposal.md,
    概要设计文档 doc/high-level-design.md 
输出:
    详细设计文档: doc/detailed-design.md
步骤:
    根据需求文档的内容, 以及概要设计中划分出的模块编写详细设计文档.
    模块和模块之间尽量保持相互独立, 可以独立的进行测试.
    不要揣测我的意图, 不明确的地方都必须向我提问.
```

3. 划分任务
   - 由于上下文问题(太长, 并且会压缩), 需要进行划分任务, 使用多个agent协助完成
   - 每个子agent执行一个模块任务, 对应一个子模块的md文件
```py
目标:
    为每个模块划分最小可执行任务
输入:
    需求文档 doc/proposal.md,
    概要设计文档 doc/high-level-design.md 
    详细设计文档 doc/detailed-design.md
输出:
    任务列表
    - doc/tasks/<module-name>.md (每个模块对应一个)
    - doc/tasks/progress.md (总体进度)
步骤:
    根据需求文档和设计文档, 为每一个模块生成Vibe Coding用的最小任务
    每个模块对应一个<module-name>.md
    用check list表示子任务是否完成
    progress.md中用check list表示模块是否已经完成
```

4. 实现
   - 监工agent通过progress.md生成子agent为每个子模块去实现代码
   - 其中我们需要交互的是监工agent, 另外需要复杂的prompt, 所以我们需要一个prompt来生成这个复杂的监工prompt
```py
# 生成监工prompt的prompt
目标:
    生成Vibe Coding用的Prompt
输入:
    需求文档 doc/proposal.md,
    概要设计文档 doc/high-level-design.md 
    详细设计文档 doc/detailed-design.md
    任务划分 doc/tasks
输出:
    doc/prompt.md
步骤:
    阅读输入信息, 了解当前要实现的工程
    生成doc/prompt.md作为Vibe Coding的起始Prompt

    主Agent, 用来跟踪整体的进度
    主Agent生成子Agent, 用来实现每一个模块, 并完成测试
    整个过程不会有人工参与

    代码必须有完整的pytest单元测试
    并通过mypy和ruff检测

    生成prompt的过程中, 如果有任何不明确的地方都必须向我提问
```

## 技巧
* 通过每个步骤生成的文档都可以新开一个线程AI去进行工作(根据上一步的输出作为下部的输入), 这样可以避免上下文污染产生幻觉以及节省token
* policy管理权限