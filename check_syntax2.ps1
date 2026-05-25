const fs = require('fs');
const html = fs.readFileSync('investment-manager.html', 'utf8');
const match = html.match(/(?<=<script>)([\s\S]*?)(?=<\/script>)/);
if (match) {
  fs.writeFileSync('temp_check.js', match[1]);
  console.log('Extracted JS, length:', match[1].length);
} else {
  console.log('No script content found');
}
