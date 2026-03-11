/**
 * CinqCentral Widget v2 — Ticket Creation Widget
 * Standalone IIFE — no build step required
 */
(function () {
  "use strict";

  if (!window.CinqConfig || !window.CinqConfig.token) {
    console.error("CinqCentral Widget: Missing CinqConfig.token");
    return;
  }

  var config = window.CinqConfig;

  // Auto-detect API URL from script src
  var API_URL =
    config.apiUrl ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      for (var i = 0; i < scripts.length; i++) {
        if (scripts[i].src && scripts[i].src.indexOf("widget.js") !== -1) {
          try {
            var url = new URL(scripts[i].src);
            return url.origin + "/api/widget/tickets";
          } catch (e) {}
        }
      }
      return "https://app.cinqteam.com/api/widget/tickets";
    })();

  // ── Shadow DOM ─────────────────────────────────────────────
  var host = document.createElement("div");
  host.id = "cinq-widget-host";
  host.style.cssText =
    "position:fixed;z-index:999999;font-family:system-ui,-apple-system,sans-serif;";
  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: "closed" });

  // ── Styles ─────────────────────────────────────────────────
  var style = document.createElement("style");
  style.textContent =
    "*{box-sizing:border-box;margin:0;padding:0}" +
    /* Floating button */
    ".cw-btn{position:fixed;top:50%;right:-62px;transform:translateY(-50%) rotate(-90deg);width:160px;height:40px;" +
    "background:linear-gradient(135deg,#3b82f6,#2563eb);border:none;border-radius:8px 8px 0 0;cursor:pointer;" +
    "box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;gap:6px;" +
    "transition:all .3s ease;z-index:1000000}" +
    ".cw-btn:hover{right:-58px;box-shadow:0 6px 16px rgba(0,0,0,.4)}" +
    ".cw-btn svg{width:16px;height:16px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ".cw-btn span{color:#fff;font-size:13px;font-weight:600;letter-spacing:.3px;white-space:nowrap}" +
    /* Overlay */
    ".cw-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;align-items:center;justify-content:center;" +
    "z-index:1000001;animation:cwFade .2s ease}" +
    ".cw-overlay.open{display:flex}" +
    "@keyframes cwFade{from{opacity:0}to{opacity:1}}" +
    /* Modal */
    ".cw-modal{background:#18181b;border:1px solid #27272a;border-radius:12px;width:90%;max-width:440px;" +
    "max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.5);animation:cwSlide .3s ease}" +
    "@keyframes cwSlide{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}" +
    /* Header */
    ".cw-header{padding:16px 20px;border-bottom:1px solid #27272a;display:flex;justify-content:space-between;align-items:center}" +
    ".cw-title{font-size:16px;font-weight:600;color:#f4f4f5}" +
    ".cw-close{background:none;border:none;color:#a1a1aa;cursor:pointer;font-size:20px;width:28px;height:28px;" +
    "display:flex;align-items:center;justify-content:center;border-radius:6px;transition:all .2s}" +
    ".cw-close:hover{background:#27272a;color:#f4f4f5}" +
    /* Body */
    ".cw-body{padding:20px}" +
    /* Form */
    ".cw-group{margin-bottom:16px}" +
    ".cw-label{display:block;font-size:13px;font-weight:500;color:#d4d4d8;margin-bottom:6px}" +
    ".cw-required{color:#f87171}" +
    ".cw-input,.cw-textarea{width:100%;padding:10px 12px;background:#27272a;border:1px solid #3f3f46;border-radius:8px;" +
    "color:#f4f4f5;font-size:14px;font-family:inherit;transition:border-color .2s;outline:none}" +
    ".cw-input:focus,.cw-textarea:focus{border-color:#3b82f6}" +
    ".cw-textarea{min-height:100px;resize:vertical}" +
    ".cw-input::placeholder,.cw-textarea::placeholder{color:#71717a}" +
    /* File */
    ".cw-file-zone{border:1px dashed #3f3f46;border-radius:8px;padding:12px;text-align:center;cursor:pointer;transition:border-color .2s}" +
    ".cw-file-zone:hover{border-color:#3b82f6}" +
    ".cw-file-zone input{display:none}" +
    ".cw-file-text{font-size:13px;color:#a1a1aa}" +
    ".cw-file-name{font-size:12px;color:#3b82f6;margin-top:4px}" +
    /* Submit */
    ".cw-submit{width:100%;padding:10px;background:linear-gradient(135deg,#3b82f6,#2563eb);border:none;border-radius:8px;" +
    "color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;" +
    "justify-content:center;gap:8px}" +
    ".cw-submit:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px rgba(59,130,246,.4)}" +
    ".cw-submit:disabled{opacity:.6;cursor:not-allowed}" +
    /* Spinner */
    ".cw-spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;" +
    "animation:cwSpin .6s linear infinite}" +
    "@keyframes cwSpin{to{transform:rotate(360deg)}}" +
    /* Error */
    ".cw-error{background:#7f1d1d;border:1px solid #991b1b;color:#fca5a5;padding:10px 12px;border-radius:8px;" +
    "font-size:13px;margin-bottom:16px}" +
    /* Success */
    ".cw-success{text-align:center;padding:32px 20px}" +
    ".cw-check{width:56px;height:56px;margin:0 auto 16px;background:#10b981;border-radius:50%;display:flex;" +
    "align-items:center;justify-content:center}" +
    ".cw-check svg{width:28px;height:28px;fill:#fff}" +
    ".cw-success-title{font-size:16px;font-weight:600;color:#f4f4f5;margin-bottom:6px}" +
    ".cw-success-msg{font-size:13px;color:#a1a1aa}" +
    /* Responsive */
    "@media(max-width:640px){.cw-modal{width:95%;max-width:none;border-radius:12px 12px 0 0;position:fixed;bottom:0;" +
    "animation:cwSlideUp .3s ease}@keyframes cwSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}}";
  shadow.appendChild(style);

  // ── Floating Button ────────────────────────────────────────
  var btn = document.createElement("button");
  btn.className = "cw-btn";
  btn.setAttribute("aria-label", "Ouvrir un ticket");
  btn.innerHTML =
    '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
    "<span>Feedback</span>";
  shadow.appendChild(btn);

  // ── Modal ──────────────────────────────────────────────────
  var overlay = document.createElement("div");
  overlay.className = "cw-overlay";

  var modal = document.createElement("div");
  modal.className = "cw-modal";
  modal.innerHTML =
    '<div class="cw-header">' +
    '<h2 class="cw-title">Envoyer un feedback</h2>' +
    '<button class="cw-close" aria-label="Fermer">&times;</button>' +
    "</div>" +
    '<div class="cw-body">' +
    '<form id="cw-form">' +
    '<div id="cw-error"></div>' +
    '<div class="cw-group">' +
    '<label class="cw-label">Sujet <span class="cw-required">*</span></label>' +
    '<input type="text" id="cw-subject" class="cw-input" required placeholder="Décrivez brièvement votre demande"/>' +
    "</div>" +
    '<div class="cw-group">' +
    '<label class="cw-label">Message <span class="cw-required">*</span></label>' +
    '<textarea id="cw-message" class="cw-textarea" required placeholder="Détaillez votre demande..."></textarea>' +
    "</div>" +
    '<div class="cw-group">' +
    '<label class="cw-label">Email</label>' +
    '<input type="email" id="cw-email" class="cw-input" placeholder="votre@email.com"/>' +
    "</div>" +
    '<div class="cw-group">' +
    '<div class="cw-file-zone" id="cw-drop">' +
    '<input type="file" id="cw-file" accept="image/*,.pdf,.doc,.docx,.zip"/>' +
    '<p class="cw-file-text">Cliquez ou glissez un fichier ici</p>' +
    '<p class="cw-file-text" style="font-size:11px;margin-top:2px">Max 10 MB</p>' +
    '<p class="cw-file-name" id="cw-fname"></p>' +
    "</div>" +
    "</div>" +
    '<button type="submit" class="cw-submit" id="cw-btn-submit">Envoyer</button>' +
    "</form>" +
    "</div>";

  overlay.appendChild(modal);
  shadow.appendChild(overlay);

  // ── State ──────────────────────────────────────────────────
  var isOpen = false;
  var formHTML = modal.querySelector(".cw-body").innerHTML;

  // ── Refs ───────────────────────────────────────────────────
  var closeBtn = modal.querySelector(".cw-close");

  // ── Helpers ────────────────────────────────────────────────
  function getBrowser() {
    var ua = navigator.userAgent;
    if (ua.indexOf("Firefox") > -1) return "Firefox";
    if (ua.indexOf("Edg") > -1) return "Edge";
    if (ua.indexOf("Chrome") > -1) return "Chrome";
    if (ua.indexOf("Safari") > -1) return "Safari";
    if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) return "Opera";
    return "Unknown";
  }

  function escapeHtml(t) {
    var d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
  }

  // ── Open / Close ───────────────────────────────────────────
  function open() {
    isOpen = true;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    var subjectInput = shadow.getElementById("cw-subject");
    if (subjectInput) setTimeout(function(){ subjectInput.focus(); }, 100);
  }

  function close() {
    isOpen = false;
    overlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  function resetForm() {
    modal.querySelector(".cw-body").innerHTML = formHTML;
    attachFormListeners();
  }

  function showSuccess() {
    var body = modal.querySelector(".cw-body");
    body.innerHTML =
      '<div class="cw-success">' +
      '<div class="cw-check"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>' +
      '<div class="cw-success-title">Ticket envoyé !</div>' +
      '<div class="cw-success-msg">Nous vous répondrons dans les plus brefs délais.</div>' +
      "</div>";

    setTimeout(function () {
      close();
      resetForm();
    }, 3000);
  }

  function showError(msg) {
    var el = shadow.getElementById("cw-error");
    if (el) el.innerHTML = '<div class="cw-error">' + escapeHtml(msg) + "</div>";
  }

  // ── Form Submit ────────────────────────────────────────────
  function handleSubmit(e) {
    e.preventDefault();
    var subject = shadow.getElementById("cw-subject").value.trim();
    var message = shadow.getElementById("cw-message").value.trim();
    var email = shadow.getElementById("cw-email").value.trim();
    var fileInput = shadow.getElementById("cw-file");
    var submitBtn = shadow.getElementById("cw-btn-submit");

    if (!subject || !message) {
      showError("Le sujet et le message sont requis.");
      return;
    }

    // Disable button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="cw-spinner"></span> Envoi...';
    var errorEl = shadow.getElementById("cw-error");
    if (errorEl) errorEl.innerHTML = "";

    var fd = new FormData();
    fd.append("widget_token", config.token);
    fd.append("subject", subject);
    fd.append("message", message);
    if (email) fd.append("user_email", email);
    fd.append("origin", window.location.href);
    fd.append("browser", getBrowser());
    fd.append("window_width", String(window.innerWidth));
    fd.append("window_height", String(window.innerHeight));

    if (fileInput && fileInput.files.length > 0) {
      var file = fileInput.files[0];
      if (file.size > 10 * 1024 * 1024) {
        showError("Le fichier dépasse la taille maximale de 10 MB.");
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Envoyer";
        return;
      }
      fd.append("file", file);
    }

    fetch(API_URL, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: fd,
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data.success) {
          showSuccess();
        } else {
          showError(
            result.data.message || "Une erreur est survenue. Réessayez."
          );
          submitBtn.disabled = false;
          submitBtn.innerHTML = "Envoyer";
        }
      })
      .catch(function () {
        showError("Erreur de connexion. Réessayez plus tard.");
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Envoyer";
      });
  }

  // ── File drop zone ─────────────────────────────────────────
  function attachFormListeners() {
    var form = shadow.getElementById("cw-form");
    if (form) form.addEventListener("submit", handleSubmit);

    var dropZone = shadow.getElementById("cw-drop");
    var fileInput = shadow.getElementById("cw-file");
    var fnameEl = shadow.getElementById("cw-fname");

    if (dropZone && fileInput) {
      dropZone.addEventListener("click", function () {
        fileInput.click();
      });
      fileInput.addEventListener("change", function () {
        if (fileInput.files.length > 0 && fnameEl) {
          fnameEl.textContent = fileInput.files[0].name;
        }
      });
      dropZone.addEventListener("dragover", function (e) {
        e.preventDefault();
        dropZone.style.borderColor = "#3b82f6";
      });
      dropZone.addEventListener("dragleave", function () {
        dropZone.style.borderColor = "#3f3f46";
      });
      dropZone.addEventListener("drop", function (e) {
        e.preventDefault();
        dropZone.style.borderColor = "#3f3f46";
        if (e.dataTransfer.files.length > 0) {
          fileInput.files = e.dataTransfer.files;
          if (fnameEl) fnameEl.textContent = e.dataTransfer.files[0].name;
        }
      });
    }
  }

  // ── Event Listeners ────────────────────────────────────────
  btn.addEventListener("click", open);
  closeBtn.addEventListener("click", function () {
    close();
    resetForm();
  });
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) {
      close();
      resetForm();
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) {
      close();
      resetForm();
    }
  });

  attachFormListeners();

  // Expose for programmatic control
  window.CinqWidget = { open: open, close: close };
})();
