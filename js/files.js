/* Zoznam súborov aplikácie – používa ho offline režim (sw.js) aj „Stiahnuť do PC" */
const APP_VERSION = '2.0.0';
const APP_FILES = [
  'index.html', 'writer.html', 'sheet.html', 'slides.html', 'manifest.webmanifest', 'sw.js', 'README.md',
  'css/style.css',
  'js/files.js', 'js/storage.js', 'js/templates.js', 'js/writer.js', 'js/formula.js', 'js/sheet.js', 'js/charts.js',
  'js/slides.js', 'js/docx.js', 'js/xlsxio.js', 'js/pptx.js', 'js/gdrive.js',
  'vendor/jszip.min.js', 'vendor/mammoth.browser.min.js', 'vendor/xlsx.bundle.js', 'vendor/pptxgen.min.js',
  'vendor/LICENSE-jszip.md', 'vendor/LICENSE-mammoth', 'vendor/LICENSE-xlsx', 'vendor/LICENSE-pptxgenjs',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'
];
/* Súbory, ktoré sa pridajú len do ZIP balíka na stiahnutie */
const DOWNLOAD_EXTRA = ['Spustit-Windows.bat', 'Spustit-Mac.command', 'spustit-linux.sh', 'tools/server.ps1'];
