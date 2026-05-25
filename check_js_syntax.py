#!/usr/bin/env python3
"""
提取 investment-manager.html 中的 JS 代码并做语法检查
"""
import subprocess, re, tempfile, os

html_path = r'c:/Users/52706/WorkBuddy/20260425195840/investment-manager.html'

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 提取所有 <script> 内容（排除 CDN 引用的 script 标签）
pattern = r'<script>(.*?)</script>'
matches = re.findall(pattern, html, re.DOTALL)

all_js = '\n\n'.join(matches)
print(f"提取到 {len(matches)} 个 script 块，共 {len(all_js)} 字符")

# 写入临时 .js 文件
tmp_path = r'c:/Users/52706/WorkBuddy/20260425195840/_syntax_check_tmp.js'
with open(tmp_path, 'w', encoding='utf-8') as f:
    f.write(all_js)

print(f"写入临时文件：{tmp_path}")
print("运行 node -c 检查语法...")

result = subprocess.run(
    ['E:/node/node.exe', '-c', tmp_path],
    capture_output=True, text=True
)

print("STDOUT:", result.stdout[:300] if result.stdout else "(空)")
print("STDERR:", result.stderr[:500] if result.stderr else "(空)")
print("返回码:", result.returncode)

if result.returncode == 0:
    print("\n✅ JS 语法检查通过！")
else:
    print("\n❌ JS 语法错误，请查看上述 stderr")

# 清理
try:
    os.remove(tmp_path)
    print("临时文件已清理")
except:
    pass
