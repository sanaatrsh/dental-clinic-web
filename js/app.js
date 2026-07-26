      // ===========================
      // STATE
      // ===========================
      let patients = JSON.parse(
        localStorage.getItem("dental_patients_v2") || "[]",
      );
      let currentPatientIndex = null;
      let editXrays = [];
      let addXrays = [];

      const diseaseLabelMap = {
        diabetes: 'السكري', heart: 'أمراض القلب', pressure: 'ضغط الدم',
        surgery: 'عمليات جراحية', allergy: 'الحساسية', bleeding: 'اضطرابات التخثر',
        osteoporosis: 'هشاشة العظام', thyroid: 'الغدة الدرقية',
        kidney: 'أمراض الكلى', liver: 'أمراض الكبد', asthma: 'الربو',
        pregnancy: 'حمل', cancer: 'السرطان', other: 'أخرى'
      };

      function toggleHealthFields(ctx) {
        const prefix = ctx === 'add' ? 'p' : 'e';
        const status = document.getElementById(prefix + '-health-status').value;
        const show = status === 'sick';
        document.getElementById(prefix + '-disease-group').style.display = show ? '' : 'none';
        document.getElementById(prefix + '-surgery-group').style.display = show ? '' : 'none';
        document.getElementById(prefix + '-disease-notes-group').style.display = show ? '' : 'none';
      }

      function toggleLabSection() {
        const show = document.getElementById('t-has-lab').value === 'yes';
        document.getElementById('t-lab-section').style.display = show ? '' : 'none';
      }

      function calcLabRemaining() {
        const cost = Number(document.getElementById('t-lab-cost').value) || 0;
        const paid = Number(document.getElementById('t-lab-paid').value) || 0;
        document.getElementById('t-lab-remaining').value = Math.max(0, cost - paid);
      }

      // ===========================
      // SECURITY: XSS SANITIZER
      // ===========================
      function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\//g, '&#x2F;');
      }

      // ===========================
      // STORAGE: SAFE SAVE + QUOTA GUARD
      // ===========================
      function saveState() {
        try {
          localStorage.setItem("dental_patients_v2", JSON.stringify(patients));
        } catch (e) {
          if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
            showStorageWarning();
          } else {
            console.error('خطأ في الحفظ:', e);
          }
        }
      }

      function safeLocalSet(key, value) {
        try {
          localStorage.setItem(key, value);
          return true;
        } catch (e) {
          if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
            showStorageWarning();
          }
          return false;
        }
      }

      function showStorageWarning() {
        if (document.getElementById('storage-quota-warning')) return;
        const div = document.createElement('div');
        div.id = 'storage-quota-warning';
        div.style.cssText = [
          'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
          'background:linear-gradient(135deg,#dc3545,#c82333)',
          'color:#fff', 'padding:14px 20px', 'text-align:center',
          'direction:rtl', 'font-size:14px', 'font-weight:700',
          'box-shadow:0 4px 20px rgba(0,0,0,0.3)',
          'display:flex', 'align-items:center', 'justify-content:center', 'gap:12px'
        ].join(';');
        const msg = document.createElement('span');
        msg.textContent = '⚠️ تحذير: مساحة التخزين ممتلئة! بعض البيانات لم تُحفظ.';
        const btnBackup = document.createElement('button');
        btnBackup.textContent = '💾 نسخ احتياطي الآن';
        btnBackup.style.cssText = 'background:#fff;color:#dc3545;border:none;padding:6px 14px;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px';
        btnBackup.onclick = () => { exportAllJSON(); div.remove(); };
        const btnClose = document.createElement('button');
        btnClose.textContent = '✕';
        btnClose.style.cssText = 'background:rgba(255,255,255,0.2);color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:13px';
        btnClose.onclick = () => div.remove();
        div.appendChild(msg);
        div.appendChild(btnBackup);
        div.appendChild(btnClose);
        document.body.prepend(div);
      }

      // ===========================
      // DARK MODE
      // ===========================
      const savedTheme = localStorage.getItem("dental_theme") || "light";
      document.documentElement.setAttribute("data-theme", savedTheme);

      function toggleTheme() {
        const current = document.documentElement.getAttribute("data-theme");
        const next = current === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("dental_theme", next);
        document.getElementById("theme-icon").textContent =
          next === "dark" ? "🌙" : "☀️";
      }

      if (savedTheme === "dark") {
        document.getElementById("theme-icon").textContent = "🌙";
      }

      // ===========================
      // MOBILE SIDEBAR
      // ===========================
      function openSidebar() {
        document.getElementById("sidebar").classList.add("open");
        document.getElementById("sidebar-overlay").classList.add("open");
      }
      function closeSidebar() {
        document.getElementById("sidebar").classList.remove("open");
        document.getElementById("sidebar-overlay").classList.remove("open");
      }

      // ===========================
      // NAVIGATION
      // ===========================
      const pageConfig = {
        dashboard: { title: "لوحة التحكم", subtitle: "نظرة عامة على العيادة" },
        patients: {
          title: "قائمة المرضى",
          subtitle: "إدارة سجلات جميع المرضى",
        },
        "add-patient": { title: "مريض جديد", subtitle: "إضافة سجل مريض جديد" },
        import: {
          title: "تحميل ملف مريض",
          subtitle: "رفع وتعديل بيانات مريض موجود",
        },
        backup: {
          title: "النسخة الاحتياطية",
          subtitle: "تصدير واستعادة بيانات جميع المرضى",
        },
        "patient-detail": {
          title: "ملف المريض",
          subtitle: "السجل الطبي التفصيلي",
        },
        calendar: {
          title: "تقويم المواعيد",
          subtitle: "إدارة المواعيد اليومية والأسبوعية",
        },
        analytics: {
          title: "التحليلات المتقدمة",
          subtitle: "إحصاءات وتقارير أداء العيادة",
        },
        "treatment-plans": {
          title: "الخطط العلاجية",
          subtitle: "إنشاء وطباعة الخطط العلاجية للمرضى",
        },
      };

      function showPage(name) {
        document
          .querySelectorAll(".page")
          .forEach((p) => p.classList.remove("active"));
        document
          .querySelectorAll(".nav-item")
          .forEach((n) => n.classList.remove("active"));
        document.getElementById("page-" + name).classList.add("active");
        const cfg = pageConfig[name] || {};
        document.getElementById("page-title").textContent = cfg.title || "";
        document.getElementById("page-subtitle").textContent =
          cfg.subtitle || "";
        const navMap = {
          dashboard: 0,
          patients: 1,
          "add-patient": 2,
          import: 3,
          backup: 4,
        };
        if (navMap[name] !== undefined) {
          document
            .querySelectorAll(".nav-item")
            [navMap[name]].classList.add("active");
        }
        if (name === "dashboard") renderDashboard();
        if (name === "patients") {
          resetFilters();
          renderPatientsList();
        }
        if (name === "backup") renderStorageStats();
        if (name === "calendar") {
          loadDoctorEmail();
          requestNotificationPermission();
          setCalView(calView);
        }
        if (name === "analytics") setTimeout(renderAnalytics, 50);
        if (name === "treatment-plans") renderTreatmentPlansList();
        window.scrollTo(0, 0);
      }

      // ===========================
      // TOAST
      // ===========================
      function toast(msg, type = "success") {
        const tc = document.getElementById("toast-container");
        const t = document.createElement("div");
        t.className = `toast ${type}`;
        t.textContent =
          (type === "success" ? "✅ " : type === "danger" ? "❌ " : "ℹ️ ") +
          msg;
        tc.appendChild(t);
        setTimeout(() => t.remove(), 3500);
      }

      // ===========================
      // HELPERS
      // ===========================
      function fullName(p) {
        return [p.firstname, p.fathername, p.lastname]
          .filter(Boolean)
          .map(escapeHtml)
          .join(" ");
      }
      function getInitials(p) {
        const fn = escapeHtml(p.firstname || "");
        const ln = escapeHtml(p.lastname || "");
        return (fn[0] || "") + (ln[0] || "") || "?";
      }
      function genderLabel(g) {
        if (g === "male") return "👨 ذكر";
        if (g === "female") return "👩 أنثى";
        return "-";
      }
      function currencyLabel(c) {
        if (c === "USD") return "USD $";
        return "ل.س";
      }
      function formatAmount(amount, currency) {
        const num = Number(amount) || 0;
        if (currency === "USD") return "$" + num.toLocaleString();
        return num.toLocaleString() + " ل.س";
      }

      // ===========================
      // DASHBOARD
      // ===========================
      function renderDashboard() {
        document.getElementById("stat-total").textContent = patients.length;
        const treatments = patients.reduce(
          (s, p) => s + (p.treatments || []).length,
          0,
        );
        document.getElementById("stat-treatments").textContent = treatments;

        // Multi-currency totals
        const allCurrencyTotals = {};
        patients.forEach(p => {
          Object.entries(p.currencyTotals || {}).forEach(([cur, b]) => {
            if (!allCurrencyTotals[cur]) allCurrencyTotals[cur] = {paid:0, remaining:0};
            allCurrencyTotals[cur].paid += b.paid;
            allCurrencyTotals[cur].remaining += b.remaining;
          });
        });

        // Update stat cards with multi-currency
        const currencies = Object.keys(allCurrencyTotals);
        if (currencies.length === 0) {
          document.getElementById("stat-paid").textContent = "0";
          document.getElementById("stat-remaining").textContent = "0";
        } else if (currencies.length === 1) {
          const c = currencies[0];
          document.getElementById("stat-paid").textContent = allCurrencyTotals[c].paid.toLocaleString() + " " + currencyLabel(c);
          document.getElementById("stat-remaining").textContent = allCurrencyTotals[c].remaining.toLocaleString() + " " + currencyLabel(c);
        } else {
          const paidLines = currencies.map(c => `${allCurrencyTotals[c].paid.toLocaleString()} ${currencyLabel(c)}`).join(" | ");
          const remLines = currencies.map(c => `${allCurrencyTotals[c].remaining.toLocaleString()} ${currencyLabel(c)}`).join(" | ");
          document.getElementById("stat-paid").innerHTML = currencies.map(c => `<div style="font-size:13px">${allCurrencyTotals[c].paid.toLocaleString()} <span style="font-size:10px">${currencyLabel(c)}</span></div>`).join("");
          document.getElementById("stat-remaining").innerHTML = currencies.map(c => `<div style="font-size:13px">${allCurrencyTotals[c].remaining.toLocaleString()} <span style="font-size:10px">${currencyLabel(c)}</span></div>`).join("");
        }

        // Lab cost totals across all patients
        const labByCur = {};
        patients.forEach(p => {
          (p.treatments||[]).filter(t=>t.hasLab).forEach(t => {
            const c = t.labCurrency || 'SYP';
            if (!labByCur[c]) labByCur[c] = {total:0, remaining:0};
            labByCur[c].total += Number(t.labCost)||0;
            labByCur[c].remaining += Math.max(0,(Number(t.labCost)||0)-(Number(t.labPaid)||0));
          });
        });
        const labCurs = Object.keys(labByCur);
        if (labCurs.length === 0) {
          document.getElementById("stat-lab-total").textContent = "0";
          document.getElementById("stat-lab-remaining").textContent = "0";
        } else if (labCurs.length === 1) {
          const c = labCurs[0];
          document.getElementById("stat-lab-total").textContent = labByCur[c].total.toLocaleString() + " " + currencyLabel(c);
          document.getElementById("stat-lab-remaining").textContent = labByCur[c].remaining.toLocaleString() + " " + currencyLabel(c);
        } else {
          document.getElementById("stat-lab-total").innerHTML = labCurs.map(c=>`<div style="font-size:13px">${labByCur[c].total.toLocaleString()} <span style="font-size:10px">${currencyLabel(c)}</span></div>`).join("");
          document.getElementById("stat-lab-remaining").innerHTML = labCurs.map(c=>`<div style="font-size:13px">${labByCur[c].remaining.toLocaleString()} <span style="font-size:10px">${currencyLabel(c)}</span></div>`).join("");
        }

        const tbody = document.getElementById("dashboard-table");
        const empty = document.getElementById("dashboard-empty");
        const recent = [...patients].reverse().slice(0, 5);
        tbody.innerHTML = "";
        if (!recent.length) {
          empty.style.display = "block";
          return;
        }
        empty.style.display = "none";
        recent.forEach((p) => {
          const idx = patients.indexOf(p);
          const remColor =
            p.hasRemaining ||
            Object.values(p.currencyTotals || {}).some((b) => b.remaining > 0)
              ? "var(--danger)"
              : "var(--success)";
          const hasAnyRem =
            p.hasRemaining ||
            Object.values(p.currencyTotals || {}).some((b) => b.remaining > 0);
          const isFemale = p.gender === "female";
          const healthBadge = p.healthStatus === 'sick'
            ? `<span class="badge badge-warning" style="font-size:10px">🏥 ${diseaseLabelMap[p.disease] || 'مريض'}</span>`
            : '';
          tbody.innerHTML += `
      <tr>
        <td><div class="patient-name-cell">
          <div class="patient-avatar ${isFemale ? "female" : ""}">${getInitials(p)}</div>
          <div><div style="font-weight:600">${fullName(p)}</div>
          <div style="font-size:11px;color:var(--text-muted)">${escapeHtml(p.phone || "")}</div></div>
        </div></td>
        <td><span class="${isFemale ? "gender-tag-f" : "gender-tag-m"}">${genderLabel(p.gender)}</span></td>
        <td>${escapeHtml(String(p.age || "-"))}</td>
        <td>${escapeHtml(p.phone || "-")}</td>
        <td><span class="badge badge-info">${(p.treatments || []).length} معالجة</span> ${healthBadge}</td>
        <td style="color:${remColor};font-weight:700">${hasAnyRem ? "متبقي" : "مسدد بالكامل"}</td>
        <td><button class="btn btn-primary btn-sm" onclick="showDetail(${idx})">📋 عرض</button></td>
      </tr>`;
        });
      }

      // ===========================
      // PATIENTS LIST + FILTERS
      // ===========================
      let activeFilters = {};

      function toggleFilterPanel() {
        const panel = document.getElementById("filter-panel");
        panel.classList.toggle("open");
        document.getElementById("filter-btn").textContent =
          panel.classList.contains("open") ? "🔼 إغلاق" : "🔽 فلترة";
      }

      function applyFilters() {
        const name = (
          document.getElementById("search-input").value || ""
        ).trim();
        const gender = document.getElementById("f-gender").value;
        const ageMin = document.getElementById("f-age-min").value;
        const ageMax = document.getElementById("f-age-max").value;
        const address = (
          document.getElementById("f-address").value || ""
        ).trim();
        const payment = document.getElementById("f-payment").value;
        const health = document.getElementById("f-health").value;
        const disease = document.getElementById("f-disease").value;
        const surgery = document.getElementById("f-surgery").value;

        activeFilters = { name, gender, ageMin, ageMax, address, payment, health, disease, surgery };
        renderPatientsList();
        updateFilterBadges();
      }

      function resetFilters() {
        document.getElementById("search-input").value = "";
        document.getElementById("f-gender").value = "";
        document.getElementById("f-age-min").value = "";
        document.getElementById("f-age-max").value = "";
        document.getElementById("f-address").value = "";
        document.getElementById("f-payment").value = "";
        document.getElementById("f-health").value = "";
        document.getElementById("f-disease").value = "";
        document.getElementById("f-surgery").value = "";
        activeFilters = {};
        renderPatientsList();
        updateFilterBadges();
      }

      function updateFilterBadges() {
        const container = document.getElementById("filter-badges");
        const badges = [];
        if (activeFilters.name) badges.push(`الاسم: ${activeFilters.name}`);
        if (activeFilters.gender)
          badges.push(
            activeFilters.gender === "male" ? "👨 ذكور فقط" : "👩 إناث فقط",
          );
        if (activeFilters.ageMin)
          badges.push(`العمر من: ${activeFilters.ageMin}`);
        if (activeFilters.ageMax)
          badges.push(`العمر إلى: ${activeFilters.ageMax}`);
        if (activeFilters.address)
          badges.push(`المنطقة: ${activeFilters.address}`);
        if (activeFilters.payment === "paid") badges.push("مسدد بالكامل");
        if (activeFilters.payment === "remaining") badges.push("متبقي عليه");
        if (activeFilters.health === "healthy") badges.push("✅ سليم");
        if (activeFilters.health === "sick") badges.push("🏥 مريض");
        if (activeFilters.disease) badges.push(`المرض: ${diseaseLabelMap[activeFilters.disease] || activeFilters.disease}`);
        if (activeFilters.surgery === "yes") badges.push("⚕️ لديه عمليات جراحية");
        if (activeFilters.surgery === "no") badges.push("لا توجد عمليات جراحية");

        if (!badges.length) {
          container.innerHTML = "";
          return;
        }
        container.innerHTML = badges
          .map(
            (b) => `
    <span class="filter-badge">${b} <button onclick="resetFilters()">×</button></span>
  `,
          )
          .join("");
      }

      function renderPatientsList() {
        const tbody = document.getElementById("patients-table");
        const empty = document.getElementById("patients-empty");

        let filtered = [...patients];

        if (activeFilters.name) {
          filtered = filtered.filter((p) =>
            fullName(p).includes(activeFilters.name),
          );
        }
        if (activeFilters.gender) {
          filtered = filtered.filter((p) => p.gender === activeFilters.gender);
        }
        if (activeFilters.ageMin !== undefined && activeFilters.ageMin !== "") {
          filtered = filtered.filter(
            (p) => Number(p.age) >= Number(activeFilters.ageMin),
          );
        }
        if (activeFilters.ageMax !== undefined && activeFilters.ageMax !== "") {
          filtered = filtered.filter(
            (p) => Number(p.age) <= Number(activeFilters.ageMax),
          );
        }
        if (activeFilters.address) {
          filtered = filtered.filter((p) =>
            (p.address || "").includes(activeFilters.address),
          );
        }
        if (activeFilters.payment === "paid") {
          filtered = filtered.filter(
            (p) =>
              !p.hasRemaining &&
              !Object.values(p.currencyTotals || {}).some(
                (b) => b.remaining > 0,
              ),
          );
        } else if (activeFilters.payment === "remaining") {
          filtered = filtered.filter(
            (p) =>
              p.hasRemaining ||
              Object.values(p.currencyTotals || {}).some(
                (b) => b.remaining > 0,
              ),
          );
        }
        if (activeFilters.health) {
          filtered = filtered.filter(p => (p.healthStatus || 'healthy') === activeFilters.health);
        }
        if (activeFilters.disease) {
          filtered = filtered.filter(p => p.disease === activeFilters.disease);
        }
        if (activeFilters.surgery) {
          filtered = filtered.filter(p => (p.surgery || 'no') === activeFilters.surgery);
        }

        document.getElementById("patients-count").textContent =
          filtered.length + " مريض";
        tbody.innerHTML = "";
        // Mobile card view container
        let mobileCards = document.getElementById("patients-mobile-cards");
        if (!mobileCards) {
          mobileCards = document.createElement("div");
          mobileCards.id = "patients-mobile-cards";
          mobileCards.className = "mobile-cards-list";
          tbody.closest(".table-wrap").insertAdjacentElement("afterend", mobileCards);
        }
        mobileCards.innerHTML = "";

        if (!filtered.length) {
          empty.style.display = "block";
          return;
        }
        empty.style.display = "none";

        filtered.forEach((p) => {
          const idx = patients.indexOf(p);
          recalcPatientTotals(p); // ensure fresh calculation
          const hasAnyRemaining =
            p.hasRemaining ||
            Object.values(p.currencyTotals || {}).some((b) => b.remaining > 0);
          const remColor = hasAnyRemaining ? "var(--danger)" : "var(--success)";
          const isFemale = p.gender === "female";
          const currencies = Object.keys(p.currencyTotals || {});
          // Build paid/remaining display per currency
          let paidDisplay = "";
          let remDisplay = "";
          if (currencies.length <= 1) {
            const cur = p.currency || "SYP";
            paidDisplay = formatAmount(p.paid, cur);
            remDisplay = hasAnyRemaining
              ? formatAmount(p.remaining, cur)
              : "✅ مسدد";
          } else {
            paidDisplay = currencies
              .map((c) => {
                const b = p.currencyTotals[c];
                return `<div style="font-size:11px">${b.paid.toLocaleString()} ${currencyLabel(c)}</div>`;
              })
              .join("");
            remDisplay = currencies
              .map((c) => {
                const b = p.currencyTotals[c];
                if (b.remaining > 0)
                  return `<div style="font-size:11px;color:var(--danger)">${b.remaining.toLocaleString()} ${currencyLabel(c)}</div>`;
                return `<div style="font-size:11px;color:var(--success)">✅ ${currencyLabel(c)}</div>`;
              })
              .join("");
          }
          // Mobile card
        const remTxt = hasAnyRemaining ? `<span style="color:var(--danger);font-weight:700">${remDisplay}</span>` : `<span style="color:var(--success);font-weight:700">✅ مسدد</span>`;
        mobileCards.innerHTML += `
      <div class="mobile-patient-card" onclick="showDetail(${idx})">
        <div class="mpc-top">
          <div class="patient-avatar ${isFemale ? "female" : ""}" style="width:40px;height:40px;font-size:15px;flex-shrink:0">${getInitials(p)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${fullName(p)}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${escapeHtml(p.phone || "")} ${p.age ? "· " + escapeHtml(String(p.age)) + " سنة" : ""}</div>
          </div>
          <div style="display:flex;gap:5px;flex-shrink:0">
            <button class="btn btn-outline btn-sm btn-icon" onclick="event.stopPropagation();exportSingleExcel(${idx})" title="تصدير Excel" aria-label="تصدير Excel">📊</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation();deletePatient(${idx})" title="حذف المريض" aria-label="حذف المريض">🗑️</button>
          </div>
        </div>
        <div class="mpc-stats">
          <div class="mpc-stat"><span style="font-size:10px;color:var(--text-muted)">المعالجات</span><span style="font-weight:700;color:var(--primary)">${(p.treatments||[]).length}</span></div>
          <div class="mpc-stat"><span style="font-size:10px;color:var(--text-muted)">مدفوع</span><span style="font-weight:700;color:var(--success);font-size:12px">${paidDisplay}</span></div>
          <div class="mpc-stat"><span style="font-size:10px;color:var(--text-muted)">متبقي</span>${remTxt}</div>
        </div>
      </div>`;

        tbody.innerHTML += `
      <tr>
        <td style="color:var(--text-muted);font-size:12px">${idx + 1}</td>
        <td><div class="patient-name-cell">
          <div class="patient-avatar ${isFemale ? "female" : ""}">${getInitials(p)}</div>
          <div><div style="font-weight:600">${fullName(p)}</div>
          <div style="font-size:11px;color:var(--text-muted)">${escapeHtml(p.address || "")}</div></div>
        </div></td>
        <td><span class="${isFemale ? "gender-tag-f" : "gender-tag-m"}">${genderLabel(p.gender)}</span></td>
        <td>${escapeHtml(String(p.age || "-"))}</td>
        <td>${escapeHtml(p.phone || "-")}</td>
        <td style="font-size:12px;max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(p.address || "-")}</td>
        <td>${(p.treatments || []).length}</td>
        <td style="color:var(--success);font-weight:600">${paidDisplay}</td>
        <td style="color:${remColor};font-weight:700">${remDisplay}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn btn-primary btn-sm" onclick="showDetail(${idx})" aria-label="عرض تفاصيل المريض">📋</button>
            <button class="btn btn-outline btn-sm" onclick="exportSingleExcel(${idx})" aria-label="تصدير Excel">📊</button>
            <button class="btn btn-danger btn-sm" onclick="deletePatient(${idx})" aria-label="حذف المريض">🗑️</button>
          </div>
        </td>
      </tr>`;
        });
      }

      // ===========================
      // ADD PATIENT
      // ===========================
      let addTreatments = [];

      function addTreatmentRow() {
        const today = new Date().toISOString().split("T")[0];
        addTreatments.push({
          id: Date.now(),
          name: "",
          date: today,
          tooth: "",
          cost: 0,
          paid: 0,
          remaining: 0,
          currency: "SYP",
          hasLab: false,
          labCost: 0,
          labPaid: 0,
          labRemaining: 0,
          labCurrency: "SYP",
          labDetails: "",
        });
        renderAddTreatments();
      }

      function toggleAddLabSection(i) {
        const val = document.getElementById("addhaslab_" + i).value === "yes";
        addTreatments[i].hasLab = val;
        document.getElementById("addlabsec_" + i).style.display = val ? "" : "none";
      }

      function calcAddLabRem(i) {
        const cost = Number(addTreatments[i].labCost) || 0;
        const paid = Number(addTreatments[i].labPaid) || 0;
        const rem = Math.max(0, cost - paid);
        addTreatments[i].labRemaining = rem;
        const el = document.getElementById("addlabrem_" + i);
        if (el) el.value = rem;
      }

      function renderAddTreatments() {
        const el = document.getElementById("treatments-list-add");
        el.innerHTML = "";
        addTreatments.forEach((t, i) => {
          const uid = "add_tooth_" + i;
          el.innerHTML += `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;margin-bottom:10px;position:relative">

        <!-- Row 1: نوع المعالجة + السن المعالج + التاريخ -->
        <div class="form-grid-3" style="margin-bottom:12px;align-items:end">

          <div class="form-group">
            <label>نوع المعالجة <span class="required">*</span></label>
            <input type="text" value="${t.name}" placeholder="حشو، خلع، تركيب..." oninput="addTreatments[${i}].name=this.value">
          </div>

          <!-- السن المعالج - قائمة منسدلة -->
          <div class="form-group">
            <label>السن المعالج</label>
            <div style="position:relative" id="wrap_${uid}">
              <div style="display:flex;border:1.5px solid var(--border);border-radius:var(--radius-sm);background:var(--surface2);transition:all 0.2s">
                <button type="button"
                  onclick="toggleAddToothDD('${uid}', ${i})"
                  style="padding:0 11px;background:var(--accent-soft);border:none;border-left:1.5px solid var(--border);cursor:pointer;color:var(--primary);font-size:15px;border-radius:0 var(--radius-sm) var(--radius-sm) 0;display:flex;align-items:center;flex-shrink:0">▾</button>
                <input type="text" id="inp_${uid}"
                  value="${t.tooth}"
                  placeholder="اكتب أو اختر السن..."
                  oninput="addTreatments[${i}].tooth=this.value; filterAddToothDD('${uid}', ${i})"
                  onfocus="openAddToothDD('${uid}', ${i})"
                  autocomplete="off"
                  style="flex:1;border:none;background:transparent;padding:9px 10px;font-family:inherit;font-size:13px;color:var(--text);outline:none;min-width:0">
              </div>
              <!-- Dropdown -->
              <div id="dd_${uid}"
                style="display:none;position:absolute;top:calc(100% + 3px);left:0;right:0;background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow-lg);z-index:300;max-height:280px;overflow:hidden;direction:rtl">
                <div style="padding:7px 8px;border-bottom:1px solid var(--border);background:var(--surface2);position:sticky;top:0">
                  <input type="text" id="srch_${uid}"
                    placeholder="🔍 ابحث عن سن..."
                    oninput="filterAddToothDD('${uid}', ${i})"
                    style="width:100%;padding:6px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px;font-family:inherit;color:var(--text);background:var(--surface);outline:none">
                </div>
                <div id="list_${uid}" style="overflow-y:auto;max-height:170px;padding:3px"></div>
                <div style="padding:7px 8px;border-top:1px solid var(--border);background:var(--surface2);display:flex;gap:6px;align-items:center">
                  <input type="text" id="cust_${uid}"
                    placeholder="أضف خياراً مخصصاً..."
                    style="flex:1;padding:6px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px;font-family:inherit;color:var(--text);background:var(--surface);outline:none">
                  <button type="button" onclick="addCustomAddTooth('${uid}', ${i})"
                    style="padding:6px 12px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap;font-family:inherit">➕ إضافة</button>
                </div>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>التاريخ</label>
            <div style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center">
              <input type="date" value="${t.date}" oninput="addTreatments[${i}].date=this.value">
              <button class="btn btn-danger btn-icon" onclick="addTreatments.splice(${i},1);renderAddTreatments()" title="حذف المعالجة">✕</button>
            </div>
          </div>
        </div>

        <!-- Row 2: التكلفة + المسدَّد + المتبقي -->
        <div class="form-grid-3" style="align-items:end;margin-bottom:10px">
          <div class="form-group">
            <label>التكلفة</label>
            <div class="input-with-currency">
              <input type="number" value="${t.cost || 0}" placeholder="0" min="0"
                oninput="addTreatments[${i}].cost=Number(this.value);calcAddTreatmentRem(${i})">
              <div class="currency-select-wrap">
                <select onchange="addTreatments[${i}].currency=this.value">
                  <option value="SYP" ${(t.currency || "SYP") === "SYP" ? "selected" : ""}>ل.س</option>
                  <option value="USD" ${t.currency === "USD" ? "selected" : ""}>USD $</option>
                  <option value="EUR" ${t.currency === "EUR" ? "selected" : ""}>EUR €</option>
                </select>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>المسدَّد</label>
            <input type="number" value="${t.paid || 0}" placeholder="0" min="0"
              oninput="addTreatments[${i}].paid=Number(this.value);calcAddTreatmentRem(${i})">
          </div>
          <div class="form-group">
            <label>المتبقي</label>
            <input type="number" id="addrem_${i}" value="${t.remaining || 0}" placeholder="0" readonly
              style="background:var(--surface2);color:var(--danger);font-weight:700">
          </div>
        </div>

        <!-- Row 3: تكلفة مخبرية -->
        <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-top:2px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0">
            <div style="font-size:12px;font-weight:700;color:var(--primary);display:flex;align-items:center;gap:6px">🔬 تكلفة مخبرية</div>
            <select id="addhaslab_${i}" onchange="toggleAddLabSection(${i})"
              style="font-size:12px;padding:4px 10px;border:1.5px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--text);font-family:inherit;cursor:pointer">
              <option value="no" ${!t.hasLab ? 'selected' : ''}>لا</option>
              <option value="yes" ${t.hasLab ? 'selected' : ''}>نعم</option>
            </select>
          </div>
          <div id="addlabsec_${i}" style="display:${t.hasLab ? '' : 'none'};margin-top:12px">
            <div class="form-grid-3" style="align-items:end;margin-bottom:8px">
              <div class="form-group">
                <label style="font-size:11px">تكلفة المخبر</label>
                <div class="input-with-currency">
                  <input type="number" id="addlabcost_${i}" value="${t.labCost || 0}" placeholder="0" min="0"
                    oninput="addTreatments[${i}].labCost=Number(this.value);calcAddLabRem(${i})">
                  <div class="currency-select-wrap">
                    <select id="addlabcur_${i}" onchange="addTreatments[${i}].labCurrency=this.value">
                      <option value="SYP" ${(t.labCurrency||'SYP')==='SYP'?'selected':''}>ل.س</option>
                      <option value="USD" ${t.labCurrency==='USD'?'selected':''}>USD $</option>
                      <option value="EUR" ${t.labCurrency==='EUR'?'selected':''}>EUR €</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label style="font-size:11px">المسدَّد للمخبر</label>
                <input type="number" id="addlabpaid_${i}" value="${t.labPaid || 0}" placeholder="0" min="0"
                  oninput="addTreatments[${i}].labPaid=Number(this.value);calcAddLabRem(${i})">
              </div>
              <div class="form-group">
                <label style="font-size:11px">المتبقي للمخبر</label>
                <input type="number" id="addlabrem_${i}" value="${t.labRemaining || 0}" placeholder="0" readonly
                  style="background:var(--surface2);color:var(--warning);font-weight:700">
              </div>
            </div>
            <div class="form-group">
              <label style="font-size:11px">تفاصيل المخبر (اختياري)</label>
              <input type="text" id="addlabdetails_${i}" value="${t.labDetails || ''}" placeholder="اسم المخبر، نوع العمل..."
                oninput="addTreatments[${i}].labDetails=this.value"
                style="font-size:12px">
            </div>
          </div>
        </div>

      </div>`;
        });

        // Re-attach outside-click after render
        addTreatments.forEach((t, i) => {
          const uid = "add_tooth_" + i;
          renderAddToothList(uid, i, "");
        });
      }

      function calcAddTreatmentRem(i) {
        const cost = Number(addTreatments[i].cost) || 0;
        const paid = Number(addTreatments[i].paid) || 0;
        const rem = Math.max(0, cost - paid);
        addTreatments[i].remaining = rem;
        const el = document.getElementById("addrem_" + i);
        if (el) el.value = rem;
      }

      function renderAddToothList(uid, idx, filter) {
        const list = document.getElementById("list_" + uid);
        if (!list) return;
        const q = (filter || "").toLowerCase().trim();
        let html = "";
        let hasResults = false;

        teethData.forEach((group) => {
          const filtered = group.teeth.filter(
            (t) => !q || t.name.includes(q) || t.num.includes(q),
          );
          if (!filtered.length) return;
          hasResults = true;
          html += `<div style="padding:4px 8px 2px;font-size:10px;font-weight:700;color:var(--primary);background:var(--accent-soft);border-radius:4px;margin:2px 3px;">${group.group}</div>`;
          filtered.forEach((t) => {
            html += `<div onclick="selectAddTooth('${uid}', ${idx}, '${t.num} - ${t.name}')"
        style="padding:7px 10px;font-size:12px;color:var(--text);cursor:pointer;border-radius:5px;margin:1px 3px;display:flex;align-items:center;gap:7px"
        onmouseover="this.style.background='var(--accent-soft)'" onmouseout="this.style.background=''"
      ><span style="background:var(--primary);color:#fff;border-radius:3px;padding:1px 5px;font-size:10px;font-weight:700;min-width:24px;text-align:center;flex-shrink:0">${t.num}</span><span>${t.name}</span></div>`;
          });
        });

        if (customTeethOptions.length) {
          const filteredC = customTeethOptions.filter(
            (t) => !q || t.toLowerCase().includes(q),
          );
          if (filteredC.length) {
            html += `<div style="padding:4px 8px 2px;font-size:10px;font-weight:700;color:var(--primary);background:var(--accent-soft);border-radius:4px;margin:2px 3px;">مخصص</div>`;
            filteredC.forEach((t) => {
              html += `<div onclick="selectAddTooth('${uid}', ${idx}, '${t}')"
          style="padding:7px 10px;font-size:12px;color:var(--text);cursor:pointer;border-radius:5px;margin:1px 3px;display:flex;align-items:center;gap:7px"
          onmouseover="this.style.background='var(--accent-soft)'" onmouseout="this.style.background=''"
        ><span style="background:var(--accent);color:#fff;border-radius:3px;padding:1px 5px;font-size:10px;font-weight:700">✦</span><span>${t}</span></div>`;
            });
            hasResults = true;
          }
        }

        if (!hasResults) {
          html =
            '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px">لا توجد نتائج</div>';
        }
        list.innerHTML = html;
      }

      function selectAddTooth(uid, idx, val) {
        addTreatments[idx].tooth = val;
        const inp = document.getElementById("inp_" + uid);
        if (inp) inp.value = val;
        closeAddToothDD(uid);
      }

      function openAddToothDD(uid, idx) {
        const dd = document.getElementById("dd_" + uid);
        if (dd) {
          dd.style.display = "block";
          renderAddToothList(
            uid,
            idx,
            document.getElementById("inp_" + uid).value,
          );
        }
      }

      function closeAddToothDD(uid) {
        const dd = document.getElementById("dd_" + uid);
        if (dd) dd.style.display = "none";
      }

      function toggleAddToothDD(uid, idx) {
        const dd = document.getElementById("dd_" + uid);
        if (!dd) return;
        if (dd.style.display === "block") closeAddToothDD(uid);
        else openAddToothDD(uid, idx);
      }

      function filterAddToothDD(uid, idx) {
        const srch = document.getElementById("srch_" + uid);
        const inp = document.getElementById("inp_" + uid);
        const q = srch ? srch.value : inp ? inp.value : "";
        renderAddToothList(uid, idx, q);
        openAddToothDD(uid, idx);
      }

      function addCustomAddTooth(uid, idx) {
        const inp = document.getElementById("cust_" + uid);
        const val = (inp ? inp.value : "").trim();
        if (!val) return;
        if (!customTeethOptions.includes(val)) customTeethOptions.push(val);
        selectAddTooth(uid, idx, val);
        if (inp) inp.value = "";
      }

      // Close add-patient tooth dropdowns on outside click
      document.addEventListener("click", function (e) {
        addTreatments.forEach((t, i) => {
          const uid = "add_tooth_" + i;
          const wrap = document.getElementById("wrap_" + uid);
          if (wrap && !wrap.contains(e.target)) closeAddToothDD(uid);
        });
      });

      function calcRemaining() {
        const t = Number(document.getElementById("p-total").value) || 0;
        const p = Number(document.getElementById("p-paid").value) || 0;
        document.getElementById("p-remaining").value = Math.max(0, t - p);
      }

      function handleXrayUpload(input, ctx) {
        Array.from(input.files).forEach((file) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (ctx === "add") {
              addXrays.push(e.target.result);
              renderAddXrays();
            } else {
              editXrays.push(e.target.result);
              renderEditXrays();
            }
          };
          reader.readAsDataURL(file);
        });
      }

      function handleDrop(e, ctx) {
        e.preventDefault();
        document.getElementById("upload-zone-add").classList.remove("dragover");
        Array.from(e.dataTransfer.files).forEach((file) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            addXrays.push(ev.target.result);
            renderAddXrays();
          };
          reader.readAsDataURL(file);
        });
      }

      function renderAddXrays() {
        const el = document.getElementById("xray-preview-add");
        el.innerHTML = addXrays
          .map(
            (src, i) => `
    <div class="xray-item" onclick="openLightbox('${src}')">
      <img src="${src}">
      <button class="xray-remove" onclick="event.stopPropagation();addXrays.splice(${i},1);renderAddXrays()">✕</button>
    </div>`,
          )
          .join("");
      }

      function renderEditXrays() {
        const el = document.getElementById("xray-preview-edit");
        el.innerHTML = editXrays
          .map(
            (src, i) => `
    <div class="xray-item" onclick="openLightbox('${src}')">
      <img src="${src}">
      <button class="xray-remove" onclick="event.stopPropagation();editXrays.splice(${i},1);renderEditXrays()">✕</button>
    </div>`,
          )
          .join("");
      }

      function savePatient() {
        const fn = document.getElementById("p-firstname").value.trim();
        const fa = document.getElementById("p-fathername").value.trim();
        const ph = document.getElementById("p-phone").value.trim();
        if (!fn || !fa || !ph) {
          toast(
            "يرجى ملء الحقول الإلزامية (الاسم، اسم الأب، الهاتف)",
            "danger",
          );
          return;
        }
        const currency = document.getElementById("p-currency").value;
        const patient = {
          id: Date.now(),
          firstname: fn,
          fathername: fa,
          lastname: document.getElementById("p-lastname").value.trim(),
          gender: document.getElementById("p-gender").value,
          age: document.getElementById("p-age").value,
          phone: ph,
          address: document.getElementById("p-address").value.trim(),
          notes: document.getElementById("p-notes").value.trim(),
          healthStatus: document.getElementById("p-health-status").value,
          disease: document.getElementById("p-disease").value,
          surgery: document.getElementById("p-surgery").value,
          diseaseNotes: document.getElementById("p-disease-notes").value.trim(),
          treatments: addTreatments
            .filter((t) => t.name)
            .map((t) => ({
              ...t,
              cost: Number(t.cost) || 0,
              paid: Number(t.paid) || 0,
              remaining: Math.max(
                0,
                (Number(t.cost) || 0) - (Number(t.paid) || 0),
              ),
            })),
          total: Number(document.getElementById("p-total").value) || 0,
          paid: Number(document.getElementById("p-paid").value) || 0,
          remaining: Number(document.getElementById("p-remaining").value) || 0,
          currency,
          payments: [],
          xrays: [...addXrays],
          createdAt: new Date().toLocaleDateString("ar-SY"),
        };
        patients.push(patient);
        saveState();
        toast("تم حفظ المريض بنجاح ✅");
        resetAddForm();
        showDetail(patients.length - 1);
      }

      function resetAddForm() {
        [
          "p-firstname",
          "p-fathername",
          "p-lastname",
          "p-age",
          "p-phone",
          "p-address",
          "p-notes",
          "p-total",
          "p-paid",
          "p-remaining",
        ].forEach((id) => (document.getElementById(id).value = ""));
        document.getElementById("p-gender").value = "";
        document.getElementById("p-currency").value = "SYP";
        document.getElementById("p-health-status").value = "healthy";
        document.getElementById("p-disease").value = "";
        document.getElementById("p-surgery").value = "no";
        document.getElementById("p-disease-notes").value = "";
        toggleHealthFields('add');
        addTreatments = [];
        addXrays = [];
        renderAddTreatments();
        renderAddXrays();
      }

      // ===========================
      // DELETE
      // ===========================
      function deletePatient(idx) {
        if (!confirm(`هل أنت متأكد من حذف سجل ${fullName(patients[idx])}؟`))
          return;
        patients.splice(idx, 1);
        saveState();
        renderPatientsList();
        toast("تم الحذف", "danger");
      }

      // ===========================
      // PATIENT DETAIL
      // ===========================
      function showDetail(idx) {
        currentPatientIndex = idx;
        const p = patients[idx];
        // Always recalc before displaying to fix any legacy data
        recalcPatientTotals(p);

        const cur = p.currency || "SYP";
        const isFemale = p.gender === "female";
        const currencyTotals = p.currencyTotals || {};
        const currencies = Object.keys(currencyTotals);

        // Build financial summary — per currency
        let financialSummaryHtml = "";
        if (currencies.length === 0) {
          financialSummaryHtml = `
      <div class="payment-summary">
        <div class="payment-box total"><div class="amount">0</div><div class="label">إجمالي التكلفة</div></div>
        <div class="payment-box paid"><div class="amount">0</div><div class="label">المدفوع</div></div>
        <div class="payment-box remaining"><div class="amount">0</div><div class="label">المتبقي</div></div>
      </div>`;
        } else if (currencies.length === 1) {
          const onlyCur = currencies[0];
          const b = currencyTotals[onlyCur];
          const pct = b.total
            ? Math.min(100, Math.round((b.paid / b.total) * 100))
            : 0;
          financialSummaryHtml = `
      <div class="payment-summary">
        <div class="payment-box total">
          <div class="amount">${b.total.toLocaleString()}</div>
          <div class="label">إجمالي التكلفة</div>
          <div class="currency-badge">${currencyLabel(onlyCur)}</div>
        </div>
        <div class="payment-box paid">
          <div class="amount">${b.paid.toLocaleString()}</div>
          <div class="label">المدفوع</div>
          <div class="currency-badge">${currencyLabel(onlyCur)}</div>
        </div>
        <div class="payment-box remaining">
          <div class="amount">${b.remaining.toLocaleString()}</div>
          <div class="label">المتبقي</div>
          <div class="currency-badge">${currencyLabel(onlyCur)}</div>
        </div>
      </div>
      <div style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:4px"><span>نسبة السداد</span><span>${pct}%</span></div>
        <div class="payment-bar"><div class="payment-fill" style="width:${pct}%"></div></div>
      </div>`;
        } else {
          // Multiple currencies — show each separately
          financialSummaryHtml =
            '<div style="display:flex;flex-direction:column;gap:12px;">';
          currencies.forEach((c) => {
            const b = currencyTotals[c];
            const pct = b.total
              ? Math.min(100, Math.round((b.paid / b.total) * 100))
              : 0;
            const remColor =
              b.remaining > 0 ? "var(--danger)" : "var(--success)";
            financialSummaryHtml += `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px">
          <div style="font-size:11px;font-weight:700;color:var(--primary);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border)">
            💱 عملة: ${currencyLabel(c)}
          </div>
          <div class="payment-summary" style="margin-top:0">
            <div class="payment-box total" style="padding:8px">
              <div class="amount" style="font-size:15px">${b.total.toLocaleString()}</div>
              <div class="label">التكلفة</div>
            </div>
            <div class="payment-box paid" style="padding:8px">
              <div class="amount" style="font-size:15px">${b.paid.toLocaleString()}</div>
              <div class="label">المدفوع</div>
            </div>
            <div class="payment-box remaining" style="padding:8px">
              <div class="amount" style="font-size:15px;color:${remColor}">${b.remaining.toLocaleString()}</div>
              <div class="label">المتبقي</div>
            </div>
          </div>
          <div style="margin-top:8px">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:3px"><span>السداد</span><span>${pct}%</span></div>
            <div class="payment-bar" style="height:6px"><div class="payment-fill" style="width:${pct}%"></div></div>
          </div>
        </div>`;
          });
          financialSummaryHtml += "</div>";
        }

        // Overall remaining check for badge
        const hasAnyRemaining =
          p.hasRemaining ||
          currencies.some((c) => currencyTotals[c].remaining > 0);

        const xraysHtml = (p.xrays || []).length
          ? `
    <div class="xray-grid">
      ${p.xrays
        .map(
          (src, i) => `
        <div class="xray-item" onclick="openLightbox('${src}')">
          <img src="${src}" alt="صورة شعاعية ${i + 1}">
        </div>`,
        )
        .join("")}
    </div>`
          : '<div class="empty-state"><div class="icon">🩻</div><p>لا توجد صور شعاعية</p></div>';

        const treatmentsHtml = (p.treatments || []).length
          ? p.treatments
              .map(
                (t, tidx) => {
                  const tPayments = (p.payments || []).filter(py => String(py.treatmentId) === String(t.id));
                  const tPaymentsHtml = tPayments.length
                    ? `<div style="margin-top:8px;padding-top:6px;border-top:1px dashed var(--border)">
                        <div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:4px">💳 دفعات هذه المعالجة:</div>
                        ${tPayments.map(py => `<div style="font-size:11px;color:var(--success);display:flex;gap:8px;align-items:center;margin-bottom:2px">
                          <span>✅ ${Number(py.amount).toLocaleString()} ${currencyLabel(py.currency)}</span>
                          <span style="color:var(--text-muted)">${py.date}</span>
                          ${py.note ? `<span style="color:var(--text-muted)">— ${py.note}</span>` : ''}
                        </div>`).join('')}
                      </div>`
                    : '';
                  const labHtml = t.hasLab
                    ? `<div style="margin-top:8px;padding:8px 10px;background:var(--warning-soft);border:1px solid var(--warning);border-radius:6px;font-size:11px">
                        <div style="font-weight:700;color:var(--warning);margin-bottom:6px;display:flex;align-items:center;justify-content:space-between">
                          <span>🔬 تكلفة مخبرية</span>
                          ${t.labRemaining > 0 ? `<button onclick="openLabPaymentModal(${tidx})" class="btn btn-warning btn-sm" style="font-size:10px;padding:3px 10px">💳 سداد</button>` : ''}
                        </div>
                        <div style="display:flex;gap:10px;flex-wrap:wrap">
                          <span>إجمالي: <strong>${(t.labCost||0).toLocaleString()} ${currencyLabel(t.labCurrency)}</strong></span>
                          <span style="color:var(--success)">مسدَّد: <strong>${(t.labPaid||0).toLocaleString()}</strong></span>
                          ${t.labRemaining > 0 ? `<span style="color:var(--danger)">متبقي: <strong>${t.labRemaining.toLocaleString()}</strong></span>` : '<span style="color:var(--success)">✅ مسدَّد بالكامل</span>'}
                        </div>
                        ${(t.labPayments||[]).length ? `<div style="margin-top:6px;padding-top:5px;border-top:1px dashed var(--border)"><div style="font-size:10px;color:var(--text-muted);margin-bottom:3px">دفعات المخبر:</div>${(t.labPayments||[]).map(lp=>`<div style="font-size:10px;color:var(--success)">✅ ${Number(lp.amount).toLocaleString()} ${currencyLabel(lp.currency)} — ${lp.date}${lp.note?' — '+lp.note:''}</div>`).join('')}</div>` : ''}
                        ${t.labDetails ? `<div style="margin-top:4px;color:var(--text-muted)">${t.labDetails}</div>` : ''}
                      </div>`
                    : '';
                  return `
    <div class="treatment-item">
      <div class="treatment-dot"></div>
      <div class="treatment-info" style="flex:1">
        <div class="treatment-name">${t.name}</div>
        <div class="treatment-date">${t.tooth ? "🦷 " + t.tooth + " — " : ""}${t.date || "بدون تاريخ"}</div>
        ${
          t.cost
            ? `<div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
          <span style="font-size:11px;background:var(--accent-soft);color:var(--primary);padding:2px 8px;border-radius:999px;font-weight:600">💰 ${formatAmount(t.cost, t.currency || cur)}</span>
          ${t.paid ? `<span style="font-size:11px;background:var(--success-soft);color:var(--success);padding:2px 8px;border-radius:999px;font-weight:600">✅ مسدَّد: ${formatAmount(t.paid, t.currency || cur)}</span>` : ""}
          ${t.remaining > 0 ? `<span style="font-size:11px;background:var(--danger-soft);color:var(--danger);padding:2px 8px;border-radius:999px;font-weight:600">⏳ متبقي: ${formatAmount(t.remaining, t.currency || cur)}</span>` : ""}
        </div>`
            : ""
        }
        ${t.notes ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">📝 ${t.notes}</div>` : ""}
        ${labHtml}
        ${tPaymentsHtml}
      </div>
    </div>`;}
              )
              .join("")
          : '<div class="empty-state"><div class="icon">🦷</div><p>لا توجد معالجات مسجلة</p></div>';

        const paymentsHtml = (p.payments || []).length
          ? `
    <table><thead><tr><th>المبلغ</th><th>العملة</th><th>المعالجة</th><th>التاريخ</th><th>ملاحظة</th></tr></thead>
    <tbody>${p.payments.map((py) => {
      const linkedT = py.treatmentId ? (p.treatments||[]).find(t=>String(t.id)===String(py.treatmentId)) : null;
      const tName = linkedT ? `<span style="font-size:11px;background:var(--accent-soft);color:var(--primary);padding:1px 6px;border-radius:4px">${linkedT.name}</span>` : `<span style="color:var(--text-muted);font-size:11px">—</span>`;
      return `<tr><td style="font-weight:700;color:var(--success)">${Number(py.amount).toLocaleString()}</td><td><span class="badge badge-info">${currencyLabel(py.currency || cur)}</span></td><td>${tName}</td><td>${py.date}</td><td>${py.note || "-"}</td></tr>`;
    }).join("")}</tbody>
    </table>`
          : '<div class="empty-state"><div class="icon">💳</div><p>لا توجد دفعات مسجلة</p></div>';

        document.getElementById("patient-detail-content").innerHTML = `
    <div class="patient-header">
      <div class="patient-header-avatar ${isFemale ? "female" : ""}">${getInitials(p)}</div>
      <div class="patient-header-info" style="flex:1">
        <h2>${fullName(p)}</h2>
        <p>📱 ${escapeHtml(p.phone || "-")} &nbsp;|&nbsp; 📍 ${escapeHtml(p.address || "-")} &nbsp;|&nbsp; 🎂 ${escapeHtml(String(p.age || "-"))} سنة</p>
        <div class="patient-header-badges">
          <span class="patient-header-badge ${isFemale ? "female" : ""}">${genderLabel(p.gender)}</span>
          <span class="patient-header-badge">📅 ${p.createdAt || "-"}</span>
          <span class="patient-header-badge">${(p.treatments || []).length} معالجة</span>
          ${hasAnyRemaining ? `<span class="patient-header-badge" style="background:rgba(229,62,62,0.2);color:#fc5a5a">⏳ متبقي</span>` : '<span class="patient-header-badge">✅ مسدد بالكامل</span>'}
          ${p.healthStatus === 'sick' ? `<span class="patient-header-badge" style="background:rgba(246,201,14,0.25);color:#f6c90e">🏥 ${diseaseLabelMap[p.disease] || 'مريض'}</span>` : '<span class="patient-header-badge" style="background:rgba(72,187,120,0.2);color:#48bb78">✅ سليم</span>'}
          ${p.surgery === 'yes' ? `<span class="patient-header-badge" style="background:rgba(229,62,62,0.2);color:#fc5a5a">⚕️ عمليات جراحية سابقة</span>` : ''}
          ${(()=>{
            const labTs = (p.treatments||[]).filter(t=>t.hasLab);
            if (!labTs.length) return '';
            const hasLabRem = labTs.some(t=>(t.labRemaining||0)>0);
            return hasLabRem
              ? `<span class="patient-header-badge" style="background:rgba(214,158,46,0.25);color:#f6c90e">🔬 متبقي مخبر</span>`
              : `<span class="patient-header-badge" style="background:rgba(72,187,120,0.2);color:#48bb78">🔬 مخبر مسدَّد</span>`;
          })()}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-dental-chart" onclick="openDentalChart(${idx})">🦷 خريطة الأسنان</button>
        <button class="btn btn-accent btn-sm" onclick="openEditModal(${idx})">✏️ تعديل</button>
        <button class="btn btn-outline btn-sm" style="color:#fff;border-color:rgba(255,255,255,0.3)" onclick="exportSingleExcel(${idx})">📊 Excel</button>
        <button class="btn btn-outline btn-sm" style="color:#fff;border-color:rgba(255,255,255,0.3)" onclick="exportJSON(${idx})">💾 حفظ</button>
      </div>
    </div>

    ${p.notes ? `<div class="alert alert-info" style="margin-bottom:18px">📝 <strong>ملاحظة:</strong> ${escapeHtml(p.notes)}</div>` : ""}
    ${p.healthStatus === 'sick' && p.diseaseNotes ? `<div class="alert alert-warning" style="margin-bottom:18px">🏥 <strong>الحالة الصحية:</strong> ${escapeHtml(p.diseaseNotes)}</div>` : ""}

    <div class="detail-grid">
      <div class="card">
        <div class="card-header">
          <div><div class="card-title">🦷 المعالجات السنية</div></div>
          <button class="btn btn-accent btn-sm" onclick="openModal('modal-treatment')">➕</button>
        </div>
        ${treatmentsHtml}
      </div>

      <div class="card">
        <div class="card-header">
          <div><div class="card-title">💰 الوضع المالي</div></div>
          <button class="btn btn-success btn-sm" onclick="openModal('modal-payment')">💳 دفعة</button>
        </div>
        ${financialSummaryHtml}
        ${(()=>{
          // Build lab summary
          const labTreatments = (p.treatments||[]).filter(t=>t.hasLab);
          if (!labTreatments.length) return '';
          const labByCur = {};
          labTreatments.forEach(t=>{
            const c = t.labCurrency||'SYP';
            if(!labByCur[c]) labByCur[c]={total:0,paid:0,remaining:0};
            labByCur[c].total += Number(t.labCost)||0;
            labByCur[c].paid += Number(t.labPaid)||0;
            labByCur[c].remaining += Math.max(0,(Number(t.labCost)||0)-(Number(t.labPaid)||0));
          });
          const hasLabRem = Object.values(labByCur).some(b=>b.remaining>0);
          let html = `<div style="margin-top:14px;padding:12px;background:var(--warning-soft);border:1px solid var(--warning);border-radius:var(--radius-sm)">
            <div style="font-size:12px;font-weight:700;color:var(--warning);margin-bottom:10px;display:flex;align-items:center;gap:6px">🔬 الوضع المالي — المخبر ${hasLabRem ? '<span style="background:var(--danger);color:#fff;padding:1px 8px;border-radius:999px;font-size:10px">متبقي</span>' : '<span style="background:var(--success);color:#fff;padding:1px 8px;border-radius:999px;font-size:10px">✅ مسدد</span>'}</div>`;
          Object.entries(labByCur).forEach(([c,b])=>{
            const pct = b.total ? Math.min(100,Math.round((b.paid/b.total)*100)) : 100;
            html += `<div style="margin-bottom:8px">
              <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:11px;margin-bottom:5px">
                <span style="font-weight:600">إجمالي: ${b.total.toLocaleString()} ${currencyLabel(c)}</span>
                <span style="color:var(--success)">مسدَّد: ${b.paid.toLocaleString()}</span>
                ${b.remaining>0?`<span style="color:var(--danger);font-weight:700">متبقي: ${b.remaining.toLocaleString()}</span>`:'<span style="color:var(--success)">✅ مسدَّد بالكامل</span>'}
              </div>
              <div style="background:rgba(0,0,0,0.1);border-radius:999px;height:5px;overflow:hidden"><div style="height:100%;border-radius:999px;background:var(--warning);width:${pct}%"></div></div>
            </div>`;
          });
          html += '</div>';
          return html;
        })()}
        <div class="section-divider" style="margin:12px 0 10px">سجل الدفعات</div>
        ${paymentsHtml}
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <div class="card-header">
        <div><div class="card-title">🩻 الصور الشعاعية</div></div>
        <button class="btn btn-outline btn-sm" onclick="openEditModal(${idx})">➕ إضافة صور</button>
      </div>
      ${xraysHtml}
    </div>`;

        showPage("patient-detail");
      }

      // ===========================
      // EDIT MODAL
      // ===========================
      let editTreatments = [];
      let editingIdx = null;

      function openEditModal(idx) {
        editingIdx = idx;
        const p = patients[idx];
        document.getElementById("e-firstname").value = p.firstname || "";
        document.getElementById("e-fathername").value = p.fathername || "";
        document.getElementById("e-lastname").value = p.lastname || "";
        document.getElementById("e-gender").value = p.gender || "";
        document.getElementById("e-age").value = p.age || "";
        document.getElementById("e-phone").value = p.phone || "";
        document.getElementById("e-address").value = p.address || "";
        document.getElementById("e-notes").value = p.notes || "";
        document.getElementById("e-health-status").value = p.healthStatus || "healthy";
        document.getElementById("e-disease").value = p.disease || "";
        document.getElementById("e-surgery").value = p.surgery || "no";
        document.getElementById("e-disease-notes").value = p.diseaseNotes || "";
        toggleHealthFields('edit');
        document.getElementById("e-total").value = p.total || 0;
        document.getElementById("e-paid").value = p.paid || 0;
        document.getElementById("e-remaining").value = p.remaining || 0;
        document.getElementById("e-currency").value = p.currency || "SYP";
        editTreatments = JSON.parse(JSON.stringify(p.treatments || []));
        editXrays = [...(p.xrays || [])];
        renderEditTreatments();
        renderEditXrays();
        openModal("modal-edit");
      }

      function renderEditTreatments() {
        const el = document.getElementById("edit-treatments-list");
        el.innerHTML = editTreatments
          .map((t, i) => {
            const uid = "edit_tooth_" + i;
            return `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;margin-bottom:10px">

      <!-- Row 1 -->
      <div class="form-grid-3" style="margin-bottom:12px;align-items:end">
        <div class="form-group">
          <label>نوع المعالجة</label>
          <input type="text" value="${t.name || ""}" placeholder="حشو، خلع..." oninput="editTreatments[${i}].name=this.value">
        </div>

        <!-- السن - قائمة منسدلة -->
        <div class="form-group">
          <label>السن المعالج</label>
          <div style="position:relative" id="wrap_${uid}">
            <div style="display:flex;border:1.5px solid var(--border);border-radius:var(--radius-sm);background:var(--surface2)">
              <button type="button"
                onclick="toggleEditToothDD('${uid}', ${i})"
                style="padding:0 11px;background:var(--accent-soft);border:none;border-left:1.5px solid var(--border);cursor:pointer;color:var(--primary);font-size:15px;border-radius:0 var(--radius-sm) var(--radius-sm) 0;display:flex;align-items:center;flex-shrink:0">▾</button>
              <input type="text" id="inp_${uid}"
                value="${t.tooth || ""}"
                placeholder="اكتب أو اختر السن..."
                oninput="editTreatments[${i}].tooth=this.value; filterEditToothDD('${uid}', ${i})"
                onfocus="openEditToothDD('${uid}', ${i})"
                autocomplete="off"
                style="flex:1;border:none;background:transparent;padding:9px 10px;font-family:inherit;font-size:13px;color:var(--text);outline:none;min-width:0">
            </div>
            <div id="dd_${uid}"
              style="display:none;position:absolute;top:calc(100% + 3px);left:0;right:0;background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow-lg);z-index:300;max-height:280px;overflow:hidden;direction:rtl">
              <div style="padding:7px 8px;border-bottom:1px solid var(--border);background:var(--surface2)">
                <input type="text" id="srch_${uid}"
                  placeholder="🔍 ابحث عن سن..."
                  oninput="filterEditToothDD('${uid}', ${i})"
                  style="width:100%;padding:6px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px;font-family:inherit;color:var(--text);background:var(--surface);outline:none">
              </div>
              <div id="list_${uid}" style="overflow-y:auto;max-height:170px;padding:3px"></div>
              <div style="padding:7px 8px;border-top:1px solid var(--border);background:var(--surface2);display:flex;gap:6px;align-items:center">
                <input type="text" id="cust_${uid}" placeholder="أضف خياراً مخصصاً..."
                  style="flex:1;padding:6px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px;font-family:inherit;color:var(--text);background:var(--surface);outline:none">
                <button type="button" onclick="addCustomEditTooth('${uid}', ${i})"
                  style="padding:6px 12px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap;font-family:inherit">➕ إضافة</button>
              </div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>التاريخ</label>
          <div style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center">
            <input type="date" value="${t.date || ""}" oninput="editTreatments[${i}].date=this.value">
            <button class="btn btn-danger btn-icon" onclick="editTreatments.splice(${i},1);renderEditTreatments()">✕</button>
          </div>
        </div>
      </div>

      <!-- Row 2: التكلفة + المسدَّد + المتبقي -->
      <div class="form-grid-3" style="align-items:end;margin-bottom:10px">
        <div class="form-group">
          <label>التكلفة</label>
          <div class="input-with-currency">
            <input type="number" value="${t.cost || 0}" placeholder="0" min="0"
              oninput="editTreatments[${i}].cost=Number(this.value);calcEditTreatmentRem(${i})">
            <div class="currency-select-wrap">
              <select onchange="editTreatments[${i}].currency=this.value">
                <option value="SYP" ${(t.currency || "SYP") === "SYP" ? "selected" : ""}>ل.س</option>
                <option value="USD" ${t.currency === "USD" ? "selected" : ""}>USD $</option>
                <option value="EUR" ${t.currency === "EUR" ? "selected" : ""}>EUR €</option>
              </select>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>المسدَّد</label>
          <input type="number" value="${t.paid || 0}" placeholder="0" min="0"
            oninput="editTreatments[${i}].paid=Number(this.value);calcEditTreatmentRem(${i})">
        </div>
        <div class="form-group">
          <label>المتبقي</label>
          <input type="number" id="editrem_${i}" value="${t.remaining || 0}" placeholder="0" readonly
            style="background:var(--surface2);color:var(--danger);font-weight:700">
        </div>
      </div>

      <!-- Row 3: تكلفة مخبرية -->
      <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-top:2px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0">
          <div style="font-size:12px;font-weight:700;color:var(--primary);display:flex;align-items:center;gap:6px">🔬 تكلفة مخبرية</div>
          <select id="edithaslab_${i}" onchange="toggleEditLabSection(${i})"
            style="font-size:12px;padding:4px 10px;border:1.5px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--text);font-family:inherit;cursor:pointer">
            <option value="no" ${!t.hasLab ? 'selected' : ''}>لا</option>
            <option value="yes" ${t.hasLab ? 'selected' : ''}>نعم</option>
          </select>
        </div>
        <div id="editlabsec_${i}" style="display:${t.hasLab ? '' : 'none'};margin-top:12px">
          <div class="form-grid-3" style="align-items:end;margin-bottom:8px">
            <div class="form-group">
              <label style="font-size:11px">تكلفة المخبر</label>
              <div class="input-with-currency">
                <input type="number" id="editlabcost_${i}" value="${t.labCost || 0}" placeholder="0" min="0"
                  oninput="editTreatments[${i}].labCost=Number(this.value);calcEditLabRem(${i})">
                <div class="currency-select-wrap">
                  <select id="editlabcur_${i}" onchange="editTreatments[${i}].labCurrency=this.value">
                    <option value="SYP" ${(t.labCurrency||'SYP')==='SYP'?'selected':''}>ل.س</option>
                    <option value="USD" ${t.labCurrency==='USD'?'selected':''}>USD $</option>
                    <option value="EUR" ${t.labCurrency==='EUR'?'selected':''}>EUR €</option>
                  </select>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label style="font-size:11px">المسدَّد للمخبر</label>
              <input type="number" id="editlabpaid_${i}" value="${t.labPaid || 0}" placeholder="0" min="0"
                oninput="editTreatments[${i}].labPaid=Number(this.value);calcEditLabRem(${i})">
            </div>
            <div class="form-group">
              <label style="font-size:11px">المتبقي للمخبر</label>
              <input type="number" id="editlabrem_${i}" value="${t.labRemaining || 0}" placeholder="0" readonly
                style="background:var(--surface2);color:var(--warning);font-weight:700">
            </div>
          </div>
          <div class="form-group">
            <label style="font-size:11px">تفاصيل المخبر (اختياري)</label>
            <input type="text" id="editlabdetails_${i}" value="${t.labDetails || ''}" placeholder="اسم المخبر، نوع العمل..."
              oninput="editTreatments[${i}].labDetails=this.value"
              style="font-size:12px">
          </div>
        </div>
      </div>

    </div>`;
          })
          .join("");

        // render tooth lists after DOM update
        editTreatments.forEach((t, i) => {
          const uid = "edit_tooth_" + i;
          renderEditToothList(uid, i, "");
        });
      }

      function addEditTreatmentRow() {
        const today = new Date().toISOString().split("T")[0];
        editTreatments.push({
          name: "",
          date: today,
          tooth: "",
          cost: 0,
          paid: 0,
          remaining: 0,
          currency: "SYP",
          hasLab: false,
          labCost: 0,
          labPaid: 0,
          labRemaining: 0,
          labCurrency: "SYP",
          labDetails: "",
        });
        renderEditTreatments();
      }

      function toggleEditLabSection(i) {
        const val = document.getElementById("edithaslab_" + i).value === "yes";
        editTreatments[i].hasLab = val;
        document.getElementById("editlabsec_" + i).style.display = val ? "" : "none";
      }

      function calcEditLabRem(i) {
        const cost = Number(editTreatments[i].labCost) || 0;
        const paid = Number(editTreatments[i].labPaid) || 0;
        const rem = Math.max(0, cost - paid);
        editTreatments[i].labRemaining = rem;
        const el = document.getElementById("editlabrem_" + i);
        if (el) el.value = rem;
      }

      function calcEditTreatmentRem(i) {
        const cost = Number(editTreatments[i].cost) || 0;
        const paid = Number(editTreatments[i].paid) || 0;
        const rem = Math.max(0, cost - paid);
        editTreatments[i].remaining = rem;
        const el = document.getElementById("editrem_" + i);
        if (el) el.value = rem;
      }

      function renderEditToothList(uid, idx, filter) {
        const list = document.getElementById("list_" + uid);
        if (!list) return;
        const q = (filter || "").toLowerCase().trim();
        let html = "";
        let hasResults = false;
        teethData.forEach((group) => {
          const filtered = group.teeth.filter(
            (t) => !q || t.name.includes(q) || t.num.includes(q),
          );
          if (!filtered.length) return;
          hasResults = true;
          html += `<div style="padding:4px 8px 2px;font-size:10px;font-weight:700;color:var(--primary);background:var(--accent-soft);border-radius:4px;margin:2px 3px;">${group.group}</div>`;
          filtered.forEach((t) => {
            html += `<div onclick="selectEditTooth('${uid}', ${idx}, '${t.num} - ${t.name}')"
        style="padding:7px 10px;font-size:12px;color:var(--text);cursor:pointer;border-radius:5px;margin:1px 3px;display:flex;align-items:center;gap:7px"
        onmouseover="this.style.background='var(--accent-soft)'" onmouseout="this.style.background=''"
      ><span style="background:var(--primary);color:#fff;border-radius:3px;padding:1px 5px;font-size:10px;font-weight:700;min-width:24px;text-align:center;flex-shrink:0">${t.num}</span><span>${t.name}</span></div>`;
          });
        });
        if (customTeethOptions.length) {
          const filteredC = customTeethOptions.filter(
            (t) => !q || t.toLowerCase().includes(q),
          );
          if (filteredC.length) {
            html += `<div style="padding:4px 8px 2px;font-size:10px;font-weight:700;color:var(--primary);background:var(--accent-soft);border-radius:4px;margin:2px 3px;">مخصص</div>`;
            filteredC.forEach((t) => {
              html += `<div onclick="selectEditTooth('${uid}', ${idx}, '${t}')"
          style="padding:7px 10px;font-size:12px;color:var(--text);cursor:pointer;border-radius:5px;margin:1px 3px;display:flex;align-items:center;gap:7px"
          onmouseover="this.style.background='var(--accent-soft)'" onmouseout="this.style.background=''"
        ><span style="background:var(--accent);color:#fff;border-radius:3px;padding:1px 5px;font-size:10px;font-weight:700">✦</span><span>${t}</span></div>`;
            });
            hasResults = true;
          }
        }
        if (!hasResults)
          html =
            '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px">لا توجد نتائج</div>';
        list.innerHTML = html;
      }

      function selectEditTooth(uid, idx, val) {
        editTreatments[idx].tooth = val;
        const inp = document.getElementById("inp_" + uid);
        if (inp) inp.value = val;
        closeEditToothDD(uid);
      }
      function openEditToothDD(uid, idx) {
        const dd = document.getElementById("dd_" + uid);
        if (dd) {
          dd.style.display = "block";
          renderEditToothList(
            uid,
            idx,
            document.getElementById("inp_" + uid).value,
          );
        }
      }
      function closeEditToothDD(uid) {
        const dd = document.getElementById("dd_" + uid);
        if (dd) dd.style.display = "none";
      }
      function toggleEditToothDD(uid, idx) {
        const dd = document.getElementById("dd_" + uid);
        if (!dd) return;
        if (dd.style.display === "block") closeEditToothDD(uid);
        else openEditToothDD(uid, idx);
      }
      function filterEditToothDD(uid, idx) {
        const srch = document.getElementById("srch_" + uid);
        const inp = document.getElementById("inp_" + uid);
        const q = srch ? srch.value : inp ? inp.value : "";
        renderEditToothList(uid, idx, q);
        openEditToothDD(uid, idx);
      }
      function addCustomEditTooth(uid, idx) {
        const inp = document.getElementById("cust_" + uid);
        const val = (inp ? inp.value : "").trim();
        if (!val) return;
        if (!customTeethOptions.includes(val)) customTeethOptions.push(val);
        selectEditTooth(uid, idx, val);
        if (inp) inp.value = "";
      }

      // Close edit tooth dropdowns on outside click
      document.addEventListener("click", function (e) {
        editTreatments.forEach((t, i) => {
          const uid = "edit_tooth_" + i;
          const wrap = document.getElementById("wrap_" + uid);
          if (wrap && !wrap.contains(e.target)) closeEditToothDD(uid);
        });
      });

      function editCalcRemaining() {
        const t = Number(document.getElementById("e-total").value) || 0;
        const p = Number(document.getElementById("e-paid").value) || 0;
        document.getElementById("e-remaining").value = Math.max(0, t - p);
      }

      function saveEditPatient() {
        const p = patients[editingIdx];
        p.firstname = document.getElementById("e-firstname").value;
        p.fathername = document.getElementById("e-fathername").value;
        p.lastname = document.getElementById("e-lastname").value;
        p.gender = document.getElementById("e-gender").value;
        p.age = document.getElementById("e-age").value;
        p.phone = document.getElementById("e-phone").value;
        p.address = document.getElementById("e-address").value;
        p.notes = document.getElementById("e-notes").value;
        p.healthStatus = document.getElementById("e-health-status").value;
        p.disease = document.getElementById("e-disease").value;
        p.surgery = document.getElementById("e-surgery").value;
        p.diseaseNotes = document.getElementById("e-disease-notes").value;
        p.total = Number(document.getElementById("e-total").value) || 0;
        p.paid = Number(document.getElementById("e-paid").value) || 0;
        p.remaining = Number(document.getElementById("e-remaining").value) || 0;
        p.currency = document.getElementById("e-currency").value;
        p.treatments = editTreatments;
        p.xrays = [...editXrays];
        // Recalculate totals from treatments (handles multiple currencies)
        recalcPatientTotals(p);
        saveState();
        closeModal("modal-edit");
        toast("تم حفظ التعديلات ✅");
        showDetail(editingIdx);
      }

      // ===========================
      // TREATMENT & PAYMENT
      // ===========================
      // ===========================
      // TOOTH DROPDOWN
      // ===========================
      const teethData = [
        {
          group: "الفك العلوي — الجانب الأيمن",
          teeth: [
            { num: "18", name: "ضرس العقل العلوي الأيمن" },
            { num: "17", name: "الضرس الثاني العلوي الأيمن" },
            { num: "16", name: "الضرس الأول العلوي الأيمن" },
            { num: "15", name: "الضاحك الثاني العلوي الأيمن" },
            { num: "14", name: "الضاحك الأول العلوي الأيمن" },
            { num: "13", name: "الناب العلوي الأيمن" },
            { num: "12", name: "الرباعية العلوية اليمنى" },
            { num: "11", name: "الثنية العلوية اليمنى" },
          ],
        },
        {
          group: "الفك العلوي — الجانب الأيسر",
          teeth: [
            { num: "21", name: "الثنية العلوية اليسرى" },
            { num: "22", name: "الرباعية العلوية اليسرى" },
            { num: "23", name: "الناب العلوي الأيسر" },
            { num: "24", name: "الضاحك الأول العلوي الأيسر" },
            { num: "25", name: "الضاحك الثاني العلوي الأيسر" },
            { num: "26", name: "الضرس الأول العلوي الأيسر" },
            { num: "27", name: "الضرس الثاني العلوي الأيسر" },
            { num: "28", name: "ضرس العقل العلوي الأيسر" },
          ],
        },
        {
          group: "الفك السفلي — الجانب الأيسر",
          teeth: [
            { num: "31", name: "الثنية السفلية اليسرى" },
            { num: "32", name: "الرباعية السفلية اليسرى" },
            { num: "33", name: "الناب السفلي الأيسر" },
            { num: "34", name: "الضاحك الأول السفلي الأيسر" },
            { num: "35", name: "الضاحك الثاني السفلي الأيسر" },
            { num: "36", name: "الضرس الأول السفلي الأيسر" },
            { num: "37", name: "الضرس الثاني السفلي الأيسر" },
            { num: "38", name: "ضرس العقل السفلي الأيسر" },
          ],
        },
        {
          group: "الفك السفلي — الجانب الأيمن",
          teeth: [
            { num: "48", name: "ضرس العقل السفلي الأيمن" },
            { num: "47", name: "الضرس الثاني السفلي الأيمن" },
            { num: "46", name: "الضرس الأول السفلي الأيمن" },
            { num: "45", name: "الضاحك الثاني السفلي الأيمن" },
            { num: "44", name: "الضاحك الأول السفلي الأيمن" },
            { num: "43", name: "الناب السفلي الأيمن" },
            { num: "42", name: "الرباعية السفلية اليمنى" },
            { num: "41", name: "الثنية السفلية اليمنى" },
          ],
        },
      ];
      let customTeethOptions = [];

      function renderTeethList(filter) {
        const list = document.getElementById("tooth-list");
        if (!list) return;
        const q = (filter || "").toLowerCase().trim();
        let html = "";
        let hasResults = false;

        teethData.forEach((group) => {
          const filtered = group.teeth.filter(
            (t) => !q || t.name.includes(q) || t.num.includes(q),
          );
          if (!filtered.length) return;
          hasResults = true;
          html += `<div style="padding:5px 10px 2px;font-size:10px;font-weight:700;color:var(--primary);background:var(--accent-soft);border-radius:4px;margin:3px 4px;">${group.group}</div>`;
          filtered.forEach((t) => {
            html += `<div onclick="selectToothOption('${t.num} - ${t.name}')"
        style="padding:8px 12px;font-size:13px;color:var(--text);cursor:pointer;border-radius:6px;margin:1px 4px;display:flex;align-items:center;gap:8px;transition:background 0.15s"
        onmouseover="this.style.background='var(--accent-soft)'" onmouseout="this.style.background=''"
      ><span style="background:var(--primary);color:#fff;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:700;min-width:28px;text-align:center;flex-shrink:0">${t.num}</span><span>${t.name}</span></div>`;
          });
        });

        if (customTeethOptions.length) {
          const filteredC = customTeethOptions.filter(
            (t) => !q || t.toLowerCase().includes(q),
          );
          if (filteredC.length) {
            html += `<div style="padding:5px 10px 2px;font-size:10px;font-weight:700;color:var(--primary);background:var(--accent-soft);border-radius:4px;margin:3px 4px;">مخصص</div>`;
            filteredC.forEach((t) => {
              html += `<div onclick="selectToothOption('${t}')"
          style="padding:8px 12px;font-size:13px;color:var(--text);cursor:pointer;border-radius:6px;margin:1px 4px;display:flex;align-items:center;gap:8px"
          onmouseover="this.style.background='var(--accent-soft)'" onmouseout="this.style.background=''"
        ><span style="background:var(--accent);color:#fff;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:700">✦</span><span>${t}</span></div>`;
            });
            hasResults = true;
          }
        }

        if (!hasResults) {
          html =
            '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">لا توجد نتائج مطابقة</div>';
        }
        list.innerHTML = html;
      }

      function selectToothOption(val) {
        document.getElementById("t-tooth").value = val;
        closeToothDD();
      }

      function openToothDD() {
        const dd = document.getElementById("tooth-dropdown");
        if (dd) {
          dd.style.display = "block";
          renderTeethList(document.getElementById("t-tooth").value);
        }
      }

      function closeToothDD() {
        const dd = document.getElementById("tooth-dropdown");
        if (dd) dd.style.display = "none";
      }

      function toggleToothDD() {
        const dd = document.getElementById("tooth-dropdown");
        if (!dd) return;
        if (dd.style.display === "block") {
          closeToothDD();
        } else {
          openToothDD();
        }
      }

      function filterTeethDD() {
        const q = document.getElementById("tooth-search-inp")
          ? document.getElementById("tooth-search-inp").value
          : document.getElementById("t-tooth").value;
        renderTeethList(q);
        if (
          document.getElementById("tooth-dropdown").style.display !== "block"
        ) {
          openToothDD();
        }
      }

      function addCustomToothOption() {
        const inp = document.getElementById("custom-tooth-inp");
        const val = (inp.value || "").trim();
        if (!val) return;
        if (!customTeethOptions.includes(val)) customTeethOptions.push(val);
        selectToothOption(val);
        inp.value = "";
      }

      document.addEventListener("click", function (e) {
        const wrap = document.getElementById("tooth-combobox-wrap");
        if (wrap && !wrap.contains(e.target)) closeToothDD();
      });

      // ===========================
      // TREATMENT REMAINING CALC
      // ===========================
      function calcTreatmentRemaining() {
        const cost = Number(document.getElementById("t-cost").value) || 0;
        const paid = Number(document.getElementById("t-paid").value) || 0;
        const remaining = Math.max(0, cost - paid);
        document.getElementById("t-remaining").value = remaining;

        const indicator = document.getElementById("t-pay-indicator");
        if (!indicator) return;

        if (cost === 0) {
          indicator.style.display = "none";
          return;
        }
        indicator.style.display = "flex";

        if (paid >= cost) {
          indicator.style.background = "var(--success-soft)";
          indicator.style.color = "var(--success)";
          indicator.style.border = "1px solid var(--success)";
          indicator.innerHTML =
            "<span>✅ تم سداد المبلغ بالكامل</span><span>💯</span>";
        } else if (paid > 0) {
          indicator.style.background = "var(--warning-soft)";
          indicator.style.color = "var(--warning)";
          indicator.style.border = "1px solid var(--warning)";
          indicator.innerHTML = `<span>⚠️ متبقي: ${remaining.toLocaleString()}</span><span>جزئي</span>`;
        } else {
          indicator.style.background = "var(--danger-soft)";
          indicator.style.color = "var(--danger)";
          indicator.style.border = "1px solid var(--danger)";
          indicator.innerHTML = `<span>🔴 لم يُسدَّد أي مبلغ</span><span>${cost.toLocaleString()}</span>`;
        }
      }

      function recalcPatientTotals(p) {
        // Group treatments by currency and sum cost/paid/remaining per currency
        const byCurrency = {};
        (p.treatments || []).forEach((t) => {
          const cur = t.currency || p.currency || "SYP";
          if (!byCurrency[cur])
            byCurrency[cur] = { total: 0, paid: 0, remaining: 0 };
          byCurrency[cur].total += Number(t.cost) || 0;
          byCurrency[cur].paid += Number(t.paid) || 0;
          byCurrency[cur].remaining += Math.max(
            0,
            (Number(t.cost) || 0) - (Number(t.paid) || 0),
          );
        });
        // Add payments per currency
        (p.payments || []).forEach((py) => {
          const cur = py.currency || p.currency || "SYP";
          if (!byCurrency[cur])
            byCurrency[cur] = { total: 0, paid: 0, remaining: 0 };
          byCurrency[cur].paid += Number(py.amount) || 0;
        });
        // Recalc remaining per currency (after payments)
        Object.keys(byCurrency).forEach((cur) => {
          const b = byCurrency[cur];
          b.remaining = Math.max(0, b.total - b.paid);
        });
        p.currencyTotals = byCurrency;
        // For legacy single-currency fields — use the patient's primary currency
        const primary = p.currency || "SYP";
        const primaryData = byCurrency[primary] || {
          total: 0,
          paid: 0,
          remaining: 0,
        };
        p.total = primaryData.total;
        p.paid = primaryData.paid;
        p.remaining = primaryData.remaining;
        // Overall "has remaining" flag for filtering — true if ANY currency has remaining > 0
        p.hasRemaining = Object.values(byCurrency).some((b) => b.remaining > 0);
      }

      function saveTreatment() {
        const name = document.getElementById("t-name").value.trim();
        if (!name) {
          toast("يرجى إدخال نوع المعالجة", "danger");
          return;
        }
        const tooth = document.getElementById("t-tooth").value.trim();
        if (!tooth) {
          toast("يرجى تحديد السن المعالج", "danger");
          return;
        }
        const cost = Number(document.getElementById("t-cost").value) || 0;
        const paid = Number(document.getElementById("t-paid").value) || 0;
        const remaining = Math.max(0, cost - paid);
        const hasLab = document.getElementById("t-has-lab").value === "yes";
        const labCost = hasLab ? (Number(document.getElementById("t-lab-cost").value) || 0) : 0;
        const labPaid = hasLab ? (Number(document.getElementById("t-lab-paid").value) || 0) : 0;
        const labRemaining = hasLab ? Math.max(0, labCost - labPaid) : 0;
        const t = {
          id: Date.now(),
          name,
          date: document.getElementById("t-date").value,
          tooth,
          cost,
          paid,
          remaining,
          currency: document.getElementById("t-currency").value,
          notes: document.getElementById("t-notes")
            ? document.getElementById("t-notes").value.trim()
            : "",
          hasLab,
          labCost,
          labPaid,
          labRemaining,
          labCurrency: hasLab ? document.getElementById("t-lab-currency").value : "SYP",
          labDetails: hasLab ? document.getElementById("t-lab-details").value.trim() : "",
          payments: [],
        };
        if (!patients[currentPatientIndex].treatments)
          patients[currentPatientIndex].treatments = [];
        patients[currentPatientIndex].treatments.push(t);
        // Recalculate patient totals correctly (handles multiple currencies)
        recalcPatientTotals(patients[currentPatientIndex]);
        saveState();
        closeModal("modal-treatment");
        toast("تمت إضافة المعالجة ✅");
        showDetail(currentPatientIndex);
        // Reset fields
        document.getElementById("t-name").value = "";
        document.getElementById("t-date").value = "";
        document.getElementById("t-tooth").value = "";
        document.getElementById("t-cost").value = "";
        document.getElementById("t-paid").value = "";
        document.getElementById("t-remaining").value = "";
        document.getElementById("t-currency").value = "SYP";
        document.getElementById("t-has-lab").value = "no";
        document.getElementById("t-lab-cost").value = "";
        document.getElementById("t-lab-paid").value = "";
        document.getElementById("t-lab-remaining").value = "";
        document.getElementById("t-lab-currency").value = "SYP";
        document.getElementById("t-lab-details").value = "";
        document.getElementById("t-lab-section").style.display = "none";
        if (document.getElementById("t-notes"))
          document.getElementById("t-notes").value = "";
        if (document.getElementById("t-pay-indicator"))
          document.getElementById("t-pay-indicator").style.display = "none";
      }

      function savePayment() {
        const amount = Number(document.getElementById("pay-amount").value);
        if (!amount) {
          toast("يرجى إدخال مبلغ الدفعة", "danger");
          return;
        }
        const currency = document.getElementById("pay-currency").value;
        const treatmentId = document.getElementById("pay-treatment-id").value;
        const p = patients[currentPatientIndex];
        if (!p.payments) p.payments = [];
        const payment = {
          amount,
          currency,
          date: new Date().toLocaleDateString("ar-SY"),
          note: document.getElementById("pay-note").value,
          treatmentId: treatmentId || null,
        };
        p.payments.push(payment);
        // If linked to a treatment, update that treatment's paid/remaining
        if (treatmentId) {
          const tr = (p.treatments || []).find(t => String(t.id) === String(treatmentId));
          if (tr) {
            tr.paid = (Number(tr.paid) || 0) + amount;
            tr.remaining = Math.max(0, (Number(tr.cost) || 0) - tr.paid);
          }
        }
        recalcPatientTotals(p);
        saveState();
        closeModal("modal-payment");
        toast("تم تسجيل الدفعة ✅");
        showDetail(currentPatientIndex);
        document.getElementById("pay-amount").value = "";
        document.getElementById("pay-note").value = "";
        document.getElementById("pay-treatment-id").value = "";
      }

      // ===========================
      // LAB PAYMENT
      // ===========================
      function openLabPaymentModal(treatmentIdx) {
        const p = patients[currentPatientIndex];
        const t = (p.treatments || [])[treatmentIdx];
        if (!t || !t.hasLab) return;
        document.getElementById("lab-pay-treatment-idx").value = treatmentIdx;
        document.getElementById("lab-pay-amount").value = "";
        document.getElementById("lab-pay-note").value = "";
        document.getElementById("lab-pay-currency").value = t.labCurrency || "SYP";
        const rem = t.labRemaining || 0;
        document.getElementById("lab-payment-info").innerHTML = `
          <strong>معالجة:</strong> ${t.name}<br>
          <strong>تكلفة المخبر:</strong> ${(t.labCost||0).toLocaleString()} ${currencyLabel(t.labCurrency)}<br>
          <strong>المسدَّد:</strong> <span style="color:var(--success)">${(t.labPaid||0).toLocaleString()}</span><br>
          <strong>المتبقي:</strong> <span style="color:var(--danger);font-weight:700">${rem.toLocaleString()} ${currencyLabel(t.labCurrency)}</span>
        `;
        document.getElementById("modal-lab-payment").classList.add("open");
        setTimeout(() => document.getElementById("lab-pay-amount").focus(), 100);
      }

      function saveLabPayment() {
        const amount = Number(document.getElementById("lab-pay-amount").value);
        if (!amount || amount <= 0) {
          toast("يرجى إدخال مبلغ صحيح", "danger");
          return;
        }
        const tidx = Number(document.getElementById("lab-pay-treatment-idx").value);
        const currency = document.getElementById("lab-pay-currency").value;
        const note = document.getElementById("lab-pay-note").value.trim();
        const p = patients[currentPatientIndex];
        const t = (p.treatments || [])[tidx];
        if (!t) return;
        if (!t.labPayments) t.labPayments = [];
        t.labPayments.push({
          amount,
          currency,
          date: new Date().toLocaleDateString("ar-SY"),
          note,
        });
        t.labPaid = (Number(t.labPaid) || 0) + amount;
        t.labRemaining = Math.max(0, (Number(t.labCost) || 0) - t.labPaid);
        saveState();
        closeModal("modal-lab-payment");
        toast("تم تسجيل دفعة المخبر ✅");
        showDetail(currentPatientIndex);
      }


      function openModal(id) {
        document.getElementById(id).classList.add("open");
        document.body.classList.add("modal-open");
        if (id === "modal-treatment") {
          if (!document.getElementById("t-date").value) {
            document.getElementById("t-date").valueAsDate = new Date();
          }
        }
        if (id === "modal-payment") {
          // Populate treatment dropdown
          const sel = document.getElementById("pay-treatment-id");
          const p = patients[currentPatientIndex];
          sel.innerHTML = '<option value="">-- غير مرتبطة بمعالجة --</option>';
          (p && p.treatments || []).forEach(t => {
            const rem = t.remaining > 0 ? ` (متبقي: ${t.remaining.toLocaleString()} ${currencyLabel(t.currency)})` : ' ✅';
            sel.innerHTML += `<option value="${t.id}">${t.name} — ${t.tooth || '-'}${rem}</option>`;
          });
        }
      }
      function closeModal(id) {
        document.getElementById(id).classList.remove("open");
        // Remove scroll lock only if no other modals are open
        if (!document.querySelector(".modal-overlay.open")) {
          document.body.classList.remove("modal-open");
        }
      }

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          document
            .querySelectorAll(".modal-overlay")
            .forEach((m) => m.classList.remove("open"));
          document.body.classList.remove("modal-open");
        }
      });

      // ===========================
      // LIGHTBOX
      // ===========================
      function openLightbox(src) {
        document.getElementById("lightbox-img").src = src;
        document.getElementById("lightbox").classList.add("open");
      }
      function closeLightbox() {
        document.getElementById("lightbox").classList.remove("open");
      }

      // ===========================
      // EXPORT EXCEL — SINGLE PATIENT (Columns layout)
      // ===========================
      function exportSingleExcel(idx) {
        const p = patients[idx];
        const wb = XLSX.utils.book_new();
        const cur = currencyLabel(p.currency);

        // Sheet 1: Personal Info — كل حقل عمود (header row + data row)
        const infoHeaders = [
          "الاسم الكامل",
          "الاسم الأول",
          "اسم الأب",
          "النسبة",
          "الجنس",
          "العمر",
          "رقم الهاتف",
          "العنوان",
          "ملاحظات",
          "تاريخ التسجيل",
          "العملة",
        ];
        const infoData = [
          fullName(p),
          p.firstname || "",
          p.fathername || "",
          p.lastname || "",
          genderLabel(p.gender),
          p.age || "",
          p.phone || "",
          p.address || "",
          p.notes || "",
          p.createdAt || "",
          cur,
        ];
        const ws1 = XLSX.utils.aoa_to_sheet([infoHeaders, infoData]);
        ws1["!cols"] = infoHeaders.map(() => ({ wch: 22 }));
        XLSX.utils.book_append_sheet(wb, ws1, "المعلومات الشخصية");

        // Sheet 2: Treatments — كل معالجة سطر، الأعمدة هي الحقول
        const tHeaders = [
          "#",
          "نوع المعالجة",
          "السن المعالج",
          "التاريخ",
          "التكلفة",
          "العملة",
        ];
        const tRows = (p.treatments || []).map((t, i) => [
          i + 1,
          t.name || "",
          t.tooth || "",
          t.date || "",
          t.cost || 0,
          currencyLabel(t.currency || p.currency),
        ]);
        const ws2 = XLSX.utils.aoa_to_sheet([tHeaders, ...tRows]);
        ws2["!cols"] = [
          { wch: 5 },
          { wch: 30 },
          { wch: 28 },
          { wch: 14 },
          { wch: 14 },
          { wch: 10 },
        ];
        XLSX.utils.book_append_sheet(wb, ws2, "المعالجات السنية");

        // Sheet 3: Payments summary — header row + data row
        const pyHeaders = ["إجمالي التكلفة", "المدفوع", "المتبقي", "العملة"];
        const pyData = [p.total || 0, p.paid || 0, p.remaining || 0, cur];
        const pyDetailHeaders = [
          "#",
          "مبلغ الدفعة",
          "التاريخ",
          "العملة",
          "ملاحظة",
        ];
        const pyDetailRows = (p.payments || []).map((py, i) => [
          i + 1,
          py.amount,
          py.date,
          currencyLabel(py.currency || p.currency),
          py.note || "",
        ]);
        const ws3 = XLSX.utils.aoa_to_sheet([
          pyHeaders,
          pyData,
          [],
          pyDetailHeaders,
          ...pyDetailRows,
        ]);
        ws3["!cols"] = [
          { wch: 20 },
          { wch: 16 },
          { wch: 16 },
          { wch: 10 },
          { wch: 30 },
        ];
        XLSX.utils.book_append_sheet(wb, ws3, "الدفعات المالية");

        XLSX.writeFile(wb, `مريض_${fullName(p)}.xlsx`);
        toast("تم تصدير ملف Excel ✅");
      }

      // ===========================
      // BACKUP: EXPORT ALL (JSON)
      // ===========================
      function exportAllJSON() {
        if (!patients.length) {
          toast("لا يوجد مرضى لتصديرهم", "danger");
          return;
        }
        const appointments = JSON.parse(localStorage.getItem('dental_appointments') || '[]');
        const backup = {
          version: "3.0",
          exportDate: new Date().toISOString(),
          clinic: "الدكتورة: ديانا منان عكيد",
          totalPatients: patients.length,
          totalAppointments: appointments.length,
          // ── بيانات المرضى ──
          patients: patients,
          // ── المواعيد ──
          appointments: appointments,
          // ── إعدادات العيادة ──
          settings: {
            clinicName:   localStorage.getItem('dental_clinic_name')   || '',
            doctorEmail:  localStorage.getItem('dental_doctor_email')  || '',
            // authHash هو SHA-256 hash — لا يمكن عكسه للحصول على كلمة المرور الأصلية
            authHash:     localStorage.getItem('dental_auth_hash')     || '',
            theme:        localStorage.getItem('dental_theme')         || 'light',
          },
          // توقيع للتحقق من سلامة الملف
          _integrity: btoa(unescape(encodeURIComponent(
            (localStorage.getItem('dental_clinic_name') || '') +
            String(patients.length) +
            String(appointments.length)
          ))),
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const dateStr = new Date()
          .toLocaleDateString("ar-SY")
          .replace(/\//g, "-");
        a.href = url;
        a.download = `backup_عيادة_الابتسامة_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
        localStorage.setItem("dental_last_backup", new Date().toLocaleDateString("ar-SY"));
        toast(`تم تصدير نسخة احتياطية كاملة — ${patients.length} مريض و ${appointments.length} موعد ✅`);
      }

      // ===========================
      // BACKUP: EXPORT ALL (Excel)
      // ===========================
      function exportAllExcel() {
        if (!patients.length) {
          toast("لا يوجد مرضى لتصديرهم", "danger");
          return;
        }
        const wb = XLSX.utils.book_new();

        // Sheet 1: All Patients — كل مريض سطر
        const pHeaders = [
          "#",
          "الاسم الكامل",
          "الاسم الأول",
          "اسم الأب",
          "النسبة",
          "الجنس",
          "العمر",
          "رقم الهاتف",
          "العنوان",
          "تاريخ التسجيل",
          "عدد المعالجات",
          "إجمالي التكلفة",
          "المدفوع",
          "المتبقي",
          "العملة",
          "ملاحظات",
        ];
        const pRows = patients.map((p, i) => [
          i + 1,
          fullName(p),
          p.firstname || "",
          p.fathername || "",
          p.lastname || "",
          genderLabel(p.gender),
          p.age || "",
          p.phone || "",
          p.address || "",
          p.createdAt || "",
          (p.treatments || []).length,
          p.total || 0,
          p.paid || 0,
          p.remaining || 0,
          currencyLabel(p.currency),
          p.notes || "",
        ]);
        const ws1 = XLSX.utils.aoa_to_sheet([pHeaders, ...pRows]);
        ws1["!cols"] = [
          5, 22, 14, 14, 14, 10, 8, 14, 22, 14, 12, 14, 14, 14, 8, 30,
        ].map((w) => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws1, "جميع المرضى");

        // Sheet 2: All Treatments — كل معالجة سطر مع اسم المريض
        const tHeaders = [
          "#",
          "اسم المريض",
          "نوع المعالجة",
          "السن المعالج",
          "التاريخ",
          "التكلفة",
          "العملة",
        ];
        let tRows = [];
        let tCount = 1;
        patients.forEach((p) => {
          (p.treatments || []).forEach((t) => {
            tRows.push([
              tCount++,
              fullName(p),
              t.name || "",
              t.tooth || "",
              t.date || "",
              t.cost || 0,
              currencyLabel(t.currency || p.currency),
            ]);
          });
        });
        const ws2 = XLSX.utils.aoa_to_sheet([tHeaders, ...tRows]);
        ws2["!cols"] = [
          { wch: 5 },
          { wch: 24 },
          { wch: 28 },
          { wch: 24 },
          { wch: 14 },
          { wch: 14 },
          { wch: 10 },
        ];
        XLSX.utils.book_append_sheet(wb, ws2, "جميع المعالجات");

        // Sheet 3: All Payments
        const pyHeaders = [
          "#",
          "اسم المريض",
          "مبلغ الدفعة",
          "التاريخ",
          "العملة",
          "ملاحظة",
        ];
        let pyRows = [];
        let pyCount = 1;
        patients.forEach((p) => {
          (p.payments || []).forEach((py) => {
            pyRows.push([
              pyCount++,
              fullName(p),
              py.amount,
              py.date,
              currencyLabel(py.currency || p.currency),
              py.note || "",
            ]);
          });
        });
        const ws3 = XLSX.utils.aoa_to_sheet([pyHeaders, ...pyRows]);
        ws3["!cols"] = [
          { wch: 5 },
          { wch: 24 },
          { wch: 14 },
          { wch: 16 },
          { wch: 10 },
          { wch: 30 },
        ];
        XLSX.utils.book_append_sheet(wb, ws3, "جميع الدفعات");

        const dateStr = new Date()
          .toLocaleDateString("ar-SY")
          .replace(/\//g, "-");
        XLSX.writeFile(wb, `تقرير_عيادة_الابتسامة_${dateStr}.xlsx`);
        toast(`تم تصدير Excel شامل لـ ${patients.length} مريض ✅`);
      }

      // ===========================
      // BACKUP: IMPORT ALL (JSON)
      // ===========================
      function importAllPatients(input) {
        const file = input.files[0];
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        const resultEl = document.getElementById("backup-import-result");

        if (ext === 'xlsx' || ext === 'xls') {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const wb = XLSX.read(e.target.result, {type: 'array'});
              const ws = wb.Sheets[wb.SheetNames[0]];
              const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
              if (!rows.length) throw new Error("الملف فارغ");
              let added = 0, updated = 0;
              rows.forEach(row => {
                if (!row['الاسم الأول'] && !row['firstname']) return;
                const gender = row['الجنس'] === 'أنثى 👩' || row['gender'] === 'female' ? 'female' : 'male';
                const p = {
                  id: Date.now() + Math.random(),
                  firstname: row['الاسم الأول'] || row['firstname'] || '',
                  fathername: row['اسم الأب'] || row['fathername'] || '',
                  lastname: row['النسبة'] || row['lastname'] || '',
                  gender,
                  age: row['العمر'] || row['age'] || '',
                  phone: String(row['رقم الهاتف'] || row['phone'] || ''),
                  address: row['العنوان'] || row['address'] || '',
                  notes: row['ملاحظات'] || row['notes'] || '',
                  treatments: [], payments: [], xrays: [],
                  createdAt: row['تاريخ التسجيل'] || new Date().toLocaleDateString('ar-SY'),
                };
                patients.push(p);
                added++;
              });
              saveState();
              renderDashboard();
              renderStorageStats();
              resultEl.innerHTML = `<div class="alert alert-success">✅ تم استيراد <strong>${added}</strong> مريض من Excel بنجاح</div>`;
              toast(`تم استيراد ${added} مريض من Excel ✅`);
            } catch(err) {
              resultEl.innerHTML = `<div class="alert alert-danger">❌ ${err.message || 'الملف غير صالح'}</div>`;
            }
          };
          reader.readAsArrayBuffer(file);
        } else {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const raw = JSON.parse(e.target.result);
              const incoming = Array.isArray(raw) ? raw : raw.patients || [];
              if (!incoming.length) throw new Error("لا يوجد بيانات مرضى");

              // ── استعادة المرضى ──
              let added = 0, updated = 0;
              incoming.forEach((p) => {
                if (!p.firstname && !p.fathername) return;
                const existing = patients.findIndex((x) => x.id === p.id);
                if (existing >= 0) {
                  patients[existing] = p;
                  updated++;
                } else {
                  patients.push(p);
                  added++;
                }
              });
              saveState();

              // ── استعادة المواعيد (v3.0+) ──
              let apptCount = 0;
              if (raw.appointments && Array.isArray(raw.appointments)) {
                localStorage.setItem('dental_appointments', JSON.stringify(raw.appointments));
                apptCount = raw.appointments.length;
              }

              // ── استعادة إعدادات العيادة (v3.0+) ──
              let settingsRestored = [];
              if (raw.settings) {
                const s = raw.settings;
                if (s.clinicName)  { localStorage.setItem('dental_clinic_name',   s.clinicName);  settingsRestored.push('اسم العيادة'); }
                if (s.doctorEmail) { localStorage.setItem('dental_doctor_email',  s.doctorEmail); settingsRestored.push('البريد الإلكتروني'); }
                if (s.authHash) {
                  // authHash هو SHA-256 — آمن للاستعادة (لا يمكن عكسه)
                  localStorage.setItem('dental_auth_hash', s.authHash);
                  settingsRestored.push('كلمة المرور');
                }
                if (s.theme)       { localStorage.setItem('dental_theme',         s.theme); }
                // حدّث اسم العيادة في الواجهة فوراً إن وُجدت الدالة
                if (typeof loadClinicName === 'function') loadClinicName();
              }

              renderStorageStats();
              renderDashboard();

              // ── رسالة النتيجة التفصيلية ──
              const settingsLine = settingsRestored.length
                ? `<br>🔧 الإعدادات المستعادة: ${settingsRestored.join('، ')}`
                : '';
              const apptLine = apptCount
                ? `<br>📅 المواعيد المستعادة: <strong>${apptCount}</strong> موعد`
                : '<br>📅 لا توجد مواعيد في هذا الملف';
              resultEl.innerHTML = `
                <div class="alert alert-success">
                  ✅ تمت الاستعادة الكاملة بنجاح<br>
                  👤 المرضى: أُضيف <strong>${added}</strong> جديد، حُدّث <strong>${updated}</strong> موجود
                  ${apptLine}
                  ${settingsLine}
                </div>`;
              toast(`تمت استعادة ${added + updated} مريض و ${apptCount} موعد ✅`);

            } catch (err) {
              resultEl.innerHTML = `<div class="alert alert-danger">❌ الملف غير صالح أو تالف — تأكد أنه ملف backup.json صادر من هذا النظام.</div>`;
            }
          };
          reader.readAsText(file);
        }
        input.value = "";
      }

      // ===========================
      // BACKUP: STORAGE STATS
      // ===========================
      function renderStorageStats() {
        const el = document.getElementById("storage-stats");
        if (!el) return;
        const totalTreatments = patients.reduce(
          (s, p) => s + (p.treatments || []).length,
          0,
        );
        const totalPayments = patients.reduce(
          (s, p) => s + (p.payments || []).length,
          0,
        );
        const appointments = JSON.parse(localStorage.getItem('dental_appointments') || '[]');
        const totalAppointments = appointments.length;

        // حساب حجم كل البيانات المهمة
        const storageKeys = ['dental_patients_v2', 'dental_appointments', 'dental_clinic_name', 'dental_doctor_email'];
        const storageSize = new Blob([
          storageKeys.map(k => localStorage.getItem(k) || '').join('')
        ]).size;
        const sizeKb = (storageSize / 1024).toFixed(1);
        const lastExport =
          localStorage.getItem("dental_last_backup") || "لم يتم بعد";

        // Auto-backup status indicator
        const today = getLocalDateString();
        const lastAutoBackup = localStorage.getItem(AUTO_BACKUP_KEY);
        let autoBackupDays = null;
        if (lastAutoBackup) {
          const diffMs = new Date(today) - new Date(lastAutoBackup);
          autoBackupDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }
        let autoBackupBadge, autoBackupColor, autoBackupLabel;
        if (lastAutoBackup === today) {
          autoBackupBadge = "✅ اليوم";
          autoBackupColor = "var(--success)";
          autoBackupLabel = "آخر نسخة تلقائية";
        } else if (!lastAutoBackup) {
          autoBackupBadge = "لم تُنشأ بعد";
          autoBackupColor = "var(--text-muted)";
          autoBackupLabel = "النسخ التلقائي";
        } else if (autoBackupDays <= 1) {
          autoBackupBadge = "أمس ✓";
          autoBackupColor = "var(--accent)";
          autoBackupLabel = "آخر نسخة تلقائية";
        } else if (autoBackupDays <= 3) {
          autoBackupBadge = `⚠️ منذ ${autoBackupDays} أيام`;
          autoBackupColor = "#ffc107";
          autoBackupLabel = "آخر نسخة تلقائية";
        } else {
          autoBackupBadge = `🚨 منذ ${autoBackupDays} أيام`;
          autoBackupColor = "var(--danger)";
          autoBackupLabel = "آخر نسخة تلقائية";
        }

        el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">
      <div class="payment-box total" style="text-align:right;padding:14px 16px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">إجمالي المرضى</div>
        <div style="font-size:22px;font-weight:800;color:var(--primary)">${patients.length}</div>
      </div>
      <div class="payment-box" style="text-align:right;padding:14px 16px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">المواعيد المحفوظة</div>
        <div style="font-size:22px;font-weight:800;color:#6f42c1">${totalAppointments}</div>
      </div>
      <div class="payment-box" style="text-align:right;padding:14px 16px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">إجمالي المعالجات</div>
        <div style="font-size:22px;font-weight:800;color:var(--accent)">${totalTreatments}</div>
      </div>
      <div class="payment-box" style="text-align:right;padding:14px 16px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">إجمالي الدفعات</div>
        <div style="font-size:22px;font-weight:800;color:var(--success)">${totalPayments}</div>
      </div>
      <div class="payment-box" style="text-align:right;padding:14px 16px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">حجم البيانات</div>
        <div style="font-size:22px;font-weight:800;color:var(--warning)">${sizeKb} KB</div>
      </div>
      <div class="payment-box" style="text-align:right;padding:14px 16px;cursor:pointer" onclick="performAutoBackup(false)" title="اضغط لنسخ احتياطي الآن">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${autoBackupLabel}</div>
        <div style="font-size:15px;font-weight:800;color:${autoBackupColor}">${autoBackupBadge}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:4px">اضغط للنسخ الآن ↓</div>
      </div>
    </div>`;
      }

      // ===========================
      // BACKUP: CLEAR ALL
      // ===========================
      function confirmClearAll() {
        if (!patients.length) {
          toast("لا يوجد بيانات لحذفها", "danger");
          return;
        }
        const confirmed = confirm(
          `⚠️ تحذير: سيتم حذف بيانات جميع المرضى (${patients.length} مريض) بشكل نهائي!\n\nهل أنت متأكد؟`,
        );
        if (!confirmed) return;
        const confirmed2 = confirm(
          "تأكيد مرة أخيرة: هل تريد فعلاً مسح جميع البيانات؟",
        );
        if (!confirmed2) return;
        patients = [];
        saveState();
        renderDashboard();
        renderStorageStats();
        document.getElementById("backup-import-result").innerHTML =
          `<div class="alert alert-danger">🗑️ تم مسح جميع البيانات.</div>`;
        toast("تم مسح جميع البيانات", "danger");
      }

      // ===========================
      // EXPORT JSON
      // ===========================
      function exportJSON(idx) {
        const p = patients[idx];
        const blob = new Blob([JSON.stringify(p, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ملف_${fullName(p)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast("تم حفظ الملف 💾");
      }

      // ===========================
      // IMPORT JSON
      // ===========================
      function importPatient(input) {
        const file = input.files[0];
        if (!file) return;
        const result = document.getElementById("import-result");
        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'xlsx' || ext === 'xls') {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const wb = XLSX.read(e.target.result, {type: 'array'});
              const ws = wb.Sheets[wb.SheetNames[0]];
              const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
              if (!rows.length) throw new Error("الملف فارغ");
              const row = rows[0];
              const p = {
                id: Date.now(),
                firstname: row['الاسم الأول'] || row['firstname'] || '',
                fathername: row['اسم الأب'] || row['fathername'] || '',
                lastname: row['النسبة'] || row['lastname'] || '',
                gender: row['الجنس'] === 'أنثى' || row['gender'] === 'female' ? 'female' : 'male',
                age: row['العمر'] || row['age'] || '',
                phone: row['رقم الهاتف'] || row['phone'] || '',
                address: row['العنوان'] || row['address'] || '',
                notes: row['ملاحظات'] || row['notes'] || '',
                treatments: [], payments: [], xrays: [],
                createdAt: new Date().toLocaleDateString('ar-SY'),
              };
              if (!p.firstname && !p.fathername) throw new Error("بيانات غير صالحة");
              patients.push(p);
              saveState();
              result.innerHTML = `<div class="alert alert-success">✅ تم استيراد ${p.firstname} ${p.fathername} من Excel</div>`;
              toast("تم استيراد المريض من Excel");
              setTimeout(() => showDetail(patients.length - 1), 1000);
            } catch(err) {
              result.innerHTML = `<div class="alert alert-danger">❌ ${err.message || 'الملف غير صالح'}</div>`;
            }
          };
          reader.readAsArrayBuffer(file);
        } else {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const p = JSON.parse(e.target.result);
              if (!p.firstname && !p.fathername) throw new Error("ملف غير صالح");
              const existing = patients.findIndex((x) => x.id === p.id);
              if (existing >= 0) {
                patients[existing] = p;
                saveState();
                result.innerHTML = `<div class="alert alert-success">✅ تم تحديث بيانات ${fullName(p)} بنجاح</div>`;
                toast("تم تحديث بيانات المريض");
                setTimeout(() => showDetail(existing), 1000);
              } else {
                patients.push(p);
                saveState();
                result.innerHTML = `<div class="alert alert-info">✅ تم استيراد ${fullName(p)} كمريض جديد</div>`;
                toast("تم استيراد المريض");
                setTimeout(() => showDetail(patients.length - 1), 1000);
              }
            } catch (err) {
              result.innerHTML = `<div class="alert alert-danger">❌ الملف غير صالح أو تالف</div>`;
            }
          };
          reader.readAsText(file);
        }
        input.value = "";
      }

      // ===========================
      // CLINIC NAME MANAGEMENT
      // ===========================
      function loadClinicName() {
        const saved = localStorage.getItem("dental_clinic_name");
        const name = saved || "عيادتي";
        document.getElementById("clinic-name-display").textContent = name;
        document.title = name + " — نظام إدارة المرضى";
        return name;
      }

      function openClinicNameModal() {
        const current = localStorage.getItem("dental_clinic_name") || "";
        document.getElementById("clinic-name-input").value = current;
        document.getElementById("modal-clinic-name").classList.add("open");
        setTimeout(
          () => document.getElementById("clinic-name-input").focus(),
          100,
        );
      }

      function saveClinicName() {
        const val = document.getElementById("clinic-name-input").value.trim();
        if (!val) {
          toast("يرجى إدخال اسم العيادة", "danger");
          return;
        }
        localStorage.setItem("dental_clinic_name", val);
        loadClinicName();
        document.getElementById("modal-clinic-name").classList.remove("open");
        toast("تم حفظ اسم العيادة ✅");
      }

      // ===========================
      // AUTO BACKUP (يومي - تلقائي)
      // ===========================

      const AUTO_BACKUP_KEY = "dental_auto_backup_last_date";
      const AUTO_BACKUP_NOTIF_ID = "auto-backup-notification";

      function getLocalDateString() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      }

      function performAutoBackup(silent = false) {
        if (!patients.length) return;

        const clinicName = localStorage.getItem("dental_clinic_name") || "عيادتي";
        const today = getLocalDateString();
        const appointments = JSON.parse(localStorage.getItem('dental_appointments') || '[]');
        const backup = {
          version: "3.0",
          exportDate: new Date().toISOString(),
          autoBackup: true,
          clinic: clinicName,
          totalPatients: patients.length,
          totalAppointments: appointments.length,
          // ── بيانات المرضى ──
          patients: patients,
          // ── المواعيد ──
          appointments: appointments,
          // ── إعدادات العيادة ──
          settings: {
            clinicName:   localStorage.getItem('dental_clinic_name')   || '',
            doctorEmail:  localStorage.getItem('dental_doctor_email')  || '',
            authHash:     localStorage.getItem('dental_auth_hash')     || '',
            theme:        localStorage.getItem('dental_theme')         || 'light',
          },
          _integrity: btoa(unescape(encodeURIComponent(
            (localStorage.getItem('dental_clinic_name') || '') +
            String(patients.length) +
            String(appointments.length)
          ))),
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dental-backup-${today}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        localStorage.setItem(AUTO_BACKUP_KEY, today);

        if (!silent) {
          showAutoBackupNotification("success");
        }
      }

      function showAutoBackupNotification(type) {
        // Remove existing notification if any
        const existing = document.getElementById(AUTO_BACKUP_NOTIF_ID);
        if (existing) existing.remove();

        const today = getLocalDateString();
        const lastBackup = localStorage.getItem(AUTO_BACKUP_KEY) || null;

        // Calculate days since last backup
        let daysSince = null;
        if (lastBackup) {
          const diffMs = new Date(today) - new Date(lastBackup);
          daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }

        let icon, bgColor, borderColor, textColor, title, message, actions;

        if (type === "success") {
          icon = "✅";
          bgColor = "linear-gradient(135deg, #d4edda, #c3e6cb)";
          borderColor = "#28a745";
          textColor = "#155724";
          title = "تم النسخ الاحتياطي اليوم";
          message = `تم تنزيل ملف <strong>dental-backup-${today}.json</strong> إلى مجلد التنزيلات تلقائياً.`;
          actions = `<button onclick="dismissAutoBackupNotif()" style="background:#28a745;color:#fff;border:none;padding:6px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">حسناً ✓</button>`;
        } else if (type === "warning") {
          icon = "⚠️";
          bgColor = "linear-gradient(135deg, #fff3cd, #ffeaa7)";
          borderColor = "#ffc107";
          textColor = "#856404";
          title = `تحذير: لم يتم النسخ الاحتياطي منذ ${daysSince} ${daysSince === 1 ? "يوم" : "أيام"}`;
          message = `آخر نسخة: <strong>${lastBackup || "لا توجد نسخة سابقة"}</strong>. يُنصح بعمل نسخة احتياطية الآن لحماية بيانات مرضاك.`;
          actions = `
            <button onclick="performAutoBackup(false)" style="background:#ffc107;color:#212529;border:none;padding:6px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;margin-left:8px">💾 نسخ احتياطي الآن</button>
            <button onclick="dismissAutoBackupNotif()" style="background:transparent;color:#856404;border:1px solid #ffc107;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:13px">تجاهل</button>
          `;
        } else if (type === "danger") {
          icon = "🚨";
          bgColor = "linear-gradient(135deg, #f8d7da, #f5c6cb)";
          borderColor = "#dc3545";
          textColor = "#721c24";
          title = `خطر: لم يتم النسخ الاحتياطي منذ ${daysSince} ${daysSince === 1 ? "يوم" : "أيام"}!`;
          message = `آخر نسخة: <strong>${lastBackup || "لا توجد نسخة سابقة"}</strong>. بياناتك في خطر! قم بالنسخ الاحتياطي الآن فوراً.`;
          actions = `
            <button onclick="performAutoBackup(false)" style="background:#dc3545;color:#fff;border:none;padding:6px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;margin-left:8px">🚨 نسخ احتياطي فوري</button>
            <button onclick="dismissAutoBackupNotif()" style="background:transparent;color:#721c24;border:1px solid #dc3545;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:13px">تجاهل</button>
          `;
        }

        const notif = document.createElement("div");
        notif.id = AUTO_BACKUP_NOTIF_ID;
        notif.setAttribute("dir", "rtl");
        notif.style.cssText = `
          position: fixed;
          bottom: 24px;
          left: 24px;
          z-index: 99999;
          max-width: 400px;
          min-width: 300px;
          background: ${bgColor};
          border: 2px solid ${borderColor};
          border-radius: 14px;
          padding: 16px 18px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10);
          font-family: inherit;
          animation: slideInNotif 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        `;

        notif.innerHTML = `
          <style>
            @keyframes slideInNotif {
              from { transform: translateY(120%) scale(0.9); opacity: 0; }
              to   { transform: translateY(0) scale(1); opacity: 1; }
            }
            @keyframes slideOutNotif {
              from { transform: translateY(0) scale(1); opacity: 1; }
              to   { transform: translateY(120%) scale(0.9); opacity: 0; }
            }
          </style>
          <div style="display:flex;align-items:flex-start;gap:10px">
            <div style="font-size:22px;flex-shrink:0;margin-top:1px">${icon}</div>
            <div style="flex:1">
              <div style="font-weight:700;font-size:14px;color:${textColor};margin-bottom:4px">${title}</div>
              <div style="font-size:12.5px;color:${textColor};opacity:0.85;margin-bottom:12px;line-height:1.5">${message}</div>
              <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px">${actions}</div>
            </div>
            <button onclick="dismissAutoBackupNotif()" style="background:none;border:none;cursor:pointer;color:${textColor};opacity:0.5;font-size:18px;padding:0;line-height:1;flex-shrink:0" title="إغلاق">×</button>
          </div>
        `;

        document.body.appendChild(notif);

        // Auto-dismiss success after 6 seconds
        if (type === "success") {
          setTimeout(() => dismissAutoBackupNotif(), 6000);
        }
      }

      function dismissAutoBackupNotif() {
        const notif = document.getElementById(AUTO_BACKUP_NOTIF_ID);
        if (!notif) return;
        notif.style.animation = "slideOutNotif 0.3s ease forwards";
        setTimeout(() => notif && notif.remove(), 300);
      }

      function checkAndRunAutoBackup() {
        if (!patients.length) return; // No data — skip silently

        const today = getLocalDateString();
        const lastBackup = localStorage.getItem(AUTO_BACKUP_KEY);

        if (lastBackup === today) {
          // Already backed up today — no action needed
          return;
        }

        // Calculate days since last backup
        let daysSince = Infinity;
        if (lastBackup) {
          const diffMs = new Date(today) - new Date(lastBackup);
          daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }

        if (daysSince <= 1 || !lastBackup) {
          // First time today — auto-download silently, then show success notif
          setTimeout(() => {
            performAutoBackup(true); // silent download
            showAutoBackupNotification("success");
          }, 1500); // Small delay so page loads first
        } else if (daysSince <= 3) {
          // 2-3 days — show yellow warning
          setTimeout(() => showAutoBackupNotification("warning"), 1500);
        } else {
          // 4+ days — show red danger alert
          setTimeout(() => showAutoBackupNotification("danger"), 1000);
        }
      }

      // ===========================
      // INIT
      // ===========================
      loadClinicName();
      renderDashboard();
      renderStorageStats();
      checkAndRunAutoBackup();
