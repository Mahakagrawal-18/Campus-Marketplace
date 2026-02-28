// register.js — Integrated with Campus Exchange backend

document.addEventListener("DOMContentLoaded", () => {
  if (isLoggedIn()) {
    window.location.href = "newhomepage.html";
    return;
  }

  const form      = document.getElementById("registerForm");
  const inputs    = form.querySelectorAll("input");
  const submitBtn = form.querySelector('button[type="submit"]');

  // Assign IDs to inputs by their type/order
  inputs[0].id          = "regName";
  inputs[0].placeholder = "Full Name";
  inputs[1].id          = "regEmail";
  inputs[1].placeholder = "your.name@iitj.ac.in";
  inputs[2].id          = "regPassword";
  inputs[2].placeholder = "Min 8 characters";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name     = document.getElementById("regName").value.trim();
    const email    = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;

    if (!email.endsWith("@iitj.ac.in")) {
      showToast("Only @iitj.ac.in email addresses are allowed.", "error");
      return;
    }
    if (password.length < 8) {
      showToast("Password must be at least 8 characters.", "error");
      return;
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = "Registering...";

    try {
      const res  = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem("ce_pending_email", email);
        showToast("✅ Registered! Check your IITJ email for the OTP.", "success");
        setTimeout(() => { window.location.href = "verify.html"; }, 1200);
      } else {
        showToast(data.message || "Registration failed.", "error");
      }
    } catch (err) {
      showToast("Cannot reach server. Is the backend running?", "error");
      console.error(err);
    } finally {
      submitBtn.disabled    = false;
      submitBtn.textContent = "Register";
    }
  });
});
