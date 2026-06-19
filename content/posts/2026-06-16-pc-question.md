# 个人PC问题记录

#### wifi中的5G频段无法连接
> 重启路由器即可

#### PowerShell拦截执行.ps1
> 个人脚本开启: Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> 
> 临时开启(只对当前终端生效): Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
>
> 查看当前策略: Get-ExecutionPolicy -List