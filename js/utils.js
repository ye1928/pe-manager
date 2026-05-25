// UTILS
// ============================================================
function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function fmt(num, digits = 2) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  return Number(num).toFixed(digits);
}

function fmtWan(num) {
  if (!num && num !== 0) return '--';
  return fmt(num, 2) + '万';
}

function fmtPct(num) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  const sign = num >= 0 ? '+' : '';
  return sign + fmt(num * 100, 2) + '%';
}

function pnlClass(val) {
  if (!val && val !== 0) return '';
  if (val > 0) return 'pnl-positive'; // 正收益红色（A股惯例）
  if (val < 0) return 'pnl-negative'; // 负收益绿色
  return '';
}

