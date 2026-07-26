    // ============================================================
    // XSS SAFETY HELPER (references global escapeHtml from app.js)
    // ============================================================
    function _esc(str) {
      if (typeof escapeHtml === 'function') return escapeHtml(str);
      if (str === null || str === undefined) return '';
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ============================================================
    // APPOINTMENTS SYSTEM
    // ============================================================
    let appointments = JSON.parse(localStorage.getItem('dental_appointments') || '[]');
    let calView = 'month'; // month | week | day
    let calDate = new Date();
    let editingApptId = null;
    let chartRevenue = null, chartTreatments = null, chartPatients = null;

    function saveAppointments() {
      try {
        localStorage.setItem('dental_appointments', JSON.stringify(appointments));
      } catch(e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
          if (typeof showStorageWarning === 'function') showStorageWarning();
        }
      }
    }

    function saveDoctorEmail() {
      const val = document.getElementById('doctor-email-input').value.trim();
      try { localStorage.setItem('dental_doctor_email', val); } catch(e) {}
      const badge = document.getElementById('doctor-email-saved');
      badge.style.display = 'inline';
      setTimeout(() => badge.style.display = 'none', 2000);
      toast('تم حفظ البريد الإلكتروني ✅');
    }

    function loadDoctorEmail() {
      const saved = localStorage.getItem('dental_doctor_email') || '';
      const inp = document.getElementById('doctor-email-input');
      if (inp) inp.value = saved;
    }

    function openAddApptModal(dateStr, timeStr) {
      editingApptId = null;
      document.getElementById('appt-modal-title').textContent = '📅 موعد جديد';
      document.getElementById('appt-patient').innerHTML = '<option value="">-- اختر مريضاً --</option>' +
        patients.map(p => `<option value="${p.id}">${fullName(p)}</option>`).join('');
      document.getElementById('appt-date').value = dateStr || new Date().toISOString().split('T')[0];
      document.getElementById('appt-time').value = timeStr || '09:00';
      document.getElementById('appt-type').value = '';
      document.getElementById('appt-notes').value = '';
      document.getElementById('appt-duration').value = '30';
      document.getElementById('modal-appointment').classList.add('open');
    }

    function saveAppointment() {
      const patId = document.getElementById('appt-patient').value;
      const type = document.getElementById('appt-type').value.trim();
      const date = document.getElementById('appt-date').value;
      const time = document.getElementById('appt-time').value;
      if (!patId || !type || !date || !time) { toast('يرجى ملء جميع الحقول المطلوبة', 'danger'); return; }
      const pat = patients.find(p => String(p.id) === String(patId));
      const appt = {
        id: editingApptId || Date.now(),
        patientId: parseInt(patId),
        patientName: pat ? fullName(pat) : '',
        type, date, time,
        duration: parseInt(document.getElementById('appt-duration').value),
        notes: document.getElementById('appt-notes').value.trim(),
        status: 'pending', // pending | completed | cancelled
        createdAt: new Date().toISOString()
      };
      if (editingApptId) {
        const idx = appointments.findIndex(a => a.id === editingApptId);
        if (idx >= 0) appointments[idx] = appt;
      } else {
        appointments.push(appt);
      }
      saveAppointments();
      closeModal('modal-appointment');
      renderCalendar();
      renderReminders();
      toast('تم حفظ الموعد ✅');
      scheduleReminder(appt);
    }

    function deleteAppointment(id) {
      if (!confirm('هل تريد حذف هذا الموعد؟')) return;
      appointments = appointments.filter(a => a.id !== id);
      saveAppointments();
      renderCalendar();
      renderReminders();
      toast('تم حذف الموعد', 'danger');
    }

    function changeApptStatus(id, status) {
      const appt = appointments.find(a => a.id === id);
      if (appt) { appt.status = status; saveAppointments(); renderCalendar(); renderReminders(); toast('تم تحديث حالة الموعد'); }
    }

    function editAppt(id) {
      const appt = appointments.find(a => a.id === id);
      if (!appt) return;
      editingApptId = id;
      document.getElementById('appt-modal-title').textContent = '✏️ تعديل الموعد';
      document.getElementById('appt-patient').innerHTML = '<option value="">-- اختر مريضاً --</option>' +
        patients.map(p => `<option value="${p.id}" ${p.id === appt.patientId ? 'selected' : ''}>${fullName(p)}</option>`).join('');
      document.getElementById('appt-date').value = appt.date;
      document.getElementById('appt-time').value = appt.time;
      document.getElementById('appt-type').value = appt.type;
      document.getElementById('appt-notes').value = appt.notes || '';
      document.getElementById('appt-duration').value = appt.duration || 30;
      document.getElementById('modal-appointment').classList.add('open');
    }

    // ---- CALENDAR RENDER ----
    function setCalView(v) {
      calView = v;
      ['month','week','day'].forEach(x => {
        const btn = document.getElementById('btn-view-' + x);
        if (btn) btn.className = 'btn btn-sm ' + (x === v ? 'btn-primary' : 'btn-outline');
      });
      renderCalendar();
    }

    function calPrev() {
      if (calView === 'month') calDate = new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1);
      else if (calView === 'week') calDate = new Date(calDate.getTime() - 7 * 86400000);
      else calDate = new Date(calDate.getTime() - 86400000);
      renderCalendar();
    }
    function calNext() {
      if (calView === 'month') calDate = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1);
      else if (calView === 'week') calDate = new Date(calDate.getTime() + 7 * 86400000);
      else calDate = new Date(calDate.getTime() + 86400000);
      renderCalendar();
    }
    function calToday() { calDate = new Date(); renderCalendar(); }

    function renderCalendar() {
      if (calView === 'month') renderMonthView();
      else if (calView === 'week') renderWeekView();
      else renderDayView();
      renderReminders();
    }

    const DAY_NAMES = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    const MONTH_NAMES = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

    function apptChipHtml(a) {
      const statusClass = a.status === 'completed' ? 'completed' : a.status === 'cancelled' ? 'cancelled' : '';
      return `<div class="cal-appt-chip ${statusClass}" title="${a.patientName} — ${a.type}" onclick="showApptDetail(${a.id});event.stopPropagation()">
        ${a.time} ${a.patientName.split(' ')[0]}
      </div>`;
    }

    function renderMonthView() {
      const year = calDate.getFullYear(), month = calDate.getMonth();
      document.getElementById('cal-title').textContent = MONTH_NAMES[month] + ' ' + year;
      const first = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const daysInPrev = new Date(year, month, 0).getDate();
      const today = new Date(); today.setHours(0,0,0,0);

      let html = `<div class="cal-header-row month-view">` + DAY_NAMES.map(d => `<div class="cal-day-name">${d}</div>`).join('') + `</div>`;
      html += `<div class="cal-grid-month">`;

      let cells = [];
      for (let i = first - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, month: month - 1, year, other: true });
      for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, month, year, other: false });
      while (cells.length % 7 !== 0) { cells.push({ day: cells.length - daysInMonth - first + 2, month: month + 1, year, other: true }); }

      cells.forEach(c => {
        const dateStr = `${c.year}-${String(c.month + 1).padStart(2,'0')}-${String(c.day).padStart(2,'0')}`;
        const cellDate = new Date(c.year, c.month, c.day);
        const isToday = cellDate.getTime() === today.getTime();
        const dayAppts = appointments.filter(a => a.date === dateStr).sort((a,b) => a.time.localeCompare(b.time));
        html += `<div class="cal-cell${c.other ? ' other-month' : ''}${isToday ? ' today' : ''}" onclick="openAddApptModal('${dateStr}')">
          <div class="cal-day-num">${c.day}</div>
          ${dayAppts.map(a => apptChipHtml(a)).join('')}
          ${dayAppts.length > 3 ? `<div style="font-size:10px;color:var(--text-muted)">+${dayAppts.length-3} أكثر</div>` : ''}
        </div>`;
      });
      html += '</div>';
      document.getElementById('calendar-container').innerHTML = html;
    }

    function renderWeekView() {
      const dow = calDate.getDay();
      const weekStart = new Date(calDate.getTime() - dow * 86400000);
      const days = Array.from({length: 7}, (_, i) => new Date(weekStart.getTime() + i * 86400000));
      const today = new Date(); today.setHours(0,0,0,0);
      document.getElementById('cal-title').textContent = fmtDate(days[0]) + ' — ' + fmtDate(days[6]);

      let html = `<div class="cal-header-row week-view">
        <div class="cal-day-name"></div>
        ${days.map(d => `<div class="cal-day-name${d.getTime()===today.getTime() ? '" style="color:var(--accent)' : ''}">${DAY_NAMES[d.getDay()]}<br><span style="font-size:16px;font-weight:800">${d.getDate()}</span></div>`).join('')}
      </div>`;

      html += `<div class="cal-week-grid">`;
      for (let h = 7; h <= 21; h++) {
        const timeStr = `${String(h).padStart(2,'0')}:00`;
        html += `<div class="cal-time-slot">${timeStr}</div>`;
        days.forEach(day => {
          const dateStr = day.toISOString().split('T')[0];
          const slotAppts = appointments.filter(a => a.date === dateStr && a.time >= timeStr && a.time < `${String(h+1).padStart(2,'0')}:00`);
          html += `<div class="cal-week-day-col" style="height:50px;border-bottom:1px solid var(--border)" onclick="openAddApptModal('${dateStr}','${timeStr}')">
            ${slotAppts.map(a => `<div class="cal-week-appt" onclick="showApptDetail(${a.id});event.stopPropagation()">${a.time} ${a.patientName.split(' ')[0]} — ${a.type}</div>`).join('')}
          </div>`;
        });
      }
      html += `</div>`;
      document.getElementById('calendar-container').innerHTML = html;
    }

    function renderDayView() {
      const dateStr = calDate.toISOString().split('T')[0];
      document.getElementById('cal-title').textContent = DAY_NAMES[calDate.getDay()] + ' ' + calDate.getDate() + ' ' + MONTH_NAMES[calDate.getMonth()] + ' ' + calDate.getFullYear();
      const dayAppts = appointments.filter(a => a.date === dateStr).sort((a,b) => a.time.localeCompare(b.time));

      let html = `<div class="cal-day-view">`;
      for (let h = 7; h <= 21; h++) {
        const timeStr = `${String(h).padStart(2,'0')}:00`;
        const slotAppts = dayAppts.filter(a => a.time >= timeStr && a.time < `${String(h+1).padStart(2,'0')}:00`);
        html += `<div class="cal-day-row">
          <div class="cal-day-time">${timeStr}</div>
          <div class="cal-day-events" onclick="openAddApptModal('${dateStr}','${timeStr}')">
            ${slotAppts.map(a => `<div class="cal-appt-chip${a.status==='completed'?' completed':a.status==='cancelled'?' cancelled':''}" onclick="showApptDetail(${a.id});event.stopPropagation()" style="font-size:12px;padding:4px 10px">
              🕐 ${a.time} &nbsp;|&nbsp; 👤 ${a.patientName} &nbsp;|&nbsp; 🦷 ${a.type} &nbsp;|&nbsp; ⏱ ${a.duration} د
            </div>`).join('')}
          </div>
        </div>`;
      }
      html += `</div>`;
      document.getElementById('calendar-container').innerHTML = html;
    }

    function fmtDate(d) { return d.getDate() + '/' + (d.getMonth()+1) + '/' + d.getFullYear(); }

    function showApptDetail(id) {
      const a = appointments.find(x => x.id === id);
      if (!a) return;
      const statusLabels = { pending: '⏳ قادم', completed: '✅ مكتمل', cancelled: '❌ ملغي' };
      const info = `الموعد: ${a.type}\nالمريض: ${a.patientName}\nالتاريخ: ${a.date} — ${a.time}\nالمدة: ${a.duration} دقيقة\nالحالة: ${statusLabels[a.status] || a.status}\nملاحظات: ${a.notes || 'لا يوجد'}`;
      const action = prompt(info + '\n\nاختر إجراءً (اكتب: تعديل / مكتمل / ملغي / حذف / إلغاء):');
      if (!action) return;
      if (action.includes('تعديل')) editAppt(id);
      else if (action.includes('مكتمل')) changeApptStatus(id, 'completed');
      else if (action.includes('ملغي')) changeApptStatus(id, 'cancelled');
      else if (action.includes('حذف')) deleteAppointment(id);
    }

    // ---- REMINDERS ----
    function renderReminders() {
      const el = document.getElementById('reminders-bar');
      if (!el) return;
      const now = new Date();
      const upcoming = appointments.filter(a => {
        if (a.status !== 'pending') return false;
        const apptTime = new Date(a.date + 'T' + a.time);
        const diff = (apptTime - now) / 60000;
        return diff >= 0 && diff <= 60;
      }).sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));

      if (!upcoming.length) { el.innerHTML = ''; return; }
      el.innerHTML = upcoming.map(a => {
        const apptTime = new Date(a.date + 'T' + a.time);
        const diff = Math.round((apptTime - now) / 60000);
        return `<div class="reminder-banner">
          <span style="font-size:22px">⏰</span>
          <div style="flex:1">
            <div style="font-weight:700;font-size:14px">تذكير: موعد خلال ${diff} دقيقة</div>
            <div style="font-size:13px;color:var(--text-muted)">👤 ${a.patientName} &nbsp;|&nbsp; 🦷 ${a.type} &nbsp;|&nbsp; 🕐 ${a.time}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-success btn-sm" onclick="changeApptStatus(${a.id},'completed')">✅ مكتمل</button>
            <button class="btn btn-danger btn-sm" onclick="changeApptStatus(${a.id},'cancelled')">❌ إلغاء</button>
          </div>
        </div>`;
      }).join('');
    }

    function scheduleReminder(appt) {
      const apptTime = new Date(appt.date + 'T' + appt.time);
      const reminderTime = new Date(apptTime.getTime() - 30 * 60000);
      const now = new Date();
      const delay = reminderTime - now;
      if (delay > 0 && delay < 86400000) {
        setTimeout(() => {
          if (Notification && Notification.permission === 'granted') {
            new Notification('🦷 تذكير بموعد', { body: `موعد ${appt.patientName} — ${appt.type} خلال 30 دقيقة (${appt.time})`, icon: '🦷' });
          }
          renderReminders();
          const email = localStorage.getItem('dental_doctor_email');
          if (email) { toast(`📧 سيتم إرسال تذكير إلى ${email} (يتطلب خادم بريد)`, 'info'); }
        }, delay);
      }
    }

    function requestNotificationPermission() {
      if (Notification && Notification.permission === 'default') Notification.requestPermission();
    }

    // ============================================================
    // ANALYTICS
    // ============================================================
    function initAnalyticsYears() {
      const sel = document.getElementById('analytics-year');
      if (!sel) return;
      const thisYear = new Date().getFullYear();
      sel.innerHTML = '';
      for (let y = thisYear; y >= thisYear - 4; y--) {
        sel.innerHTML += `<option value="${y}" ${y === thisYear ? 'selected' : ''}>${y}</option>`;
      }
    }

    function renderAnalytics() {
      initAnalyticsYears();
      const year = parseInt(document.getElementById('analytics-year')?.value || new Date().getFullYear());

      // Monthly revenue from payments
      const monthlyRevenue = Array(12).fill(0);
      const monthlyPatients = Array(12).fill(0);
      patients.forEach(p => {
        (p.payments || []).forEach(pay => {
          if (pay.date) {
            const d = new Date(pay.date);
            if (d.getFullYear() === year) {
              monthlyRevenue[d.getMonth()] += parseFloat(pay.amount) || 0;
            }
          }
        });
        if (p.createdAt) {
          // Try to parse createdAt
          const parts = p.createdAt.split('/');
          if (parts.length === 3) {
            const d = new Date(parts[2], parts[1]-1, parts[0]);
            if (d.getFullYear() === year) monthlyPatients[d.getMonth()]++;
          }
        }
      });

      // Treatment types
      const treatmentCounts = {};
      patients.forEach(p => (p.treatments || []).forEach(t => {
        const key = t.name || t.type || 'أخرى';
        treatmentCounts[key] = (treatmentCounts[key] || 0) + 1;
      }));

      // Summary cards
      const totalRevYear = monthlyRevenue.reduce((a,b) => a+b, 0);
      const totalPatientsYear = monthlyPatients.reduce((a,b) => a+b, 0);
      const pending = patients.filter(p => ((p.total||0) - (p.paid||0)) > 0);
      const totalPending = pending.reduce((s,p) => s + ((p.total||0)-(p.paid||0)), 0);

      document.getElementById('analytics-summary').innerHTML = `
        <div class="analytic-summary-card"><div class="val">${totalRevYear.toLocaleString()}</div><div class="lbl">إجمالي الإيرادات ${year}</div></div>
        <div class="analytic-summary-card"><div class="val" style="color:var(--accent)">${totalPatientsYear}</div><div class="lbl">مرضى جدد ${year}</div></div>
        <div class="analytic-summary-card"><div class="val" style="color:var(--danger)">${totalPending.toLocaleString()}</div><div class="lbl">إجمالي المتبقي</div></div>
        <div class="analytic-summary-card"><div class="val" style="color:var(--success)">${Object.values(treatmentCounts).reduce((a,b)=>a+b,0)}</div><div class="lbl">إجمالي المعالجات</div></div>
      `;

      // Revenue Chart
      const ctx1 = document.getElementById('revenue-chart');
      if (ctx1) {
        if (chartRevenue) chartRevenue.destroy();
        chartRevenue = new Chart(ctx1, {
          type: 'bar',
          data: {
            labels: MONTH_NAMES,
            datasets: [{
              label: 'الإيرادات الشهرية',
              data: monthlyRevenue,
              backgroundColor: 'rgba(0,196,180,0.6)',
              borderColor: '#00c4b4',
              borderWidth: 2,
              borderRadius: 6,
            }, {
              label: 'مرضى جدد',
              data: monthlyPatients.map(v => v * (totalRevYear / (totalPatientsYear || 1) / 10)),
              type: 'line',
              borderColor: '#0a4d6e',
              backgroundColor: 'rgba(10,77,110,0.1)',
              tension: 0.4,
              fill: true,
              yAxisID: 'y2',
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
              y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' } },
              y2: { beginAtZero: true, position: 'left', display: false },
              x: { grid: { display: false } }
            }
          }
        });
      }

      // Treatments pie
      const ctx2 = document.getElementById('treatments-chart');
      if (ctx2) {
        if (chartTreatments) chartTreatments.destroy();
        const tKeys = Object.keys(treatmentCounts).slice(0, 8);
        const tVals = tKeys.map(k => treatmentCounts[k]);
        const colors = ['#00c4b4','#0a4d6e','#38a169','#e53e3e','#d69e2e','#805ad5','#3182ce','#ed64a6'];
        chartTreatments = new Chart(ctx2, {
          type: 'doughnut',
          data: { labels: tKeys, datasets: [{ data: tVals, backgroundColor: colors }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
      }

      // Patients gender pie
      const ctx3 = document.getElementById('patients-chart');
      if (ctx3) {
        if (chartPatients) chartPatients.destroy();
        const males = patients.filter(p => p.gender === 'male').length;
        const females = patients.filter(p => p.gender === 'female').length;
        chartPatients = new Chart(ctx3, {
          type: 'pie',
          data: {
            labels: ['ذكور', 'إناث'],
            datasets: [{ data: [males, females], backgroundColor: ['#0a4d6e','#ed64a6'] }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
      }

      // Pending payments table
      renderPendingPayments();
    }

    function renderPendingPayments() {
      const tbody = document.getElementById('pending-payments-table');
      const empty = document.getElementById('pending-payments-empty');
      if (!tbody) return;
      const pending = patients.filter(p => ((p.total||0) - (p.paid||0)) > 0)
        .sort((a,b) => ((b.total||0)-(b.paid||0)) - ((a.total||0)-(a.paid||0)));
      if (!pending.length) {
        tbody.innerHTML = '';
        if (empty) empty.style.display = 'flex';
        return;
      }
      if (empty) empty.style.display = 'none';
      tbody.innerHTML = pending.map((p, i) => {
        const rem = (p.total||0) - (p.paid||0);
        const pct = p.total ? Math.round((p.paid||0)/p.total*100) : 0;
        const cur = p.currency || 'SYP';
        return `<tr>
          <td>${i+1}</td>
          <td><div class="patient-name-cell"><div class="patient-avatar${p.gender==='female'?' female':''}">${_esc((p.firstname||'?').charAt(0))}</div>${fullName(p)}</div></td>
          <td>${_esc(p.phone||'—')}</td>
          <td>${(p.total||0).toLocaleString()} ${cur}</td>
          <td style="color:var(--success)">${(p.paid||0).toLocaleString()} ${cur}</td>
          <td style="color:var(--danger);font-weight:700">${rem.toLocaleString()} ${cur}</td>
          <td>
            <div style="display:flex;align-items:center;gap:6px">
              <div style="flex:1;background:var(--border);border-radius:999px;height:6px;min-width:60px">
                <div style="background:${pct>75?'var(--success)':pct>40?'var(--warning)':'var(--danger)'};height:6px;border-radius:999px;width:${pct}%"></div>
              </div>
              <span style="font-size:11px;font-weight:700">${pct}%</span>
            </div>
          </td>
          <td><button class="btn btn-outline btn-sm" onclick="showDetail(patients.indexOf(patients.find(x=>x.id===${p.id})))">👁 عرض</button></td>
        </tr>`;
      }).join('');
    }

    function exportPendingPayments() {
      const pending = patients.filter(p => ((p.total||0) - (p.paid||0)) > 0);
      const ws_data = [['الاسم','الهاتف','إجمالي التكلفة','المدفوع','المتبقي','العملة']];
      pending.forEach(p => ws_data.push([fullName(p), p.phone||'', p.total||0, p.paid||0, (p.total||0)-(p.paid||0), p.currency||'SYP']));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      XLSX.utils.book_append_sheet(wb, ws, 'الدفعات المتبقية');
      XLSX.writeFile(wb, 'تقرير_الدفعات_المتبقية.xlsx');
      toast('تم تصدير التقرير 📊');
    }

    // ============================================================
    // TREATMENT PLANS
    // ============================================================
    let treatmentPlans = JSON.parse(localStorage.getItem('dental_treatment_plans') || '[]');
    let tpSteps = [];

    let editingPlanId = null;

    function saveTreatmentPlans() { try { localStorage.setItem('dental_treatment_plans', JSON.stringify(treatmentPlans)); } catch(e) {} }

    function openNewTreatmentPlan() {
      editingPlanId = null;
      document.querySelector('#modal-treatment-plan .modal-title').textContent = '📋 خطة علاجية جديدة';
      document.getElementById('tp-save-btn').textContent = '💾 حفظ الخطة';
      tpSteps = [];
      document.getElementById('tp-patient').innerHTML = '<option value="">-- اختر مريضاً --</option>' +
        patients.map(p => `<option value="${p.id}">${fullName(p)}</option>`).join('');
      document.getElementById('tp-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('tp-doctor').value = localStorage.getItem('dental_clinic_name') || '';
      document.getElementById('tp-diagnosis').value = '';
      document.getElementById('tp-instructions').value = '';
      document.getElementById('tp-total-cost').value = '';
      document.getElementById('tp-duration').value = '';
      document.getElementById('tp-steps-list').innerHTML = '';
      addTpStep();
      document.getElementById('modal-treatment-plan').classList.add('open');
    }

    function editTreatmentPlan(id) {
      const plan = treatmentPlans.find(p => p.id === id);
      if (!plan) return;
      editingPlanId = id;
      document.querySelector('#modal-treatment-plan .modal-title').textContent = '✏️ تعديل الخطة العلاجية';
      document.getElementById('tp-save-btn').textContent = '💾 حفظ التعديلات';
      // populate patients dropdown
      document.getElementById('tp-patient').innerHTML = '<option value="">-- اختر مريضاً --</option>' +
        patients.map(p => `<option value="${p.id}">${fullName(p)}</option>`).join('');
      document.getElementById('tp-patient').value = plan.patientId;
      document.getElementById('tp-date').value = plan.date;
      document.getElementById('tp-doctor').value = plan.doctor || '';
      document.getElementById('tp-diagnosis').value = plan.diagnosis || '';
      document.getElementById('tp-instructions').value = plan.instructions || '';
      document.getElementById('tp-total-cost').value = plan.totalCost || '';
      document.getElementById('tp-currency').value = plan.currency || 'SYP';
      document.getElementById('tp-duration').value = plan.duration || '';
      // load steps
      tpSteps = plan.steps.map(s => ({ id: Date.now() + Math.random(), _data: s }));
      renderTpSteps();
      // fill step values after render
      tpSteps.forEach((s) => {
        const d = s._data;
        if (!d) return;
        const nameEl = document.getElementById(`tp-s-name-${s.id}`);
        const toothEl = document.getElementById(`tp-s-tooth-${s.id}`);
        const dateEl = document.getElementById(`tp-s-date-${s.id}`);
        const statusEl = document.getElementById(`tp-s-status-${s.id}`);
        const descEl = document.getElementById(`tp-s-desc-${s.id}`);
        if (nameEl) nameEl.value = d.name || '';
        if (toothEl) toothEl.value = d.tooth || '';
        if (dateEl) dateEl.value = d.date || '';
        if (statusEl) statusEl.value = d.status || 'pending';
        if (descEl) descEl.value = d.description || '';
      });
      document.getElementById('modal-treatment-plan').classList.add('open');
    }

    function addTpStep() {
      const id = Date.now() + Math.random();
      tpSteps.push({ id });
      renderTpSteps();
    }

    const TOOTH_OPTIONS = [
      'السن 11 - القاطع المركزي العلوي الأيمن','السن 12 - القاطع الجانبي العلوي الأيمن','السن 13 - الناب العلوي الأيمن','السن 14 - الضاحك الأول العلوي الأيمن','السن 15 - الضاحك الثاني العلوي الأيمن','السن 16 - الطاحن الأول العلوي الأيمن','السن 17 - الطاحن الثاني العلوي الأيمن','السن 18 - ضرس العقل العلوي الأيمن',
      'السن 21 - القاطع المركزي العلوي الأيسر','السن 22 - القاطع الجانبي العلوي الأيسر','السن 23 - الناب العلوي الأيسر','السن 24 - الضاحك الأول العلوي الأيسر','السن 25 - الضاحك الثاني العلوي الأيسر','السن 26 - الطاحن الأول العلوي الأيسر','السن 27 - الطاحن الثاني العلوي الأيسر','السن 28 - ضرس العقل العلوي الأيسر',
      'السن 31 - القاطع المركزي السفلي الأيسر','السن 32 - القاطع الجانبي السفلي الأيسر','السن 33 - الناب السفلي الأيسر','السن 34 - الضاحك الأول السفلي الأيسر','السن 35 - الضاحك الثاني السفلي الأيسر','السن 36 - الطاحن الأول السفلي الأيسر','السن 37 - الطاحن الثاني السفلي الأيسر','السن 38 - ضرس العقل السفلي الأيسر',
      'السن 41 - القاطع المركزي السفلي الأيمن','السن 42 - القاطع الجانبي السفلي الأيمن','السن 43 - الناب السفلي الأيمن','السن 44 - الضاحك الأول السفلي الأيمن','السن 45 - الضاحك الثاني السفلي الأيمن','السن 46 - الطاحن الأول السفلي الأيمن','السن 47 - الطاحن الثاني السفلي الأيمن','السن 48 - ضرس العقل السفلي الأيمن',
      'أسنان متعددة','الفك العلوي كامل','الفك السفلي كامل','جميع الأسنان'
    ];

    function renderTpSteps() {
      const el = document.getElementById('tp-steps-list');
      el.innerHTML = tpSteps.map((s, i) => `
        <div class="tp-step-row" id="tp-step-${s.id}" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);position:relative">
          <div style="grid-column:1/-1;display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:12px;font-weight:700;color:var(--primary)">مرحلة ${i+1}</span>
            <button class="btn btn-danger btn-sm btn-icon" onclick="removeTpStep(${i})" title="حذف" style="margin-right:auto">🗑</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px">
            <label style="font-size:11px;font-weight:600;color:var(--text-muted)">نوع المعالجة</label>
            <input type="text" placeholder="مثال: حشو، خلع، تركيب..." id="tp-s-name-${s.id}" style="font-size:13px" />
          </div>
          <div style="display:flex;flex-direction:column;gap:4px">
            <label style="font-size:11px;font-weight:600;color:var(--text-muted)">السن المعالج</label>
            <select id="tp-s-tooth-${s.id}" style="font-size:13px">
              <option value="">-- اختر السن --</option>
              ${TOOTH_OPTIONS.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px">
            <label style="font-size:11px;font-weight:600;color:var(--text-muted)">التاريخ المقرر</label>
            <input type="date" id="tp-s-date-${s.id}" style="font-size:13px" />
          </div>
          <div style="display:flex;flex-direction:column;gap:4px">
            <label style="font-size:11px;font-weight:600;color:var(--text-muted)">حالة المرحلة</label>
            <select id="tp-s-status-${s.id}" style="font-size:13px">
              <option value="pending">قادمة</option>
              <option value="done">مكتملة</option>
              <option value="cancelled">ملغية</option>
            </select>
          </div>
          <div style="grid-column:1/-1;display:flex;flex-direction:column;gap:4px">
            <label style="font-size:11px;font-weight:600;color:var(--text-muted)">وصف الحالة الطبية السنية</label>
            <textarea id="tp-s-desc-${s.id}" placeholder="اكتب وصفاً تفصيلياً للحالة الطبية للسن المعالج، الأعراض، الحالة الراهنة..." style="font-size:13px;min-height:60px;resize:vertical"></textarea>
          </div>
        </div>
      `).join('');
    }

    function removeTpStep(i) { tpSteps.splice(i, 1); renderTpSteps(); }

    function saveTreatmentPlan() {
      const patId = document.getElementById('tp-patient').value;
      if (!patId) { toast('يرجى اختيار مريض', 'danger'); return; }
      const pat = patients.find(p => String(p.id) === String(patId));
      const steps = tpSteps.map(s => ({
        name: document.getElementById(`tp-s-name-${s.id}`)?.value || '',
        tooth: document.getElementById(`tp-s-tooth-${s.id}`)?.value || '',
        date: document.getElementById(`tp-s-date-${s.id}`)?.value || '',
        status: document.getElementById(`tp-s-status-${s.id}`)?.value || 'pending',
        description: document.getElementById(`tp-s-desc-${s.id}`)?.value || '',
      })).filter(s => s.name);

      if (editingPlanId) {
        // Edit existing plan
        const idx = treatmentPlans.findIndex(p => p.id === editingPlanId);
        if (idx !== -1) {
          treatmentPlans[idx] = {
            ...treatmentPlans[idx],
            patientId: parseInt(patId),
            patientName: pat ? fullName(pat) : '',
            patientPhone: pat ? (pat.phone||'') : '',
            patientAge: pat ? (pat.age||'') : '',
            date: document.getElementById('tp-date').value,
            doctor: document.getElementById('tp-doctor').value,
            diagnosis: document.getElementById('tp-diagnosis').value,
            steps,
            instructions: document.getElementById('tp-instructions').value,
            totalCost: parseFloat(document.getElementById('tp-total-cost').value) || 0,
            currency: document.getElementById('tp-currency').value,
            duration: document.getElementById('tp-duration').value,
            updatedAt: new Date().toISOString()
          };
        }
        toast('تم تحديث الخطة العلاجية ✅');
      } else {
        // New plan
        const plan = {
          id: Date.now(),
          patientId: parseInt(patId),
          patientName: pat ? fullName(pat) : '',
          patientPhone: pat ? (pat.phone||'') : '',
          patientAge: pat ? (pat.age||'') : '',
          date: document.getElementById('tp-date').value,
          doctor: document.getElementById('tp-doctor').value,
          diagnosis: document.getElementById('tp-diagnosis').value,
          steps,
          instructions: document.getElementById('tp-instructions').value,
          totalCost: parseFloat(document.getElementById('tp-total-cost').value) || 0,
          currency: document.getElementById('tp-currency').value,
          duration: document.getElementById('tp-duration').value,
          createdAt: new Date().toISOString()
        };
        treatmentPlans.unshift(plan);
        toast('تم حفظ الخطة العلاجية ✅');
      }
      editingPlanId = null;
      saveTreatmentPlans();
      closeModal('modal-treatment-plan');
      renderTreatmentPlansList();
    }

    function renderTreatmentPlansList() {
      const el = document.getElementById('treatment-plans-list');
      if (!el) return;
      if (!treatmentPlans.length) {
        el.innerHTML = `<div class="empty-state"><div class="icon">📋</div><h3>لا توجد خطط علاجية</h3><p>ابدأ بإنشاء خطة علاجية لأحد المرضى</p></div>`;
        return;
      }
      el.innerHTML = treatmentPlans.map(plan => {
        const done = plan.steps.filter(s => s.status === 'done').length;
        const total = plan.steps.length;
        const pct = total ? Math.round(done/total*100) : 0;
        return `<div class="tp-plan-card">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px">
            <div>
              <div style="font-size:16px;font-weight:700">👤 ${plan.patientName}</div>
              <div style="font-size:12px;color:var(--text-muted)">📅 ${plan.date} &nbsp;|&nbsp; 👨‍⚕️ ${plan.doctor||'—'}</div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-accent btn-sm" onclick="printTreatmentPlan(${plan.id})">🖨 طباعة / PDF</button>
              <button class="btn btn-primary btn-sm" onclick="editTreatmentPlan(${plan.id})">✏️ تعديل</button>
              <button class="btn btn-danger btn-sm" onclick="deleteTreatmentPlan(${plan.id})">🗑</button>
            </div>
          </div>
          <div style="font-size:13px;margin-bottom:8px"><strong>التشخيص:</strong> ${plan.diagnosis||'—'}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <div style="flex:1;background:var(--border);border-radius:999px;height:8px">
              <div style="background:${pct===100?'var(--success)':'var(--accent)'};height:8px;border-radius:999px;width:${pct}%;transition:width 0.5s"></div>
            </div>
            <span style="font-size:12px;font-weight:700">${done}/${total} مراحل — ${pct}%</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted)">التكلفة: ${plan.totalCost.toLocaleString()} ${plan.currency} &nbsp;|&nbsp; المدة: ${plan.duration||'—'}</div>
        </div>`;
      }).join('');
    }

    function deleteTreatmentPlan(id) {
      if (!confirm('هل تريد حذف هذه الخطة؟')) return;
      treatmentPlans = treatmentPlans.filter(p => p.id !== id);
      saveTreatmentPlans();
      renderTreatmentPlansList();
      toast('تم حذف الخطة', 'danger');
    }

    function printTreatmentPlan(id) {
      const plan = treatmentPlans.find(p => p.id === id);
      if (!plan) return;
      const clinicName = localStorage.getItem('dental_clinic_name') || 'عيادة الأسنان';
      const statusLabels = { pending: 'قادمة', done: '✅ مكتملة', cancelled: '❌ ملغية' };
      const printWin = window.open('', '_blank', 'width=900,height=700');
      printWin.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>خطة علاجية — ${plan.patientName}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Cairo', sans-serif; color: #1a2e3b; background: #fff; padding: 30px; direction: rtl; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0a4d6e; padding-bottom: 16px; margin-bottom: 20px; }
  .clinic-name { font-size: 22px; font-weight: 800; color: #0a4d6e; }
  .clinic-sub { font-size: 13px; color: #6b8fa8; margin-top: 4px; }
  .plan-title { font-size: 18px; font-weight: 700; color: #00c4b4; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f0f4f8; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
  .info-row { font-size: 13px; }
  .info-label { font-weight: 700; color: #0a4d6e; }
  .section-title { font-size: 15px; font-weight: 800; color: #0a4d6e; border-right: 4px solid #00c4b4; padding-right: 10px; margin: 18px 0 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #0a4d6e; color: #fff; padding: 8px 12px; font-size: 12px; text-align: right; }
  td { padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #dde6ee; }
  tr:nth-child(even) td { background: #f8fafc; }
  .status-done { color: #38a169; font-weight: 700; }
  .status-pending { color: #d69e2e; }
  .status-cancelled { color: #e53e3e; text-decoration: line-through; }
  .instructions-box { background: #e0f7f5; border: 1px solid #00c4b4; border-radius: 8px; padding: 14px; font-size: 13px; line-height: 1.8; }
  .footer { text-align: center; font-size: 11px; color: #6b8fa8; border-top: 1px solid #dde6ee; padding-top: 14px; margin-top: 30px; }
  .cost-box { background: #0a4d6e; color: #fff; border-radius: 8px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .cost-val { font-size: 22px; font-weight: 800; }
  @media print { body { padding: 15px; } button { display: none; } }
</style>
</head>
<body>
<div class="header">
  <div><div class="clinic-name">🦷 ${clinicName}</div><div class="clinic-sub">نظام إدارة المرضى</div></div>
  <div style="text-align:left"><div class="plan-title">الخطة العلاجية</div><div style="font-size:12px;color:#6b8fa8;margin-top:4px">رقم: ${plan.id}</div></div>
</div>

<div class="info-grid">
  <div class="info-row"><span class="info-label">المريض: </span>${plan.patientName}</div>
  <div class="info-row"><span class="info-label">الهاتف: </span>${plan.patientPhone || '—'}</div>
  <div class="info-row"><span class="info-label">العمر: </span>${plan.patientAge || '—'}</div>
  <div class="info-row"><span class="info-label">تاريخ الخطة: </span>${plan.date}</div>
  <div class="info-row"><span class="info-label">الطبيب المعالج: </span>${plan.doctor || '—'}</div>
  <div class="info-row"><span class="info-label">المدة المتوقعة: </span>${plan.duration || '—'}</div>
</div>

${plan.diagnosis ? `<div class="section-title">التشخيص</div><div style="font-size:13px;line-height:1.8;margin-bottom:16px">${plan.diagnosis}</div>` : ''}

<div class="section-title">مراحل العلاج</div>
<table>
  <thead><tr><th>#</th><th>المعالجة</th><th>السن المعالج</th><th>التاريخ المقرر</th><th>الحالة</th><th>وصف الحالة</th></tr></thead>
  <tbody>
    ${plan.steps.map((s, i) => `<tr>
      <td>${i+1}</td>
      <td>${s.name}</td>
      <td>${s.tooth || '—'}</td>
      <td>${s.date || '—'}</td>
      <td class="status-${s.status}">${statusLabels[s.status] || s.status}</td>
      <td style="font-size:11px;color:#4a5568">${s.description || '—'}</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="cost-box">
  <span>التكلفة الإجمالية التقديرية</span>
  <span class="cost-val">${plan.totalCost.toLocaleString()} ${plan.currency}</span>
</div>

${plan.instructions ? `<div class="section-title">التعليمات والتوصيات</div><div class="instructions-box">${plan.instructions}</div>` : ''}

<div class="footer">
  <p>${clinicName} &nbsp;|&nbsp; تم الإنشاء: ${new Date(plan.createdAt).toLocaleDateString('ar-SY')}</p>
  <p style="margin-top:4px">هذه الوثيقة سرية وخاصة بالمريض</p>
  <button onclick="window.print()" style="margin-top:12px;background:#0a4d6e;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-family:inherit;font-size:13px;cursor:pointer">🖨 طباعة / حفظ PDF</button>
</div>
</body>
</html>`);
      printWin.document.close();
      setTimeout(() => printWin.print(), 800);
    }

    // Set reminder interval check
    setInterval(renderReminders, 60000);

    // Init calendar view buttons style
    setTimeout(() => setCalView('month'), 200);
