// ===========================
// DENTAL CHART — خريطة الأسنان التفاعلية
// ===========================

// حالات الأسنان
const TOOTH_STATES = {
  healthy:   { label: 'سليم',        color: '#38a169', bg: '#f0fff4' },
  caries:    { label: 'تسوس',        color: '#d69e2e', bg: '#fffbeb' },
  filled:    { label: 'حشو',         color: '#0a4d6e', bg: '#e0f0f8' },
  crown:     { label: 'تاج',         color: '#6b46c1', bg: '#faf5ff' },
  extracted: { label: 'مخلوع',       color: '#e53e3e', bg: '#fff5f5' },
  bridge:    { label: 'جسر',         color: '#dd6b20', bg: '#fffaf0' },
  implant:   { label: 'زرعة',        color: '#2b6cb0', bg: '#ebf8ff' },
  rct:       { label: 'معالجة لبية', color: '#b7791f', bg: '#fffbeb' },
  missing:   { label: 'مفقود خلقياً',color: '#718096', bg: '#f7fafc' },
};

// ترتيب الأسنان: الفك العلوي يمين → يسار ثم الفك السفلي يسار → يمين
// أرقام FDI الدولية
const UPPER_RIGHT = [18,17,16,15,14,13,12,11];
const UPPER_LEFT  = [21,22,23,24,25,26,27,28];
const LOWER_RIGHT = [48,47,46,45,44,43,42,41];
const LOWER_LEFT  = [31,32,33,34,35,36,37,38];

// أسماء الأسنان بالعربية
const TOOTH_NAMES = {
  11:'ثنية علوية يمنى',  12:'رباعية علوية يمنى', 13:'ناب علوي أيمن',
  14:'ضاحك1 علوي أيمن',  15:'ضاحك2 علوي أيمن',  16:'طاحن1 علوي أيمن',
  17:'طاحن2 علوي أيمن',  18:'طاحن3 علوي أيمن (عقل)',
  21:'ثنية علوية يسرى',  22:'رباعية علوية يسرى', 23:'ناب علوي أيسر',
  24:'ضاحك1 علوي أيسر',  25:'ضاحك2 علوي أيسر',  26:'طاحن1 علوي أيسر',
  27:'طاحن2 علوي أيسر',  28:'طاحن3 علوي أيسر (عقل)',
  31:'ثنية سفلية يسرى',  32:'رباعية سفلية يسرى', 33:'ناب سفلي أيسر',
  34:'ضاحك1 سفلي أيسر',  35:'ضاحك2 سفلي أيسر',  36:'طاحن1 سفلي أيسر',
  37:'طاحن2 سفلي أيسر',  38:'طاحن3 سفلي أيسر (عقل)',
  41:'ثنية سفلية يمنى',  42:'رباعية سفلية يمنى', 43:'ناب سفلي أيمن',
  44:'ضاحك1 سفلي أيمن',  45:'ضاحك2 سفلي أيمن',  46:'طاحن1 سفلي أيمن',
  47:'طاحن2 سفلي أيمن',  48:'طاحن3 سفلي أيمن (عقل)',
};

let dentalChartPatientIdx = null;

// --- فتح خريطة الأسنان ---
function openDentalChart(patientIdx) {
  dentalChartPatientIdx = patientIdx;
  const p = patients[patientIdx];
  if (!p.dentalChart) p.dentalChart = {};

  document.getElementById('dc-patient-name').textContent = fullName(p);
  renderDentalChart();
  document.getElementById('modal-dental-chart').classList.add('open');
}

// --- رسم الخريطة ---
function renderDentalChart() {
  const p = patients[dentalChartPatientIdx];
  const chart = p.dentalChart || {};

  const upperHtml = buildRow([...UPPER_RIGHT, ...UPPER_LEFT], chart, 'upper');
  const lowerHtml = buildRow([...LOWER_RIGHT.slice().reverse(), ...LOWER_LEFT.slice().reverse()].reverse(), chart, 'lower');

  // ترتيب السفلي: يمين → يسار = 48..41 ثم 31..38
  const lowerOrdered = [...[...LOWER_RIGHT].reverse(), ...[...LOWER_LEFT]];

  document.getElementById('dc-upper-row').innerHTML = buildRow([...UPPER_RIGHT, ...UPPER_LEFT], chart, 'upper');
  document.getElementById('dc-lower-row').innerHTML = buildRow(lowerOrdered, chart, 'lower');

  renderChartSummary(chart);
}

