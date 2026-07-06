# vscode个人Settings

### 通用设置
```json
{
    // 自定义设置
    "editor.fontFamily": "cascadia code, '微软雅黑'", // 默认字体
    // "files.autoSave": "afterDelay",  // 自动保存文件
    "files.autoGuessEncoding": true, // 打开文件选择合适的文件编码类型打开
    // ==== 平滑过渡相关 ====
    "editor.cursorSmoothCaretAnimation": "on",
    "editor.smoothScrolling": true,
    "workbench.list.smoothScrolling": true,
    "terminal.integrated.smoothScrolling": true,
    // ====================
    "editor.cursorBlinking": "smooth",
    "editor.mouseWheelZoom": true, // ctrl + 鼠标滚轮缩放页面
    "editor.wordWrap": "on", // 显示折行
    "editor.suggest.snippetsPreventQuickSuggestions": false, // 代码片段也能获取代码补全建议
    "window.dialogStyle": "custom",
    "editor.renderLineHighlight": "all",
    "workbench.colorCustomizations": { // 覆盖主题的颜色设置
        // 设置光标所在行颜色
        "editor.lineHighlightBackground": "#3b3c45",
        "editor.selectionBackground": "#576375",
        // 括号匹配颜色
        "editorBracketMatch.border": "#ffffff",
        "editorBracketMatch.background": "#ffffff",
        // "editorBracketMatch.foreground":"#ff0000",
    },
    // ==== minmap风格 ====
    "editor.minimap.renderCharacters": false,
    "editor.minimap.scale": 2,
    "editor.minimap.maxColumn": 100,
    "editor.minimap.showSlider":"always",
    // ====================
    "workbench.editor.wrapTabs": true,
}
```

### .vscode中的settings.json
clangd配置相关
```json
{
    "C_Cpp.intelliSenseEngine": "disabled",
    "clangd.path": "D:/ApplicationProgram/vs2022/Community/VC/Tools/Llvm/bin/clangd.exe",
    "cmake.configureArgs": [
        "-DCMAKE_EXPORT_COMPILE_COMMANDS=ON"
    ],
    "clangd.arguments": [
        "--compile-commands-dir=${workspaceFolder}/build",
        "--header-insertion=never"
    ],
}
```

### .vscode中的launch.json
```
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "(msvc)Launch",
            "type": "cppvsdbg",
            "request": "launch",
            "program": "${command:cmake.launchTargetPath}",
            "args": [
                "--gtest_filter=MyTest.*", // gtest相关筛选测试
                "${cmake.testArgs}"        // ctest相关传递参数
            ],
            "cwd": "${workspaceRoot}",
            "stopAtEntry": false,
            "console": "externalTerminal",
            "environment": [
                {
                    "name": "PATH",
                    "value": "${workspaceFolder}/build/bin/NamicaRuntime/${command:cmake.buildType};${env:PATH}"
                }
            ]
        }
    ]
}
```


* 随时更新中ing......