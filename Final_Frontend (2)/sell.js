// sell.js — Integrated with Campus Exchange backend

document.addEventListener("DOMContentLoaded", () => {
  if (!requireAuth()) return;

  const form      = document.getElementById("sellForm");
  const submitBtn = form.querySelector('button[type="submit"]');

  // Map sell.html field IDs to backend field names
  // sell.html uses: itemName, category, price, condition, description, itemImage
  const categoryMap = {
    stationary: "Stationery",
    hostel:     "Hostel Essentials",
    cycles:     "Cycles",
    electronics:"Electronics",
    placement:  "Other",
    lab:        "Other",
    sports:     "Sports",
    other:      "Other",
  };
  const conditionMap = {
    "new":       "New",
    "like-new":  "Like New",
    "good":      "Good",
    "fair":      "Fair",
    "poor":      "Poor",
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title       = document.getElementById("itemName").value.trim();
    const rawCat      = document.getElementById("category").value;
    const price       = parseFloat(document.getElementById("price").value);
    const rawCond     = document.getElementById("condition").value;
    const description = document.getElementById("description").value.trim();
    const imageFile   = document.getElementById("itemImage").files[0];

    const category  = categoryMap[rawCat]  || "Other";
    const condition = conditionMap[rawCond] || "Good";

    if (!title || !rawCat || !price || !rawCond) {
      showToast("Please fill in all required fields.", "error");
      return;
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = "Posting...";

    try {
      // Step 1: Create the listing
      const res  = await apiFetch("/api/listings", {
        method: "POST",
        body: JSON.stringify({ title, description, price, category, condition }),
      });
      const data = await res.json();

      if (!data.success) {
        showToast(data.message || "Failed to create listing.", "error");
        return;
      }

      const listingId = data.data._id;

      // Step 2: Upload image if provided
      if (imageFile) {
        const formData = new FormData();
        formData.append("images", imageFile);

        await fetch(`${API_BASE}/api/listings/${listingId}/images`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
          body: formData,
        });
      }

      showToast(`✅ "${title}" listed successfully!`, "success");
      setTimeout(() => { window.location.href = "newhomepage.html"; }, 1200);

    } catch (err) {
      showToast("Something went wrong. Please try again.", "error");
      console.error(err);
    } finally {
      submitBtn.disabled    = false;
      submitBtn.textContent = "Post My Item";
    }
  });
});

// File size check (called inline from HTML)
function checkFileSize(input) {
  if (input.files && input.files[0]) {
    const sizeMB = input.files[0].size / 1024 / 1024;
    if (sizeMB > 5) {
      showToast("File too large! Max 5MB.", "error");
      input.value = "";
    }
  }
}
