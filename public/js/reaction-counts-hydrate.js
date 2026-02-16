(function () {
  function uniq(arr) {
    return [...new Set(arr)];
  }

  function setCountsForContainer(container, counts) {
    if (!container || !counts) return;

    const template = container.dataset.ariaTemplate || "{emoji} reactions: {count}";

    container.querySelectorAll("[data-count-for]").forEach((el) => {
      const type = el.dataset.countFor;
      const val = Number(counts[type] || 0);
      el.textContent = String(val);
    });

    container.querySelectorAll(".reaction-pill").forEach((pill) => {
      const type = pill.dataset.type;
      const val = Number(counts[type] || 0);
      const emoji = pill.querySelector(".reaction-emoji")?.textContent || "";
      pill.style.display = val > 0 ? "" : "none";
      if (val > 0) {
        pill.setAttribute(
          "aria-label",
          template.replace("{emoji}", emoji).replace("{count}", String(val))
        );
      }
    });

    const anyVisible = Object.values(counts).some((n) => Number(n) > 0);
    container.style.display = anyVisible ? "" : "none";
  }

  async function fetchBatchCounts(blockIds) {
    const res = await fetch("/api/v1/reactions/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockIds }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Batch fetch failed: ${res.status} ${text}`);
    }

    return res.json();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const containers = Array.from(document.querySelectorAll(".reaction-counts[data-block-id]"));
    if (!containers.length) return;

    const ids = uniq(containers.map((c) => c.dataset.blockId).filter(Boolean));
    if (!ids.length) return;

    try {
      const data = await fetchBatchCounts(ids);
      const map = data?.countsByBlockId || {};

      containers.forEach((c) => {
        const id = c.dataset.blockId;
        const counts = map[id];
        if (!counts) {
          c.style.display = "none";
          return;
        }
        setCountsForContainer(c, counts);
      });
    } catch (err) {
      console.error(err);
      // Fail quietly: hide counts so we don't show misleading zeros
      containers.forEach((c) => {
        c.style.display = "none";
      });
    }
  });
})();
