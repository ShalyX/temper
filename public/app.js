async function api(path, options) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function fmtAgent(result) {
  return [
    `passed: ${result.passed}`,
    `failure: ${result.failureKind}`,
    `payments: ${result.paymentAttempts}`,
    `recovery: ${result.recoveryPath?.join(" → ") || "—"}`,
    `tx/anchor: ${result.txHash || "—"}`,
    `duration: ${result.durationMs}ms`,
    "",
    "decisions:",
    ...result.decisions.map(
      (d, i) =>
        `  ${i + 1}. ${d.action} · ${d.reason}` +
        (d.quote?.asOf ? `\n     asOf=${d.quote.asOf} price=${d.quote.price}` : ""),
    ),
    result.error ? `\nerror: ${result.error}` : "",
  ].join("\n");
}

async function refreshHealth() {
  const statusText = document.getElementById("statusText");
  const dot = document.querySelector(".dot");
  try {
    const h = await api("/api/health");
    statusText.textContent = `${h.mode} · x402 ${h.x402} · registry ${h.registry}`;
    dot.classList.add("ok");
  } catch (e) {
    statusText.textContent = "offline";
    dot.classList.add("bad");
  }
}

async function runDual() {
  const btn = document.getElementById("runBtn");
  const scenario = document.getElementById("scenario").value;
  btn.disabled = true;
  btn.textContent = "Running…";
  try {
    const report = await api("/api/run", {
      method: "POST",
      body: JSON.stringify({ scenarioId: scenario }),
    });

    document.getElementById("results").hidden = false;
    document.getElementById("summary").hidden = false;

    const naiveCard = document.getElementById("naiveCard");
    const guardedCard = document.getElementById("guardedCard");
    naiveCard.className = `card ${report.naive.passed ? "pass" : "fail"}`;
    guardedCard.className = `card ${report.guarded.passed ? "pass" : "fail"}`;

    document.getElementById("naiveBadge").textContent = report.naive.passed
      ? "PASS"
      : `FAIL · ${report.naive.failureKind}`;
    document.getElementById("guardedBadge").textContent = report.guarded.passed
      ? "PASS"
      : `FAIL · ${report.guarded.failureKind}`;

    document.getElementById("naiveBody").textContent = fmtAgent(report.naive);
    document.getElementById("guardedBody").textContent = fmtAgent(report.guarded);
    document.getElementById("summaryText").textContent = report.comparison.summary;
    document.getElementById("summaryMeta").textContent = [
      `delta: ${report.comparison.delta}`,
      `x402 mode: ${report.mode.x402}`,
      `registry mode: ${report.mode.registry}`,
      `scenario: ${report.scenarioId}`,
    ].join("\n");
  } catch (err) {
    alert(err.message || String(err));
  } finally {
    btn.disabled = false;
    btn.textContent = "Run dual comparison";
  }
}

document.getElementById("runBtn").addEventListener("click", runDual);
refreshHealth();
