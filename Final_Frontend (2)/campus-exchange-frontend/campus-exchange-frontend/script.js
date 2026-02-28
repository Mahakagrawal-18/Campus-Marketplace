// script.js — index.html (landing page) logic

document.addEventListener("DOMContentLoaded", () => {
  updateNavAuth();

  // ── Sell button: require login ─────────────────────────────
  const sellBtn = document.getElementById("sellBtn");
  if (sellBtn) {
    sellBtn.addEventListener("click", () => {
      if (!isLoggedIn()) {
        showToast("Please login first to sell an item.", "info");
        setTimeout(() => { window.location.href = "login.html"; }, 900);
      } else {
        window.location.href = "sell.html";
      }
    });
  }

  // ── Login button ───────────────────────────────────────────
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => { window.location.href = "login.html"; });
  }

  // ── Logo dropdown ──────────────────────────────────────────
  window.toggleDropdown = function () {
    const dropdown = document.getElementById("logo-dropdown");
    if (dropdown) dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
  };
  window.onclick = function (event) {
    if (!event.target.closest(".logo-container")) {
      const dropdown = document.getElementById("logo-dropdown");
      if (dropdown) dropdown.style.display = "none";
    }
  };

  // ── Back to Top ────────────────────────────────────────────
  const topBtn = document.getElementById("backToTop");
  if (topBtn) {
    window.addEventListener("scroll", () => {
      topBtn.style.display = window.scrollY > 400 ? "block" : "none";
    });
    topBtn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── File size check ────────────────────────────────────────
  window.checkFileSize = function (input) {
    if (input.files && input.files[0]) {
      if (input.files[0].size / 1024 / 1024 > 5) {
        showToast("File too large! Max 5MB.", "error");
        input.value = "";
      }
    }
  };

  // ── Contact seller (placeholder until product page exists) ─
  window.contactSeller = function (itemName, price) {
    if (!isLoggedIn()) {
      showToast("Please login to contact the seller.", "info");
      setTimeout(() => { window.location.href = "login.html"; }, 900);
    } else {
      showToast(`Interested in ${itemName} (₹${price})? Feature coming soon!`, "info");
    }
  };
});
