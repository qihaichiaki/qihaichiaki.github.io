# 编码规范

### C++编码规范:
```.clang-format
BasedOnStyle: Google
TabWidth: 4
IndentWidth: 4
UseTab: Never
ColumnLimit: 100

Language: Cpp
# 非禁用格式化
DisableFormat: false
Standard: Cpp11
Cpp11BracedListStyle: true

# 访问修饰符缩进偏移量
AccessModifierOffset: -4

# 多行表达式不对其到操作符位置
AlignOperands: DontAlign

# 不自动排序 #include 文件顺序，保持原样
SortIncludes: Never 

# 使用紧凑命名空间格式, 多个嵌套命名空间写成单行
CompactNamespaces: true

# 允许函数声明参数换行
AllowAllParametersOfDeclarationOnNextLine: true
# {}中不允许单行块
AllowShortBlocksOnASingleLine: Never
# case后语句不可单行
AllowShortCaseLabelsOnASingleLine: false
# 简短函数不可单行
AllowShortFunctionsOnASingleLine: None
# 单行if语句不被允许
AllowShortIfStatementsOnASingleLine: Never
# 单行for/while语句不被允许
AllowShortLoopsOnASingleLine: false
# 单行lambda表达式允许
AllowShortLambdasOnASingleLine: All

BinPackArguments: false
BinPackParameters: false

BreakBeforeBraces: Custom
BraceWrapping: {
    AfterCaseLabel: 'true'
    AfterClass: 'true'
    AfterControlStatement: 'true'
    AfterEnum: 'true'
    AfterFunction: 'true'
    AfterNamespace: 'true'
    AfterStruct: 'true'
    AfterUnion: 'true'
    BeforeCatch: 'true'
    BeforeElse: 'true'
    AfterExternBlock: 'true'
    SplitEmptyFunction: 'true'
    SplitEmptyRecord: 'true'
    SplitEmptyNamespace: 'true'
}
QualifierAlignment: Right
```

### 提交规范
* 规则: `[提交类型](提交范围): 说明性文本`
* 提交类型:
    - feat: 新功能
    - fix: 修复 bug
    - docs: 文档
    - style: 格式
    - refactor: 重构
    - perf: 性能优化
    - test: 测试
    - build: 构建系统 / CMake / 依赖
    - ci: CI 配置
    - chore: 杂项
    - revert: 回滚