function buildRow(teeth, chart, jaw) {
  return teeth.map(num => {
    const state = chart[num] || 'healthy';
    const info = TOOTH_STATES[state];
    const isMolar = [6,7,8].includes(num % 10) || [6,7,8].includes(num % 10);
    const size = (num % 10 >= 6) ? 'molar' : (num % 10 === 5 ? 'premolar' : 'incisor');
    return `
      <div class="dc-tooth ${size} ${state}" onclick="openToothEditor(${num})" title="سن ${num} — ${TOOTH_NAMES[num]}">
        <div class="dc-tooth-crown">
          <div class="dc-tooth-inner">
            ${getToothSVG(state)}
          </div>
        </div>
        <div class="dc-tooth-root ${jaw === 'lower' ? 'lower' : ''}">
          <div class="dc-root-shape"></div>
        </div>
        <div class="dc-tooth-number">${num}</div>
        <div class="dc-tooth-label">${info.label}</div>
      </div>`;
  }).join('');
}

function getToothSVG(state) {
  const icons = {
    healthy:   '✓',
    caries:    '●',
    filled:    'F',
    crown:     'C',
    extracted: '✕',
    bridge:    '⌒',
    implant:   'I',
    rct:       'R',
    missing:   '—',
  };
  return `<span class="dc-state-icon">${icons[state] || '?'}</span>`;
}

// --- محرر السن ---
function openToothEditor(toothNum) {
  const p = patients[dentalChartPatientIdx];
  const chart = p.dentalChart || {};
  const current = chart[toothNum] || 'healthy';
  const treatments = (p.treatments || []).map(t => t.name).filter(Boolean);

  document.getElementById('dc-editor-title').textContent = `سن ${toothNum} — ${TOOTH_NAMES[toothNum]}`;
  document.getElementById('dc-tooth-num-hidden').value = toothNum;

  // رسم أزرار الحالة
  const statesHtml = Object.entries(TOOTH_STATES).map(([key, info]) => `
    <button class="dc-state-btn ${current === key ? 'active' : ''}"
      style="--state-color:${info.color};--state-bg:${info.bg}"
      onclick="selectToothState('${key}', this)"
      data-state="${key}">
      ${info.label}
    </button>
  `).join('');
  document.getElementById('dc-state-buttons').innerHTML = statesHtml;

  // ملاحظات السن
  const notes = (p.dentalNotes && p.dentalNotes[toothNum]) || '';
  document.getElementById('dc-tooth-notes').value = notes;

  // تاريخ المعالجات المرتبطة
  const relatedTreatments = (p.treatments || []).filter(t =>
    t.tooth && (String(t.tooth) === String(toothNum) || t.tooth.includes(String(toothNum)))
  );
  const historyHtml = relatedTreatments.length
    ? relatedTreatments.map(t => `
        <div class="dc-history-item">
          <span class="dc-history-name">${t.name}</span>
          <span class="dc-history-date">${t.date || ''}</span>
          <span class="dc-history-cost">${t.cost ? Number(t.cost).toLocaleString() + ' ' + (t.currency || '') : ''}</span>
        </div>`).join('')
    : '<div style="color:var(--text-muted);font-size:12px;padding:8px 0">لا توجد معالجات مرتبطة بهذا السن</div>';

  document.getElementById('dc-tooth-history').innerHTML = historyHtml;
  document.getElementById('modal-tooth-editor').classList.add('open');
}

