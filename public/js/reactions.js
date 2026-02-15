(function () {
  function isLoggedIn() {
    return document.body?.dataset?.isLoggedIn === "true";
  }

  async function postToggle(endpoint, type) {
    const res = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });

    if (res.status === 401) {
      throw Object.assign(new Error("Not authenticated"), { code: 401 });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Toggle failed: ${res.status} ${text}`);
    }

    return res.json();
  }

  function setButtonState(btn, active, count) {
    btn.classList.toggle("is-active", active);
    const type = btn.dataset.reactionType;
    const countEl = btn.closest(".reaction-bar")?.querySelector(`[data-count-for="${type}"]`);
    if (countEl && typeof count === "number") countEl.textContent = String(count);
  }

  function wireBar(bar) {
    const endpoint = bar.dataset.endpoint;

    bar.addEventListener("click", async (e) => {
      const btn = e.target.closest(".reaction-btn");
      if (!btn) return;

      if (!isLoggedIn()) {
        // Reuse the global helper exposed by vote-controls.js
        const actionType = btn.dataset.loginAction || "actions.reactToBlock";
        window.showLoginModal?.(actionType);
        return;
      }

      const type = btn.dataset.reactionType;
      const wasActive = btn.classList.contains("is-active");
      const countEl = bar.querySelector(`[data-count-for="${type}"]`);
      const prevCount = Number(countEl?.textContent || "0");

      // Optimistic UI
      setButtonState(btn, !wasActive, wasActive ? Math.max(0, prevCount - 1) : prevCount + 1);
      btn.disabled = true;

      try {
        const data = await postToggle(endpoint, type);

        // Reconcile from server truth
        const counts = data?.counts || {};
        const userReactions = new Set(data?.userReactions || []);

        bar.querySelectorAll(".reaction-btn").forEach((b) => {
          const t = b.dataset.reactionType;
          const c = Number(counts[t] || 0);
          const active = userReactions.has(t);
          b.disabled = false;
          setButtonState(b, active, c);
        });
      } catch (err) {
        // Revert optimistic UI on failure
        setButtonState(btn, wasActive, prevCount);
        btn.disabled = false;

        // Optional: if 401, you could open your login modal here.
        // For now, we just noop quietly.
        console.error(err);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".reaction-bar").forEach(wireBar);
  });
})();
