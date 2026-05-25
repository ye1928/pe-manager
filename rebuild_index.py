import re

with open(r'C:\Users\52706\WorkBuddy\20260425195840-split\investment-manager.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 提取 <head> 中的 CDN script 标签（保留）
cdn_scripts = re.findall(r'<script src="https://cdn\.jsdelivr\.net[^>]+></script>', content)
cdn_block = '\n'.join(cdn_scripts)

# 2. 提取所有 HTML 结构（body 内所有非 style/非 script 内容）
# 先去掉 <style>...</style> 块
html_no_style = re.sub(r'<style>[\s\S]*?</style>', '', content)

# 去掉所有 <script>...</script> 块（保留 script src= 的）
# 先保存带 src 的 script 标签
ext_scripts = re.findall(r'<script src=[^>]+></script>', html_no_style)
html_no_script = re.sub(r'<script>[\s\S]*?</script>', '', html_no_style)

# 3. 构建 index.html
index = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>投研助手 · 全生命周期投资管理系统</title>
{cdn_block}
<link rel="stylesheet" href="css/style.css">
</head>
<body>
{html_no_script.split("<body>")[1].split("</body>")[0] if "<body>" in html_no_script else ""}
<!-- JS Modules -->
<script src="js/store.js"></script>
<script src="js/utils.js"></script>
<script src="js/utils-extra.js"></script>
<script src="js/fund/calc.js"></script>
<script src="js/fund/render.js"></script>
<script src="js/fund/modal.js"></script>
<script src="js/stock/stock.js"></script>
<script src="js/futures/futures.js"></script>
<script src="js/attribution.js"></script>
<script src="js/dashboard.js"></script>
<script src="js/vote.js"></script>
<script src="js/news.js"></script>
<script src="js/knowledge.js"></script>
<script src="js/calendar.js"></script>
<script src="js/events.js"></script>
<script src="js/app.js"></script>
</body>
</html>
'''

with open(r'C:\Users\52706\WorkBuddy\20260425195840-split\index.html', 'w', encoding='utf-8') as f:
    f.write(index)

print("index.html created")
print(f"Length: {len(index)}")