function selectToothState(state, btn) {
  document.querySelectorAll('.dc-state-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  btn.dataset.selectedState = state;
}

function saveToothState() {
  const toothNum = Number(document.getElementById('dc-tooth-num-hidden').value);
  const activeBtn = document.querySelector('.dc-state-btn.active');
  const state = activeBtn ? activeBtn.dataset.state : 'healthy';
  const notes = document.getElementById('dc-tooth-notes').value.trim();

  const p = patients[dentalChartPatientIdx];
  if (!p.dentalChart) p.dentalChart = {};
  if (!p.dentalNotes) p.dentalNotes = {};

  p.dentalChart[toothNum] = state;
  if (notes) p.dentalNotes[toothNum] = notes;
  else delete p.dentalNotes[toothNum];

  saveState();
  renderDentalChart();
  document.getElementById('modal-tooth-editor').classList.remove('open');
  toast(`تم تحديث حالة السن ${toothNum} ✅`);
}

// --- ملخص الخريطة ---
function renderChartSummary(chart) {
  const counts = {};
  Object.values(TOOTH_STATES).forEach(s => counts[s.label] = 0);

  let totalTeeth = 32;
  let affectedCount = 0;

  Object.values(chart).forEach(state => {
    const label = TOOTH_STATES[state]?.label;
    if (label) counts[label] = (counts[label] || 0) + 1;
    if (state !== 'healthy') affectedCount++;
  });

  const healthyCount = 32 - Object.keys(chart).length + (Object.values(chart).filter(s => s === 'healthy').length);

  const summaryHtml = Object.entries(TOOTH_STATES)
    .filter(([key]) => key !== 'healthy')
    .map(([key, info]) => {
      const count = Object.values(chart).filter(s => s === key).length;
      if (count === 0) return '';
      return `<span class="dc-summary-badge" style="background:${info.bg};color:${info.color};border:1px solid ${info.color}33">
        ${info.label}: <strong>${count}</strong>
      </span>`;
    }).filter(Boolean).join('');

  const healthyTotal = 32 - affectedCount;
  document.getElementById('dc-summary').innerHTML = `
    <span class="dc-summary-badge" style="background:#f0fff4;color:#38a169;border:1px solid #38a16933">
      سليمة: <strong>${healthyTotal}</strong>
    </span>
    ${summaryHtml || ''}
    <span class="dc-summary-badge" style="background:var(--surface2);color:var(--text-muted);border:1px solid var(--border)">
      إجمالي الأسنان: <strong>32</strong>
    </span>
  `;
}

// --- تصفير الخريطة ---
function resetDentalChart() {
  if (!confirm('هل تريد تصفير خريطة الأسنان؟ ستُعاد جميع الأسنان إلى حالة "سليم".')) return;
  const p = patients[dentalChartPatientIdx];
  p.dentalChart = {};
  p.dentalNotes = {};
  saveState();
  renderDentalChart();
  toast('تم تصفير خريطة الأسنان');
}

// --- طباعة الخريطة ---
function printDentalChart() {
  const p = patients[dentalChartPatientIdx];
  const chart = p.dentalChart || {};
  const clinicName = localStorage.getItem('dental_clinic_name') || 'عيادة الأسنان';

  const allTeeth = [...UPPER_RIGHT, ...UPPER_LEFT, ...[...LOWER_RIGHT].reverse(), ...LOWER_LEFT];
  const rows = allTeeth.map(num => {
    const state = chart[num] || 'healthy';
    const info = TOOTH_STATES[state];
    const notes = (p.dentalNotes && p.dentalNotes[num]) || '—';
    return `<tr>
      <td>${num}</td>
      <td>${TOOTH_NAMES[num]}</td>
      <td style="color:${info.color};font-weight:700">${info.label}</td>
      <td style="font-size:11px">${notes}</td>
    </tr>`;
  }).join('');

  const win = window.open('', '_blank', 'width=800,height=600');
  win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><title>خريطة الأسنان — ${fullName(p)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Cairo',sans-serif; padding:24px; direction:rtl; color:#1a2e3b; }
.header { border-bottom:3px solid #0a4d6e; padding-bottom:14px; margin-bottom:20px; display:flex; justify-content:space-between; }
.clinic { font-size:20px; font-weight:800; color:#0a4d6e; }
h2 { font-size:16px; color:#00c4b4; margin-top:4px; }
table { width:100%; border-collapse:collapse; }
th { background:#0a4d6e; color:#fff; padding:8px 12px; font-size:12px; text-align:right; }
td { padding:8px 12px; font-size:12px; border-bottom:1px solid #dde6ee; }
tr:nth-child(even) td { background:#f8fafc; }
.footer { margin-top:24px; text-align:center; font-size:11px; color:#6b8fa8; border-top:1px solid #dde6ee; padding-top:14px; }
@media print { button { display:none; } }
</style></head><body>
<div class="header">
  <div><div class="clinic">🦷 ${clinicName}</div><div style="font-size:12px;color:#6b8fa8;margin-top:4px">نظام إدارة المرضى</div></div>
  <div style="text-align:left"><h2>خريطة الأسنان</h2><div style="font-size:12px;color:#6b8fa8">👤 ${fullName(p)}</div></div>
</div>
<table>
  <thead><tr><th>رقم السن</th><th>اسم السن</th><th>الحالة</th><th>ملاحظات</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">
  <p>${clinicName} | تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SY')}</p>
  <button onclick="window.print()" style="margin-top:10px;background:#0a4d6e;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-family:inherit;cursor:pointer">🖨 طباعة</button>
</div>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 600);
}
