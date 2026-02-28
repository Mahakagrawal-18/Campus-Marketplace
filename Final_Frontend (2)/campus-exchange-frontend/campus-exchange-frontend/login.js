// login.js — Integrated with Campus Exchange backend

document.addEventListener("DOMContentLoaded", () => {
  // If already logged in, skip straight to homepage
  if (isLoggedIn()) {
    window.location.href = "newhomepage.html";
    return;
  }

  const form = document.getElementById("loginForm");
  const emailInput  = form.querySelector('input[type="email"]');
  const passInput   = form.querySelector('input[type="password"]');
  const submitBtn   = form.querySelector('button[type="submit"]');

  emailInput.id = "loginEmail";
  passInput.id  = "loginPassword";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email    = emailInput.value.trim();
    const password = passInput.value;

    if (!email.endsWith("@iitj.ac.in")) {
      showToast("Only @iitj.ac.in email addresses are allowed.", "error");
      return;
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = "Logging in...";

    try {
      const res  = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        saveTokens(data.accessToken, data.refreshToken);
        saveUser(data.user);
        showToast("Welcome back! 🎉", "success");
        setTimeout(() => { window.location.href = "newhomepage.html"; }, 800);
      } else {
        if (data.message && data.message.toLowerCase().includes("verify")) {
          localStorage.setItem("ce_pending_email", email);
          showToast("Please verify your email first.", "info");
          setTimeout(() => { window.location.href = "verify.html"; }, 1200);
        } else {
          showToast(data.message || "Login failed.", "error");
        }
      }
    } catch (err) {
      showToast("Cannot reach server. Is the backend running?", "error");
      console.error(err);
    } finally {
      submitBtn.disabled    = false;
      submitBtn.textContent = "Login";
    }
  });
});
