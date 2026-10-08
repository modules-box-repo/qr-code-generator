// Handles QR code rendering to canvas and SVG with styles, frames, dots, and logos

(function (global) {
  'use strict';

  var BUILTIN_LOGOS = {
    whatsapp: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="%2325D366"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>',
    wifi: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%233b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M1.5 9.288a15 15 0 0 1 21 0"/></svg>',
    globe: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%236366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    phone: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2310b981"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    star: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
  };

  function isCornerFinder(r, c, count) {
    if (r < 7 && c < 7) return true;
    if (r < 7 && c >= count - 7) return true;
    if (r >= count - 7 && c < 7) return true;
    return false;
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Failed to load image')); };
      img.src = src;
    });
  }

  function renderQR(canvas, options) {
    return new Promise(function (resolve) {
      var payload = options.payload;
      var style = options.style || {};
      var size = options.size || 600;

      var fgColor = style.fgColor || '#000000';
      var bgColor = style.bgColor || '#ffffff';
      var dotStyle = style.dotStyle || 'square';
      var frameStyle = style.frameStyle || 'none';
      var frameText = style.frameText || 'SCAN ME';
      var frameColor = style.frameColor || fgColor;
      var logoType = style.logoType || 'none';
      var customLogoUrl = style.customLogoUrl;
      var logoSize = style.logoSize || 22;
      var logoBgWhite = style.logoBgWhite !== false;
      var ecl = style.errorCorrection || 'H';

      // Always elevate ecl if logo is present
      if (logoType !== 'none') ecl = 'H';

      var qr = global.QRGenerator.createQR(payload, ecl);
      var count = qr.getModuleCount();

      // Top/bottom banner offsets
      var hasTopBanner = frameStyle === 'simple-top';
      var hasBottomBanner = frameStyle === 'simple-bottom';
      var bannerHeight = (hasTopBanner || hasBottomBanner) ? Math.round(size * 0.16) : 0;

      var totalHeight = size + bannerHeight;
      canvas.width = size;
      canvas.height = totalHeight;

      var ctx = canvas.getContext('2d');
      if (!ctx) return resolve();

      // Fill background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, totalHeight);

      var qrOffsetY = hasTopBanner ? bannerHeight : 0;
      var margin = Math.round(size * 0.08);
      var innerSize = size - margin * 2;
      var cellSize = innerSize / count;

      // Draw modules
      ctx.fillStyle = fgColor;

      for (var r = 0; r < count; r++) {
        for (var c = 0; c < count; c++) {
          if (!qr.isDark(r, c)) continue;

          var x = margin + c * cellSize;
          var y = qrOffsetY + margin + r * cellSize;
          var inFinder = isCornerFinder(r, c, count);

          if (inFinder || dotStyle === 'square') {
            ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(cellSize), Math.ceil(cellSize));
          } else if (dotStyle === 'dots') {
            var rad = cellSize * 0.44;
            ctx.beginPath();
            ctx.arc(x + cellSize / 2, y + cellSize / 2, rad, 0, Math.PI * 2);
            ctx.fill();
          } else if (dotStyle === 'rounded') {
            var rRad = cellSize * 0.28;
            drawRoundRect(ctx, x, y, cellSize, cellSize, rRad);
            ctx.fill();
          }
        }
      }

      // Draw Frame Banner if requested
      if (hasTopBanner || hasBottomBanner) {
        var bannerY = hasTopBanner ? 0 : size;
        ctx.fillStyle = frameColor;
        ctx.fillRect(0, bannerY, size, bannerHeight);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold ' + Math.round(bannerHeight * 0.42) + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(frameText.toUpperCase(), size / 2, bannerY + bannerHeight / 2);
      }

      // Draw Logo
      var logoSrc = logoType === 'custom' ? customLogoUrl : BUILTIN_LOGOS[logoType];
      if (logoSrc) {
        loadImage(logoSrc).then(function (img) {
          var logoPx = (innerSize * (logoSize / 100));
          var logoX = (size - logoPx) / 2;
          var logoY = qrOffsetY + (size - logoPx) / 2;

          if (logoBgWhite) {
            var pad = logoPx * 0.14;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            drawRoundRect(ctx, logoX - pad, logoY - pad, logoPx + pad * 2, logoPx + pad * 2, pad * 1.5);
            ctx.fill();
          }

          ctx.drawImage(img, logoX, logoY, logoPx, logoPx);
          resolve();
        }).catch(function () {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  function drawRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function exportSvg(options) {
    var payload = options.payload;
    var style = options.style || {};
    var fgColor = style.fgColor || '#000000';
    var bgColor = style.bgColor || '#ffffff';
    var ecl = style.errorCorrection || 'H';

    var qr = global.QRGenerator.createQR(payload, ecl);
    var count = qr.getModuleCount();
    var margin = 4;
    var totalCount = count + margin * 2;

    var svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + totalCount + ' ' + totalCount + '" shape-rendering="crispEdges">'];
    svg.push('<rect width="100%" height="100%" fill="' + bgColor + '"/>');
    svg.push('<path fill="' + fgColor + '" d="');

    var d = '';
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          d += 'M' + (c + margin) + ' ' + (r + margin) + 'h1v1h-1z ';
        }
      }
    }
    svg.push(d + '"/>');
    svg.push('</svg>');
    return svg.join('');
  }

  global.QRRenderer = {
    renderQR: renderQR,
    exportSvg: exportSvg,
    BUILTIN_LOGOS: BUILTIN_LOGOS
  };
})(typeof window !== 'undefined' ? window : this);
