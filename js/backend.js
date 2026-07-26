// ===========================================================================
// Backend sync bridge
// Connects the localStorage-based app to the Laravel API using whole-dataset
// sync: push = gather localStorage -> POST /import; pull = GET /export ->
// write localStorage -> reload. Auth is handled via the API (see auth.js).
// Exposes window.Backend.
// ===========================================================================
(function (global) {
  'use strict';

  // ===========================================================================
  // API server URL — change this one line if the backend moves.
  // Points to the deployed Laravel API.
  // ===========================================================================
  var API_BASE = 'https://lightsalmon-stingray-139704.hostingersite.com';

  var API_BASE_KEY = 'dental_api_base';
  // Clear any stale server URL saved by older builds so it can't override API_BASE.
  try { localStorage.removeItem(API_BASE_KEY); } catch (e) { /* ignore */ }

  function getApiBase() {
    return API_BASE;
  }

  function setApiBase(url) {
    if (url) {
      API_BASE = url.replace(/\/$/, '');
      api = new global.DentalApi(API_BASE);
    }
  }

  var api = new global.DentalApi(getApiBase());

  function notify(message, type) {
    if (typeof global.toast === 'function') {
      global.toast(message, type);
    } else if (type === 'danger') {
      alert(message);
    }
  }

  // ---- build the backup bundle from the current localStorage state ----
  function collectBundle() {
    return {
      version: '3.0',
      exportDate: new Date().toISOString(),
      patients: JSON.parse(localStorage.getItem('dental_patients_v2') || '[]'),
      appointments: JSON.parse(localStorage.getItem('dental_appointments') || '[]'),
      treatmentPlans: JSON.parse(localStorage.getItem('dental_treatment_plans') || '[]'),
      settings: {
        clinicName: localStorage.getItem('dental_clinic_name') || '',
        doctorEmail: localStorage.getItem('dental_doctor_email') || '',
        theme: localStorage.getItem('dental_theme') || 'light',
      },
    };
  }

  // ---- write a fetched bundle into localStorage (app reads it on reload) ----
  function applyBundle(bundle) {
    localStorage.setItem('dental_patients_v2', JSON.stringify(bundle.patients || []));
    localStorage.setItem('dental_appointments', JSON.stringify(bundle.appointments || []));
    localStorage.setItem('dental_treatment_plans', JSON.stringify(bundle.treatmentPlans || []));
    if (bundle.settings) {
      if (bundle.settings.clinicName != null) localStorage.setItem('dental_clinic_name', bundle.settings.clinicName);
      if (bundle.settings.doctorEmail != null) localStorage.setItem('dental_doctor_email', bundle.settings.doctorEmail);
      if (bundle.settings.theme) localStorage.setItem('dental_theme', bundle.settings.theme);
    }
  }

  function setStatus(text, color) {
    var el = document.getElementById('sync-status');
    if (el) {
      el.textContent = text || '';
      el.style.color = color || 'var(--text-muted)';
    }
  }

  // ---- push local data to the server ----
  function saveToServer() {
    if (!api.isAuthenticated()) {
      notify('يجب تسجيل الدخول إلى الخادم أولاً', 'danger');
      return Promise.resolve(false);
    }
    if (!confirm('سيتم رفع جميع البيانات المحلية إلى الخادم ودمجها. متابعة؟')) {
      return Promise.resolve(false);
    }
    setStatus('⏳ جارٍ الرفع إلى الخادم...', 'var(--primary)');
    return api.importData(collectBundle())
      .then(function (res) {
        var c = (res && res.imported) || {};
        notify('✅ تم الرفع إلى الخادم بنجاح');
        setStatus('✅ آخر رفع: ' + new Date().toLocaleString('ar-SY') +
          ' — مرضى: ' + (c.patients || 0) + '، مواعيد: ' + (c.appointments || 0), '#28a745');
        return true;
      })
      .catch(function (err) {
        notify('❌ فشل الرفع: ' + err.message, 'danger');
        setStatus('❌ فشل الرفع: ' + err.message, '#e53e3e');
        return false;
      });
  }

  // ---- pull server data into the app (overwrites local, then reloads) ----
  function loadFromServer() {
    if (!api.isAuthenticated()) {
      notify('يجب تسجيل الدخول إلى الخادم أولاً', 'danger');
      return Promise.resolve(false);
    }
    if (!confirm('سيتم استبدال البيانات المحلية ببيانات الخادم وإعادة تحميل الصفحة. متابعة؟')) {
      return Promise.resolve(false);
    }
    setStatus('⏳ جارٍ التحميل من الخادم...', 'var(--primary)');
    return api.exportAll()
      .then(function (bundle) {
        applyBundle(bundle);
        notify('✅ تم التحميل من الخادم — سيتم إعادة التحميل');
        setTimeout(function () { global.location.reload(); }, 600);
        return true;
      })
      .catch(function (err) {
        notify('❌ فشل التحميل: ' + err.message, 'danger');
        setStatus('❌ فشل التحميل: ' + err.message, '#e53e3e');
        return false;
      });
  }

  global.Backend = {
    api: api,
    getApi: function () { return api; },
    getApiBase: getApiBase,
    setApiBase: setApiBase,
    collectBundle: collectBundle,
    applyBundle: applyBundle,
    saveToServer: saveToServer,
    loadFromServer: loadFromServer,
    setStatus: setStatus,
  };
})(window);
