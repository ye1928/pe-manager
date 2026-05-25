$content = [System.IO.File]::ReadAllText('c:/Users/52706/WorkBuddy/20260425195840/investment-manager.html')
$parts = $content -split '<script>'
$script = ($parts[1] -split '<\/script>')[0]
try {
    $null = [System.Management.Automation.Language.Parser]::ParseInput($script, [ref]$null, [ref]$null)
    Write-Host 'JS语法检查通过'
} catch {
    Write-Host "错误: $_"
}
