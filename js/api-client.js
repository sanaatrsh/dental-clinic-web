// ===========================================================================
// Dental Clinic API client (browser global build)
// Exposes window.DentalApi and window.ApiError. Plain script (no ES modules)
// so it works alongside the existing global scripts. See the API project's
// API_CONTRACT.md for the full contract.
// ===========================================================================
(function (global) {
  'use strict';

  var TOKEN_KEY = 'dental_api_token';

  function ApiError(status, message, errors) {
    this.name = 'ApiError';
    this.status = status;
    this.message = message || ('Request failed (' + status + ')');
    this.errors = errors || {};
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  function DentalApi(baseUrl) {
    this.baseUrl = (baseUrl || 'http://localhost:8000').replace(/\/$/, '');
    this.prefix = '/api/v1';
    this.token = localStorage.getItem(TOKEN_KEY) || null;
  }

  DentalApi.prototype.setToken = function (token) {
    this.token = token || null;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    return this;
  };

  DentalApi.prototype.isAuthenticated = function () {
    return Boolean(this.token);
  };

  DentalApi.prototype.request = function (method, path, opts) {
    opts = opts || {};
    var url = this.baseUrl + this.prefix + path;
    if (opts.query) {
      var qs = Object.keys(opts.query)
        .filter(function (k) {
          var v = opts.query[k];
          return v !== undefined && v !== null && v !== '';
        })
        .map(function (k) {
          return encodeURIComponent(k) + '=' + encodeURIComponent(opts.query[k]);
        })
        .join('&');
      if (qs) url += '?' + qs;
    }

    var headers = { Accept: 'application/json' };
    if (this.token) headers.Authorization = 'Bearer ' + this.token;

    var init = { method: method, headers: headers };
    if (opts.body instanceof FormData) {
      init.body = opts.body;
    } else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }

    return fetch(url, init).then(function (res) {
      if (res.status === 204) return null;
      return res.text().then(function (text) {
        var payload = null;
        if (text) {
          try { payload = JSON.parse(text); } catch (e) { payload = text; }
        }
        if (!res.ok) {
          var message = (payload && payload.message) || ('Request failed (' + res.status + ')');
          var errors = (payload && payload.errors) || {};
          throw new ApiError(res.status, message, errors);
        }
        return payload;
      });
    });
  };

  // ---- auth ----
  DentalApi.prototype.login = function (email, password, deviceName) {
    var self = this;
    return this.request('POST', '/login', {
      body: { email: email, password: password, device_name: deviceName || 'web' },
    }).then(function (data) {
      self.setToken(data.token);
      return data;
    });
  };

  DentalApi.prototype.me = function () {
    return this.request('GET', '/me');
  };

  DentalApi.prototype.logout = function () {
    var self = this;
    return this.request('POST', '/logout')
      .catch(function () { /* ignore */ })
      .then(function () { self.setToken(null); });
  };

  // ---- whole-dataset sync (backup shape) ----
  DentalApi.prototype.exportAll = function () {
    return this.request('GET', '/export');
  };

  DentalApi.prototype.importData = function (data) {
    return this.request('POST', '/import', { body: { data: data } });
  };

  global.ApiError = ApiError;
  global.DentalApi = DentalApi;
})(window);
