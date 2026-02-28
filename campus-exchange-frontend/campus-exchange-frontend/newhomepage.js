// newhomepage.js — Integrated with Campus Exchange backend

document.addEventListener("DOMContentLoaded", () => {
  updateNavAuth();

  // Search bar
  const searchInput = document.querySelector(".search-container input");
  const searchBtn   = document.querySelector(".search-container button");

  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", doSearch);
    searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
  }

  function doSearch() {
    const q = searchInput.value.trim();
    if (!q) return;
    window.location.href = `category.html?search=${encodeURIComponent(q)}`;
  }

  // Wire category cards to category.html with correct query param
  const categoryLinks = {
    "Stationary":          "Stationery",
    "Hostel Essentials":   "Hostel Essentials",
    "Cycles":              "Cycles",
    "Electronics":         "Electronics",
    "Course Subscriptions":"Other",
    "Lab Supplies":        "Other",
    "Sports & Supplies":   "Sports",
  };

  document.querySelectorAll(".category-card").forEach(card => {
    const label = card.querySelector("h3")?.textContent?.trim();
    if (label && categoryLinks[label]) {
      card.style.cursor = "pointer";
      card.addEventListener("click", () => {
        window.location.href = `category.html?category=${encodeURIComponent(categoryLinks[label])}`;
      });
    }
  });
});
