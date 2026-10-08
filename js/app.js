// Handles full-featured QR studio client application
document.addEventListener('DOMContentLoaded', function () {
  var STORAGE_HISTORY = 'qr_studio_history_v1';
  var THEME_KEY = 'qr_studio_theme';

  var state = {
    data: {
      type: 'url',
      url: 'https://google.com',
      waPhone: '',
      waCountryCode: '+1',
      waMessage: 'Hello! I scanned your QR code.',
      wifiSsid: 'MyHome_WiFi',
      wifiPassword: 'Password123',
      wifiEncryption: 'WPA',
      wifiHidden: false,
      vcardFirstName: 'John',
      vcardLastName: 'Doe',
      vcardOrg: 'Acme Corporation',
      vcardTitle: 'Manager',
      vcardPhone: '+1 555-0199',
      vcardWorkPhone: '',
      vcardEmail: 'john@example.com',
      vcardUrl: 'https://example.com',
      vcardAddress: '123 Market St',
      text: 'Scan this QR code with your phone camera.',
      phone: '+15550199',
      emailTo: 'contact@example.com',
      emailSubject: 'Inquiry',
      emailBody: 'Hello, I wanted to reach out...',
      smsPhone: '+15550199',
      smsMessage: 'Hi there!',
      locLatitude: '37.7749',
      locLongitude: '-122.4194',
      locQuery: 'San Francisco, CA'
    },
    style: {
      fgColor: '#000000',
      bgColor: '#ffffff',
      dotStyle: 'square', // square, dots, rounded
      logoType: 'none', // none, whatsapp, wifi, globe, phone, star, custom
      customLogoUrl: null,
      logoSize: 22,
      logoBgWhite: true,
      frameStyle: 'none', // none, simple-top, simple-bottom
      frameText: 'SCAN ME',
      frameColor: '#000000',
      errorCorrection: 'H'
    }
  };

  var canvas = document.getElementById('qrCanvas');
  var previewTitle = document.getElementById('previewTitle');
  var toastEl = document.getElementById('toast');
  var formContainer = document.getElementById('formContainer');
  var typeButtons = document.querySelectorAll('.type-btn');

  // Dialog Management & Back Button History Stack
  var openDialogStack = [];

  function openDialog(element, closeCallback) {
    if (!element) return;
    element.classList.add('open');
    openDialogStack.push({ element: element, close: closeCallback });
    try {
      history.pushState({ dialogOpen: true }, '');
    } catch (e) {}
  }

  function closeTopDialog(fromPopstate) {
    if (openDialogStack.length > 0) {
      var item = openDialogStack.pop();
      if (item) {
        if (typeof item.close === 'function') {
          item.close();
        } else if (item.element) {
          item.element.classList.remove('open');
        }
      }
      if (!fromPopstate) {
        try {
          history.back();
        } catch (e) {}
      }
      return true;
    }
    return false;
  }

  window.addEventListener('popstate', function () {
    if (openDialogStack.length > 0) {
      closeTopDialog(true);
    }
  });

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(function () { toastEl.classList.remove('show'); }, 2500);
  }

  // Build Payload
  function buildPayload() {
    var d = state.data;
    switch (d.type) {
      case 'url': {
        var u = (d.url || '').trim();
        if (!u) return { payload: 'https://google.com', title: 'https://google.com' };
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        return { payload: u, title: u };
      }
      case 'whatsapp': {
        var code = (d.waCountryCode || '').replace(/\D/g, '');
        var num = (d.waPhone || '').replace(/\D/g, '');
        if (num.startsWith('0')) num = num.substring(1);
        var full = code + num;
        var msg = d.waMessage.trim() ? '?text=' + encodeURIComponent(d.waMessage.trim()) : '';
        return { payload: 'https://wa.me/' + full + msg, title: 'WhatsApp (+' + full + ')' };
      }
      case 'wifi': {
        var esc = function (s) { return (s || '').replace(/([\\;,:"])/g, '\\$1'); };
        var ssid = esc(d.wifiSsid || 'My_WiFi');
        var enc = d.wifiEncryption;
        var pwd = enc === 'nopass' ? '' : esc(d.wifiPassword);
        var hid = d.wifiHidden ? 'true' : 'false';
        return { payload: 'WIFI:S:' + ssid + ';T:' + enc + ';P:' + pwd + ';H:' + hid + ';;', title: 'Wi-Fi: ' + (d.wifiSsid || 'Network') };
      }
      case 'vcard': {
        var fn = ((d.vcardFirstName || '') + ' ' + (d.vcardLastName || '')).trim() || 'John Doe';
        var lines = [
          'BEGIN:VCARD', 'VERSION:3.0',
          'N:' + (d.vcardLastName || '') + ';' + (d.vcardFirstName || '') + ';;;',
          'FN:' + fn
        ];
        if (d.vcardOrg) lines.push('ORG:' + d.vcardOrg);
        if (d.vcardTitle) lines.push('TITLE:' + d.vcardTitle);
        if (d.vcardPhone) lines.push('TEL;TYPE=CELL,VOICE:' + d.vcardPhone);
        if (d.vcardWorkPhone) lines.push('TEL;TYPE=WORK,VOICE:' + d.vcardWorkPhone);
        if (d.vcardEmail) lines.push('EMAIL;TYPE=PREF,INTERNET:' + d.vcardEmail);
        if (d.vcardUrl) lines.push('URL:' + d.vcardUrl);
        if (d.vcardAddress) lines.push('ADR;TYPE=WORK:;;' + d.vcardAddress + ';;;;');
        lines.push('END:VCARD');
        return { payload: lines.join('\n'), title: 'Contact: ' + fn };
      }
      case 'text': {
        var t = (d.text || '').trim();
        return { payload: t || 'Scan me with any camera', title: t ? (t.length > 30 ? t.slice(0, 30) + '...' : t) : 'Text' };
      }
      case 'phone': {
        var p = (d.phone || '').trim();
        return { payload: 'tel:' + p, title: 'Phone: ' + p };
      }
      case 'email': {
        var mail = 'mailto:' + (d.emailTo || '') + '?subject=' + encodeURIComponent(d.emailSubject || '') + '&body=' + encodeURIComponent(d.emailBody || '');
        return { payload: mail, title: 'Email: ' + (d.emailTo || '') };
      }
      case 'sms': {
        var smsNum = (d.smsPhone || '').trim();
        var smsMsg = encodeURIComponent(d.smsMessage || '');
        return { payload: 'smsto:' + smsNum + ':' + smsMsg, title: 'SMS: ' + smsNum };
      }
      case 'location': {
        var geo = 'geo:' + (d.locLatitude || '0') + ',' + (d.locLongitude || '0') + '?q=' + encodeURIComponent(d.locQuery || '');
        return { payload: geo, title: 'Location: ' + (d.locQuery || (d.locLatitude + ',' + d.locLongitude)) };
      }
      default:
        return { payload: 'https://google.com', title: 'https://google.com' };
    }
  }

  function updateQR() {
    if (!canvas || !window.QRRenderer) return;
    var info = buildPayload();
    if (previewTitle) previewTitle.textContent = info.title;

    window.QRRenderer.renderQR(canvas, {
      payload: info.payload,
      style: state.style,
      size: 600
    });
  }

  function renderForm() {
    if (!formContainer) return;
    var d = state.data;
    var html = '';

    if (d.type === 'url') {
      html = '<div class="form-group">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">' +
        '<label class="form-label" style="margin:0;">Website URL</label>' +
        (d.url ? '<a href="' + (d.url.startsWith('http') ? d.url : 'https://' + d.url) + '" target="_blank" rel="noreferrer" style="font-size:0.85rem; color:var(--primary); font-weight:600; text-decoration:none;">Visit Link &rarr;</a>' : '') +
        '</div>' +
        '<input type="url" id="inpUrl" class="form-input" placeholder="https://example.com" value="' + escapeHtml(d.url) + '">' +
        '<div style="display:flex; gap:0.4rem; overflow-x:auto; margin-top:0.6rem; scrollbar-width:none;">' +
        ['.com', '.org', '.net', '.io', '.app', '.co'].map(function (s) {
          return '<button type="button" class="btn-suffix" data-suffix="' + s + '" style="padding:0.4rem 0.75rem; border-radius:8px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-main); font-size:0.85rem; cursor:pointer;">' + s + '</button>';
        }).join('') +
        '</div>' +
        '</div>';
    } else if (d.type === 'whatsapp') {
      html = '<div class="grid-2 form-group">' +
        '<div><label class="form-label">Country Code</label>' +
        '<select id="inpWaCountry" class="form-select">' +
        [['+966', 'Saudi Arabia (+966)'], ['+971', 'UAE (+971)'], ['+1', 'US/Canada (+1)'], ['+44', 'UK (+44)'], ['+49', 'Germany (+49)'], ['+33', 'France (+33)'], ['+20', 'Egypt (+20)']].map(function (c) {
          return '<option value="' + c[0] + '"' + (d.waCountryCode === c[0] ? ' selected' : '') + '>' + c[1] + '</option>';
        }).join('') +
        '</select></div>' +
        '<div><label class="form-label">Phone Number</label>' +
        '<input type="tel" id="inpWaPhone" class="form-input" placeholder="501234567" value="' + escapeHtml(d.waPhone) + '"></div>' +
        '</div>' +
        '<div class="form-group"><label class="form-label">Pre-filled Message</label>' +
        '<textarea id="inpWaMsg" class="form-textarea" rows="3">' + escapeHtml(d.waMessage) + '</textarea></div>';
    } else if (d.type === 'wifi') {
      html = '<div class="form-group"><label class="form-label">Network Name (SSID)</label>' +
        '<input type="text" id="inpWifiSsid" class="form-input" value="' + escapeHtml(d.wifiSsid) + '"></div>' +
        '<div class="grid-2 form-group">' +
        '<div><label class="form-label">Password</label>' +
        '<input type="text" id="inpWifiPass" class="form-input" value="' + escapeHtml(d.wifiPassword) + '"></div>' +
        '<div><label class="form-label">Security</label>' +
        '<select id="inpWifiEnc" class="form-select">' +
        '<option value="WPA"' + (d.wifiEncryption === 'WPA' ? ' selected' : '') + '>WPA/WPA2</option>' +
        '<option value="WEP"' + (d.wifiEncryption === 'WEP' ? ' selected' : '') + '>WEP</option>' +
        '<option value="nopass"' + (d.wifiEncryption === 'nopass' ? ' selected' : '') + '>None (Open)</option>' +
        '</select></div></div>';
    } else if (d.type === 'vcard') {
      html = '<div class="grid-2 form-group">' +
        '<div><label class="form-label">First Name</label><input type="text" id="inpVcardFirst" class="form-input" value="' + escapeHtml(d.vcardFirstName) + '"></div>' +
        '<div><label class="form-label">Last Name</label><input type="text" id="inpVcardLast" class="form-input" value="' + escapeHtml(d.vcardLastName) + '"></div>' +
        '</div>' +
        '<div class="grid-2 form-group">' +
        '<div><label class="form-label">Company</label><input type="text" id="inpVcardOrg" class="form-input" value="' + escapeHtml(d.vcardOrg) + '"></div>' +
        '<div><label class="form-label">Job Title</label><input type="text" id="inpVcardTitle" class="form-input" value="' + escapeHtml(d.vcardTitle) + '"></div>' +
        '</div>' +
        '<div class="grid-2 form-group">' +
        '<div><label class="form-label">Mobile Phone</label><input type="tel" id="inpVcardPhone" class="form-input" value="' + escapeHtml(d.vcardPhone) + '"></div>' +
        '<div><label class="form-label">Email</label><input type="email" id="inpVcardEmail" class="form-input" value="' + escapeHtml(d.vcardEmail) + '"></div>' +
        '</div>' +
        '<div class="form-group"><label class="form-label">Website</label><input type="url" id="inpVcardUrl" class="form-input" value="' + escapeHtml(d.vcardUrl) + '"></div>' +
        '<div class="form-group"><label class="form-label">Address</label><input type="text" id="inpVcardAddress" class="form-input" value="' + escapeHtml(d.vcardAddress) + '"></div>';
    } else if (d.type === 'text') {
      html = '<div class="form-group">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">' +
        '<label class="form-label" style="margin:0;">Plain Text</label>' +
        '<button type="button" id="btnPasteText" style="font-size:0.85rem; color:var(--primary); background:none; border:none; cursor:pointer; font-weight:600;">Paste Clipboard</button>' +
        '</div>' +
        '<textarea id="inpText" class="form-textarea" rows="4">' + escapeHtml(d.text) + '</textarea></div>';
    } else if (d.type === 'phone') {
      html = '<div class="form-group"><label class="form-label">Phone Number</label>' +
        '<input type="tel" id="inpPhone" class="form-input" placeholder="+1234567890" value="' + escapeHtml(d.phone) + '"></div>';
    } else if (d.type === 'email') {
      html = '<div class="form-group"><label class="form-label">Recipient Email</label>' +
        '<input type="email" id="inpEmailTo" class="form-input" placeholder="info@example.com" value="' + escapeHtml(d.emailTo) + '"></div>' +
        '<div class="form-group"><label class="form-label">Subject</label>' +
        '<input type="text" id="inpEmailSubj" class="form-input" value="' + escapeHtml(d.emailSubject) + '"></div>' +
        '<div class="form-group"><label class="form-label">Message</label>' +
        '<textarea id="inpEmailBody" class="form-textarea" rows="3">' + escapeHtml(d.emailBody) + '</textarea></div>';
    } else if (d.type === 'sms') {
      html = '<div class="form-group"><label class="form-label">Recipient Phone</label>' +
        '<input type="tel" id="inpSmsPhone" class="form-input" value="' + escapeHtml(d.smsPhone) + '"></div>' +
        '<div class="form-group"><label class="form-label">SMS Message</label>' +
        '<textarea id="inpSmsMsg" class="form-textarea" rows="3">' + escapeHtml(d.smsMessage) + '</textarea></div>';
    } else if (d.type === 'location') {
      html = '<div class="form-group">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">' +
        '<label class="form-label" style="margin:0;">Coordinates</label>' +
        '<button type="button" id="btnGetLocation" style="font-size:0.85rem; color:var(--primary); background:none; border:none; cursor:pointer; font-weight:600;">Get My Location</button>' +
        '</div>' +
        '<div class="grid-2">' +
        '<input type="text" id="inpLocLat" class="form-input" placeholder="Latitude" value="' + escapeHtml(d.locLatitude) + '">' +
        '<input type="text" id="inpLocLng" class="form-input" placeholder="Longitude" value="' + escapeHtml(d.locLongitude) + '">' +
        '</div></div>' +
        '<div class="form-group"><label class="form-label">Location Name / Query</label>' +
        '<input type="text" id="inpLocQuery" class="form-input" placeholder="e.g. Times Square" value="' + escapeHtml(d.locQuery) + '"></div>';
    }

    formContainer.innerHTML = html;
    attachFormEvents();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function attachFormEvents() {
    var bindInput = function (id, prop) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', function (e) { state.data[prop] = e.target.value; updateQR(); });
    };
    var bindChange = function (id, prop) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', function (e) { state.data[prop] = e.target.value; updateQR(); });
    };

    bindInput('inpUrl', 'url');
    bindInput('inpWaPhone', 'waPhone');
    bindChange('inpWaCountry', 'waCountryCode');
    bindInput('inpWaMsg', 'waMessage');
    bindInput('inpWifiSsid', 'wifiSsid');
    bindInput('inpWifiPass', 'wifiPassword');
    bindChange('inpWifiEnc', 'wifiEncryption');
    bindInput('inpVcardFirst', 'vcardFirstName');
    bindInput('inpVcardLast', 'vcardLastName');
    bindInput('inpVcardOrg', 'vcardOrg');
    bindInput('inpVcardTitle', 'vcardTitle');
    bindInput('inpVcardPhone', 'vcardPhone');
    bindInput('inpVcardEmail', 'vcardEmail');
    bindInput('inpVcardUrl', 'vcardUrl');
    bindInput('inpVcardAddress', 'vcardAddress');
    bindInput('inpText', 'text');
    bindInput('inpPhone', 'phone');
    bindInput('inpEmailTo', 'emailTo');
    bindInput('inpEmailSubj', 'emailSubject');
    bindInput('inpEmailBody', 'emailBody');
    bindInput('inpSmsPhone', 'smsPhone');
    bindInput('inpSmsMsg', 'smsMessage');
    bindInput('inpLocLat', 'locLatitude');
    bindInput('inpLocLng', 'locLongitude');
    bindInput('inpLocQuery', 'locQuery');

    // Suffix shortcuts for URL
    var suffixBtns = document.querySelectorAll('.btn-suffix');
    suffixBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = btn.getAttribute('data-suffix');
        var cur = state.data.url.trim();
        if (!cur.endsWith(s)) {
          state.data.url = cur + s;
          var inp = document.getElementById('inpUrl');
          if (inp) inp.value = state.data.url;
          updateQR();
        }
      });
    });

    // Paste Text
    var btnPaste = document.getElementById('btnPasteText');
    if (btnPaste) {
      btnPaste.addEventListener('click', function () {
        if (!navigator.clipboard) return;
        navigator.clipboard.readText().then(function (clip) {
          if (clip) {
            state.data.text = state.data.text ? state.data.text + ' ' + clip : clip;
            var inp = document.getElementById('inpText');
            if (inp) inp.value = state.data.text;
            updateQR();
            showToast('Pasted text from clipboard');
          }
        }).catch(function () {});
      });
    }

    // Geolocation
    var btnLoc = document.getElementById('btnGetLocation');
    if (btnLoc) {
      btnLoc.addEventListener('click', function () {
        if (!navigator.geolocation) {
          showToast('Geolocation not supported');
          return;
        }
        showToast('Getting location...');
        navigator.geolocation.getCurrentPosition(function (pos) {
          state.data.locLatitude = pos.coords.latitude.toFixed(6);
          state.data.locLongitude = pos.coords.longitude.toFixed(6);
          var latInp = document.getElementById('inpLocLat');
          var lngInp = document.getElementById('inpLocLng');
          if (latInp) latInp.value = state.data.locLatitude;
          if (lngInp) lngInp.value = state.data.locLongitude;
          updateQR();
          showToast('Location updated');
        }, function () {
          showToast('Failed to retrieve location');
        }, { timeout: 8000 });
      });
    }
  }

  // Type Selector Events
  typeButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      typeButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      state.data.type = btn.getAttribute('data-type');
      renderForm();
      updateQR();
    });
  });

  // Style Customizer Controls
  var dotBtns = document.querySelectorAll('.dot-btn');
  dotBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      dotBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      state.style.dotStyle = btn.getAttribute('data-dot');
      updateQR();
    });
  });

  var logoBtns = document.querySelectorAll('.logo-btn');
  logoBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      logoBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      state.style.logoType = btn.getAttribute('data-logo');
      updateQR();
    });
  });

  var customLogoInput = document.getElementById('customLogoInput');
  var customLogoName = document.getElementById('customLogoName');
  if (customLogoInput) {
    customLogoInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (customLogoName) customLogoName.textContent = file.name;
      var reader = new FileReader();
      reader.onload = function () {
        state.style.customLogoUrl = reader.result;
        state.style.logoType = 'custom';
        logoBtns.forEach(function (b) { b.classList.remove('active'); });
        updateQR();
        showToast('Custom logo applied');
      };
      reader.readAsDataURL(file);
    });
  }

  var frameSelect = document.getElementById('frameSelect');
  var frameTextInput = document.getElementById('frameTextInput');
  var frameTextGroup = document.getElementById('frameTextGroup');

  if (frameSelect) {
    frameSelect.addEventListener('change', function (e) {
      state.style.frameStyle = e.target.value;
      if (frameTextGroup) {
        frameTextGroup.style.display = e.target.value === 'none' ? 'none' : 'block';
      }
      updateQR();
    });
  }

  if (frameTextInput) {
    frameTextInput.addEventListener('input', function (e) {
      state.style.frameText = e.target.value;
      updateQR();
    });
  }

  // Color Picker Dialog Management
  var colorPickerModal = document.getElementById('colorPickerModal');
  var colorPickerTitle = document.getElementById('colorPickerTitle');
  var colorPickerCloseBtn = document.getElementById('colorPickerCloseBtn');
  var colorPickerCancelBtn = document.getElementById('colorPickerCancelBtn');
  var colorPickerApplyBtn = document.getElementById('colorPickerApplyBtn');
  var colorSatVal = document.getElementById('colorSatVal');
  var colorPointer = document.getElementById('colorPointer');
  var colorHueSlider = document.getElementById('colorHueSlider');
  var colorHexInput = document.getElementById('colorHexInput');
  var modalColorPreview = document.getElementById('modalColorPreview');

  var btnOpenFgColor = document.getElementById('btnOpenFgColor');
  var btnOpenBgColor = document.getElementById('btnOpenBgColor');
  var fgColorPreview = document.getElementById('fgColorPreview');
  var fgColorText = document.getElementById('fgColorText');
  var bgColorPreview = document.getElementById('bgColorPreview');
  var bgColorText = document.getElementById('bgColorText');

  var activeColorTarget = 'fg'; // 'fg' or 'bg'
  var curHue = 220;
  var curSat = 1;
  var curVal = 0.9;
  var curHex = '#2563EB';

  function hsvToRgb(h, s, v) {
    var c = v * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = v - c;
    var r = 0, g = 0, b = 0;
    if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
    else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
    else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
    else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
    else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
    else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255)
    ];
  }

  function rgbToHex(r, g, b) {
    var toHex = function (n) {
      var h = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return h.length === 1 ? '0' + h : h;
    };
    return ('#' + toHex(r) + toHex(g) + toHex(b)).toUpperCase();
  }

  function hexToHsv(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var num = parseInt(hex, 16);
    if (isNaN(num)) return { h: 0, s: 1, v: 1 };
    var r = (num >> 16) / 255;
    var g = ((num >> 8) & 255) / 255;
    var b = (num & 255) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var d = max - min;
    var h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }
    var s = max === 0 ? 0 : d / max;
    var v = max;
    return { h: h, s: s, v: v };
  }

  function syncColorUI() {
    var rgb = hsvToRgb(curHue, curSat, curVal);
    curHex = rgbToHex(rgb[0], rgb[1], rgb[2]);

    if (modalColorPreview) modalColorPreview.style.backgroundColor = curHex;
    if (colorHexInput) colorHexInput.value = curHex;

    var pureHueRgb = hsvToRgb(curHue, 1, 1);
    var pureHueHex = rgbToHex(pureHueRgb[0], pureHueRgb[1], pureHueRgb[2]);
    if (colorSatVal) colorSatVal.style.backgroundColor = pureHueHex;

    if (colorPointer) {
      colorPointer.style.left = (curSat * 100) + '%';
      colorPointer.style.top = ((1 - curVal) * 100) + '%';
    }
    if (colorHueSlider) colorHueSlider.value = curHue;
  }

  function openColorPicker(target) {
    activeColorTarget = target;
    var initHex = target === 'fg' ? state.style.fgColor : state.style.bgColor;
    if (colorPickerTitle) {
      colorPickerTitle.textContent = target === 'fg' ? 'Choose QR Color' : 'Choose Background Color';
    }

    var hsv = hexToHsv(initHex);
    curHue = hsv.h;
    curSat = hsv.s;
    curVal = hsv.v;
    curHex = initHex.toUpperCase();

    syncColorUI();
    openDialog(colorPickerModal, function () {
      if (colorPickerModal) colorPickerModal.classList.remove('open');
    });
  }

  if (btnOpenFgColor) btnOpenFgColor.addEventListener('click', function () { openColorPicker('fg'); });
  if (btnOpenBgColor) btnOpenBgColor.addEventListener('click', function () { openColorPicker('bg'); });

  if (colorPickerCloseBtn) {
    colorPickerCloseBtn.addEventListener('click', function () {
      if (colorPickerModal && colorPickerModal.classList.contains('open')) closeTopDialog();
    });
  }
  if (colorPickerCancelBtn) {
    colorPickerCancelBtn.addEventListener('click', function () {
      if (colorPickerModal && colorPickerModal.classList.contains('open')) closeTopDialog();
    });
  }

  if (colorPickerApplyBtn) {
    colorPickerApplyBtn.addEventListener('click', function () {
      if (activeColorTarget === 'fg') {
        state.style.fgColor = curHex;
        if (fgColorPreview) fgColorPreview.style.backgroundColor = curHex;
        if (fgColorText) fgColorText.textContent = curHex;
      } else {
        state.style.bgColor = curHex;
        if (bgColorPreview) bgColorPreview.style.backgroundColor = curHex;
        if (bgColorText) bgColorText.textContent = curHex;
      }
      updateQR();
      if (colorPickerModal && colorPickerModal.classList.contains('open')) closeTopDialog();
    });
  }

  // Hue Slider Input
  if (colorHueSlider) {
    colorHueSlider.addEventListener('input', function (e) {
      curHue = parseInt(e.target.value, 10);
      syncColorUI();
    });
  }

  // Saturation / Value interactive touch & drag
  function updateSatValFromEvent(e) {
    if (!colorSatVal) return;
    var rect = colorSatVal.getBoundingClientRect();
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    var x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    var y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    curSat = x / rect.width;
    curVal = 1 - (y / rect.height);
    syncColorUI();
  }

  var isDraggingSatVal = false;
  if (colorSatVal) {
    colorSatVal.addEventListener('mousedown', function (e) {
      isDraggingSatVal = true;
      updateSatValFromEvent(e);
    });
    window.addEventListener('mousemove', function (e) {
      if (isDraggingSatVal) updateSatValFromEvent(e);
    });
    window.addEventListener('mouseup', function () { isDraggingSatVal = false; });

    colorSatVal.addEventListener('touchstart', function (e) {
      isDraggingSatVal = true;
      updateSatValFromEvent(e);
    }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      if (isDraggingSatVal) updateSatValFromEvent(e);
    }, { passive: true });
    window.addEventListener('touchend', function () { isDraggingSatVal = false; });
  }

  // HEX Input change
  if (colorHexInput) {
    colorHexInput.addEventListener('input', function (e) {
      var val = e.target.value.trim();
      if (/^#?[0-9A-Fa-f]{6}$/.test(val)) {
        if (!val.startsWith('#')) val = '#' + val;
        var hsv = hexToHsv(val);
        curHue = hsv.h;
        curSat = hsv.s;
        curVal = hsv.v;
        curHex = val.toUpperCase();
        syncColorUI();
      }
    });
  }

  // Preset modal swatches
  var paletteBtns = document.querySelectorAll('.color-palette-btn');
  paletteBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var col = btn.getAttribute('data-color');
      if (col) {
        var hsv = hexToHsv(col);
        curHue = hsv.h;
        curSat = hsv.s;
        curVal = hsv.v;
        curHex = col.toUpperCase();
        syncColorUI();
      }
    });
  });

  // Quick preset swatches from main form
  var swatches = document.querySelectorAll('.color-swatch');
  swatches.forEach(function (swatch) {
    swatch.addEventListener('click', function () {
      var col = swatch.getAttribute('data-color');
      if (col) {
        state.style.fgColor = col;
        if (fgColorPreview) fgColorPreview.style.backgroundColor = col;
        if (fgColorText) fgColorText.textContent = col.toUpperCase();
        updateQR();
      }
    });
  });

  var eclSelect = document.getElementById('eclSelect');
  if (eclSelect) {
    eclSelect.addEventListener('change', function (e) {
      state.style.errorCorrection = e.target.value;
      updateQR();
    });
  }

  // Action Buttons
  var btnDownload = document.getElementById('btnDownload');
  if (btnDownload) {
    btnDownload.addEventListener('click', function () {
      if (!canvas) return;
      var a = document.createElement('a');
      a.download = 'qrcode-' + Date.now() + '.png';
      a.href = canvas.toDataURL('image/png');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Downloading PNG...');
      saveHistory();
    });
  }

  var btnDownloadSvg = document.getElementById('btnDownloadSvg');
  if (btnDownloadSvg) {
    btnDownloadSvg.addEventListener('click', function () {
      var info = buildPayload();
      var svgStr = window.QRRenderer.exportSvg({ payload: info.payload, style: state.style });
      var blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.download = 'qrcode-' + Date.now() + '.svg';
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      showToast('Downloading SVG...');
      saveHistory();
    });
  }

  var btnCopy = document.getElementById('btnCopy');
  if (btnCopy) {
    btnCopy.addEventListener('click', function () {
      if (!canvas) return;
      canvas.toBlob(function (blob) {
        if (!blob) return;
        try {
          var item = new ClipboardItem({ 'image/png': blob });
          navigator.clipboard.write([item]).then(function () {
            showToast('Copied QR to clipboard');
            saveHistory();
          }).catch(function () {
            showToast('Copy not allowed by browser');
          });
        } catch (e) {
          showToast('Clipboard API not supported');
        }
      });
    });
  }

  // History Back Button Dialog Close Management
  var openDialogStack = [];

  function openDialog(element, closeCallback) {
    if (!element) return;
    element.classList.add('open');
    openDialogStack.push({ element: element, close: closeCallback });
    try {
      history.pushState({ dialogOpen: true }, '');
    } catch (e) {}
  }

  function closeTopDialog(fromPopstate) {
    if (openDialogStack.length > 0) {
      var item = openDialogStack.pop();
      if (item) {
        if (typeof item.close === 'function') {
          item.close();
        } else if (item.element) {
          item.element.classList.remove('open');
        }
      }
      if (!fromPopstate) {
        try {
          history.back();
        } catch (e) {}
      }
      return true;
    }
    return false;
  }

  window.addEventListener('popstate', function () {
    if (openDialogStack.length > 0) {
      closeTopDialog(true);
    }
  });

  // Custom Dialog Helper
  var confirmModal = document.getElementById('confirmModal');
  var confirmTitle = document.getElementById('confirmTitle');
  var confirmMessage = document.getElementById('confirmMessage');
  var confirmOkBtn = document.getElementById('confirmOkBtn');
  var confirmCancelBtn = document.getElementById('confirmCancelBtn');
  var pendingConfirmAction = null;

  function showConfirmDialog(title, message, onConfirm) {
    if (confirmTitle) confirmTitle.textContent = title;
    if (confirmMessage) confirmMessage.textContent = message;
    pendingConfirmAction = onConfirm;
    openDialog(confirmModal, function () {
      if (confirmModal) confirmModal.classList.remove('open');
      pendingConfirmAction = null;
    });
  }

  if (confirmOkBtn) {
    confirmOkBtn.addEventListener('click', function () {
      if (confirmModal && confirmModal.classList.contains('open')) {
        closeTopDialog();
      }
      if (typeof pendingConfirmAction === 'function') {
        pendingConfirmAction();
        pendingConfirmAction = null;
      }
    });
  }
  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', function () {
      if (confirmModal && confirmModal.classList.contains('open')) {
        closeTopDialog();
      }
    });
  }

  // Print Modal Logic
  var printModal = document.getElementById('printModal');
  var printModalCloseBtn = document.getElementById('printModalCloseBtn');
  var confirmPrintBtn = document.getElementById('confirmPrintBtn');
  var printPreviewCanvas = document.getElementById('printPreviewCanvas');
  var printSheetTitle = document.getElementById('printSheetTitle');

  var btnPrint = document.getElementById('btnPrint');
  if (btnPrint) {
    btnPrint.addEventListener('click', function () {
      if (!canvas || !printModal || !printPreviewCanvas) return;
      var info = buildPayload();
      printPreviewCanvas.width = canvas.width;
      printPreviewCanvas.height = canvas.height;
      var pctx = printPreviewCanvas.getContext('2d');
      if (pctx) {
        pctx.drawImage(canvas, 0, 0);
      }
      if (printSheetTitle) printSheetTitle.textContent = info.title;
      openDialog(printModal, function () {
        if (printModal) printModal.classList.remove('open');
      });
    });
  }

  if (printModalCloseBtn) {
    printModalCloseBtn.addEventListener('click', function () {
      if (printModal && printModal.classList.contains('open')) closeTopDialog();
    });
  }

  if (confirmPrintBtn) {
    confirmPrintBtn.addEventListener('click', function () {
      if (printModal && printModal.classList.contains('open')) closeTopDialog();
      setTimeout(function () { window.print(); }, 200);
    });
  }

  // Generic modal close buttons
  var closeTriggers = document.querySelectorAll('.modal-close-trigger');
  closeTriggers.forEach(function (btn) {
    btn.addEventListener('click', function () {
      closeTopDialog();
    });
  });

  // Close modals when clicking overlay backdrop
  var customModals = document.querySelectorAll('.custom-modal');
  customModals.forEach(function (m) {
    m.addEventListener('click', function (e) {
      if (e.target === m) {
        closeTopDialog();
      }
    });
  });

  // History Drawer Logic
  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]');
    } catch (e) { return []; }
  }

  function saveHistory() {
    try {
      var list = getHistory();
      var info = buildPayload();
      var item = {
        id: Date.now().toString(),
        type: state.data.type,
        title: info.title,
        payload: info.payload,
        date: new Date().toLocaleDateString(),
        preview: canvas.toDataURL('image/png')
      };
      list.unshift(item);
      if (list.length > 20) list.pop();
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(list));
      renderHistoryList();
    } catch (e) {}
  }

  var drawerBackdrop = document.getElementById('drawerBackdrop');
  var historyDrawer = document.getElementById('historyDrawer');
  var historyList = document.getElementById('historyList');
  var historyOpenBtn = document.getElementById('historyOpenBtn');
  var historyCloseBtn = document.getElementById('historyCloseBtn');
  var clearHistoryBtn = document.getElementById('clearHistoryBtn');

  function openHistoryDrawer() {
    renderHistoryList();
    if (drawerBackdrop) drawerBackdrop.classList.add('open');
    openDialog(historyDrawer, function () {
      if (historyDrawer) historyDrawer.classList.remove('open');
      if (drawerBackdrop) drawerBackdrop.classList.remove('open');
    });
  }

  function closeHistoryDrawer() {
    if (historyDrawer && historyDrawer.classList.contains('open')) {
      closeTopDialog();
    }
  }

  function renderHistoryList() {
    if (!historyList) return;
    var list = getHistory();
    if (!list.length) {
      historyList.innerHTML = '<div style="text-align:center; padding:3rem 1rem; color:var(--text-muted); font-size:0.95rem;">No saved QR codes yet.</div>';
      return;
    }
    historyList.innerHTML = list.map(function (item) {
      return '<div class="history-item" style="display:flex; align-items:center; gap:0.75rem; padding:0.85rem; border-radius:14px; border:1px solid var(--border); margin-bottom:0.75rem; background:var(--bg-card); box-shadow:var(--shadow-sm);">' +
        '<img src="' + item.preview + '" style="width:54px; height:54px; border-radius:10px; border:1px solid var(--border); background:white; object-fit:contain;">' +
        '<div style="flex:1; min-width:0;">' +
        '<div style="font-weight:600; font-size:0.95rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + escapeHtml(item.title) + '</div>' +
        '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">' + escapeHtml(item.date) + ' • ' + escapeHtml(item.type.toUpperCase()) + '</div>' +
        '</div>' +
        '<button type="button" class="btn-restore-history btn btn-outline" data-payload="' + escapeHtml(item.payload) + '" style="padding:0.4rem 0.85rem; min-height:36px; font-size:0.85rem;">Use</button>' +
        '</div>';
    }).join('');

    var restoreBtns = historyList.querySelectorAll('.btn-restore-history');
    restoreBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var payload = btn.getAttribute('data-payload');
        state.data.type = 'text';
        state.data.text = payload;
        typeButtons.forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-type') === 'text');
        });
        renderForm();
        updateQR();
        closeHistoryDrawer();
        showToast('Restored QR code');
      });
    });
  }

  if (historyOpenBtn) historyOpenBtn.addEventListener('click', openHistoryDrawer);
  if (historyCloseBtn) historyCloseBtn.addEventListener('click', closeHistoryDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeHistoryDrawer);

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', function () {
      showConfirmDialog('Clear History', 'Are you sure you want to delete all saved QR codes?', function () {
        localStorage.removeItem(STORAGE_HISTORY);
        renderHistoryList();
        showToast('History cleared');
      });
    });
  }

  // Scanner Modal
  var scannerModal = document.getElementById('scannerModal');
  var scannerOpenBtn = document.getElementById('scannerOpenBtn');
  var scannerCloseBtn = document.getElementById('scannerCloseBtn');
  var scanFileInput = document.getElementById('scanFileInput');

  if (scannerOpenBtn) {
    scannerOpenBtn.addEventListener('click', function () {
      openDialog(scannerModal, function () {
        if (scannerModal) scannerModal.classList.remove('open');
      });
    });
  }
  if (scannerCloseBtn) {
    scannerCloseBtn.addEventListener('click', function () {
      if (scannerModal && scannerModal.classList.contains('open')) closeTopDialog();
    });
  }

  if (scanFileInput) {
    scanFileInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (window.BarcodeDetector) {
        var detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        createImageBitmap(file).then(function (bitmap) {
          return detector.detect(bitmap);
        }).then(function (barcodes) {
          if (barcodes.length > 0) {
            handleScannedResult(barcodes[0].rawValue);
          } else {
            showToast('No QR code detected in image');
          }
        }).catch(function () {
          showToast('Could not scan image');
        });
      } else {
        showToast('Scanner not supported by this browser');
      }
    });
  }

  function handleScannedResult(raw) {
    state.data.type = 'text';
    state.data.text = raw;
    typeButtons.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-type') === 'text');
    });
    renderForm();
    updateQR();
    if (scannerModal) scannerModal.classList.remove('open');
    showToast('Scanned QR successfully');
  }

  // Theme Management
  var mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      var prefersDark = mediaQuery ? mediaQuery.matches : false;
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }

  var savedTheme = null;
  try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) {}
  applyTheme(savedTheme);

  if (mediaQuery) {
    var onSystemThemeChange = function () {
      try {
        if (!localStorage.getItem(THEME_KEY)) applyTheme(null);
      } catch (e) {}
    };
    if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', onSystemThemeChange);
    else if (mediaQuery.addListener) mediaQuery.addListener(onSystemThemeChange);
  }

  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var isDark = document.documentElement.classList.contains('dark');
      var newTheme = isDark ? 'light' : 'dark';
      applyTheme(newTheme);
      try { localStorage.setItem(THEME_KEY, newTheme); } catch (e) {}
    });
  }

  // Initialize
  renderForm();
  updateQR();
});
