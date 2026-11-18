/**
 * After the Hail — educational PDR / hail cost range calculator.
 * Every figure is taken from sources cited on the estimator page.
 * This is not a quote.
 */
(function () {
  "use strict";

  var NDR_PANEL_MIN = 195;
  var NDR_PANEL_MAX = 2200;
  var PREP_HIGH = 0.4;
  var UPCHARGE = 0.25;
  var OVERSIZE_EACH = 50;

  var BRACKETS = [
    { min: 1, max: 5, label: "Very Light (1–5 dents)" },
    { min: 6, max: 15, label: "Light (6–15 dents)" },
    { min: 16, max: 30, label: "Moderate (16–30 dents)" },
    { min: 31, max: 50, label: "Medium (31–50 dents)" },
    { min: 51, max: 75, label: "Heavy (51–75 dents)" },
    { min: 76, max: 100, label: "Severe (76–100 dents)" },
    { min: 101, max: 150, label: "Extreme (101–150 dents)" },
    { min: 151, max: 200, label: "Limit (151–200 dents)" },
    { min: 201, max: 250, label: "Ceiling (201–250 dents)" }
  ];

  var SIZES = { dime: 0, nickel: 1, quarter: 2, half: 3 };
  var SIZE_LABELS = ["dime", "nickel", "quarter", "half-dollar"];

  /* State Farm PDR Pricing Matrix, form dated 04-29-2025, opened as a PDF.
     null means the cell is MCE or not listed. Later brackets missing from the
     published sheet (fenders, doors, etc. after 50 dents) are also null. */
  var MATRIX = {
    hood: [
      [80, 100, 125, 150],
      [125, 175, 200, 250],
      [200, 225, 275, 350],
      [300, 350, 425, 500],
      [375, 400, 500, 625],
      [450, 550, 650, 750],
      [550, 650, null, null],
      [650, 800, null, null],
      [725, 825, null, null]
    ],
    roof: [
      [100, 125, 150, 200],
      [175, 225, 250, 325],
      [250, 300, 350, 425],
      [375, 425, 525, 600],
      [475, 550, 675, 800],
      [575, 675, 800, 900],
      [650, 750, 950, 1100],
      [850, 950, 1150, 1450],
      [950, 1150, 1350, 1550]
    ],
    deck: [
      [80, 100, 125, 150],
      [125, 150, 200, 250],
      [175, 225, 275, 300],
      [275, 325, 400, 475],
      [400, 450, 500, 600],
      [450, 550, 650, null],
      [550, 650, null, null],
      [650, null, null, null],
      [750, null, null, null]
    ],
    rail: [
      [85, 100, 125, 150],
      [125, 150, 175, null],
      [200, 250, 275, null],
      [300, 400, null, null],
      null,
      null,
      null,
      null,
      null
    ],
    fender: [
      [80, 100, 125, 150],
      [125, 150, 175, 200],
      [175, 225, 275, 300],
      [275, 300, 350, 375],
      null,
      null,
      null,
      null,
      null
    ],
    door: [
      [80, 100, 125, 150],
      [125, 150, 175, 200],
      [175, 225, 250, 300],
      [275, 300, 350, null],
      null,
      null,
      null,
      null,
      null
    ],
    quarter: [
      [80, 100, 125, 150],
      [125, 150, 175, 200],
      [175, 225, 250, 300],
      [275, 325, 400, 475],
      null,
      null,
      null,
      null,
      null
    ],
    cab: [
      [80, 100, 125, 150],
      [125, 150, 175, 200],
      [175, 225, 250, 300],
      [225, 250, 300, 375],
      null,
      null,
      null,
      null,
      null
    ],
    cowl: [
      [100, 125, 150, 175],
      [150, 175, 200, 225],
      [200, 225, 250, 275],
      [null, null, null, null],
      null,
      null,
      null,
      null,
      null
    ]
  };

  function bracketIndex(count) {
    if (!count || count < 1) return -1;
    for (var i = 0; i < BRACKETS.length; i++) {
      if (count >= BRACKETS[i].min && count <= BRACKETS[i].max) return i;
    }
    return -2; // above the published ceiling
  }

  function lookup(panelKey, count, sizeKey) {
    var idx = bracketIndex(count);
    var size = SIZES[sizeKey];
    if (idx === -1) {
      return { status: "empty" };
    }
    if (idx === -2 || size === undefined) {
      return { status: "off", bracketIndex: idx, bracket: null };
    }
    var row = MATRIX[panelKey];
    if (!row) return { status: "off", bracketIndex: idx, bracket: BRACKETS[idx] };
    var cells = row[idx];
    if (!cells) {
      return { status: "off", bracketIndex: idx, bracket: BRACKETS[idx] };
    }
    var price = cells[size];
    if (price === null || price === undefined) {
      return { status: "off", bracketIndex: idx, bracket: BRACKETS[idx] };
    }
    return { status: "ok", price: price, bracketIndex: idx, bracket: BRACKETS[idx] };
  }

  function money(n) {
    return Math.round(n).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    });
  }

  function estimatePanel(input) {
    var count = parseInt(input.count, 10) || 0;
    var oversize = parseInt(input.oversize, 10) || 0;
    if (oversize < 0) oversize = 0;
    if (count < 0) count = 0;
    var result = {
      id: input.id,
      label: input.label,
      count: count,
      size: input.size,
      aluminum: !!input.aluminum,
      tallRoof: !!input.tallRoof,
      oversize: oversize,
      notes: []
    };
    if (count === 0 && oversize === 0) {
      result.status = "empty";
      return result;
    }
    if (count === 0 && oversize > 0) {
      result.status = "need-count";
      result.notes.push("Enter the total dent count on this panel, not only the oversized ones.");
      return result;
    }

    var current = lookup(input.panelKey, count, input.size);
    var upCount = current.bracket ? current.bracket.max + 1 : count;
    var up = lookup(input.panelKey, upCount, input.size);

    var upcharge = 0;
    if (input.aluminum || (input.panelKey === "roof" && input.tallRoof)) {
      upcharge = UPCHARGE;
      if (input.aluminum && input.panelKey === "roof" && input.tallRoof) {
        result.notes.push("The insurer program sheet allows a maximum of one 25% panel upcharge, so aluminum and a tall-vehicle roof are not stacked.");
      }
    }

    var oversizeAdd = oversize * OVERSIZE_EACH;
    if (oversize > 0) {
      result.notes.push("Adds $" + OVERSIZE_EACH + " per dent larger than a half-dollar, from the same insurer program sheet.");
    }

    if (current.status === "ok") {
      result.status = "ok";
      result.bracket = current.bracket.label;
      result.low = Math.round(current.price * (1 + upcharge) + oversizeAdd);
      if (up.status === "ok") {
        var highRaw = up.price * (1 + PREP_HIGH) * (1 + upcharge) + oversizeAdd;
        var high = Math.round(highRaw);
        var capped = false;
        if (high < NDR_PANEL_MIN) {
          high = NDR_PANEL_MIN;
          result.notes.push("The high end is at least $" + NDR_PANEL_MIN + " on this panel, which is the starting hail-panel figure published by National Dent Repair.");
        }
        if (high > NDR_PANEL_MAX) {
          high = NDR_PANEL_MAX;
          capped = true;
        }
        if (high < result.low) high = result.low;
        result.high = high;
        result.highCapped = capped;
        if (capped) {
          result.notes.push("The high end is capped at $" + NDR_PANEL_MAX.toLocaleString("en-US") + ", National Dent Repair’s published hail maximum per panel.");
        }
        result.notes.push("High end starts one quantity bracket higher (" + up.bracket.label + ") and adds 40% for typical prep and hidden dents, following Eco Auto Body’s published guidance.");
      } else {
        result.status = "ok-high-open";
        result.high = NDR_PANEL_MAX;
        result.notes.push("The next quantity bracket is not listed on the insurer program sheet, so the high end uses National Dent Repair’s published hail maximum of $" + NDR_PANEL_MAX.toLocaleString("en-US") + " per panel, not a made-up matrix cell.");
      }
    } else {
      result.status = "off";
      result.low = null;
      result.high = NDR_PANEL_MAX;
      result.notes.push("This panel and dent count are off the published insurer program matrix (blank or marked MCE, “most cost effective”). We do not invent a low-end price. The $" + NDR_PANEL_MAX.toLocaleString("en-US") + " figure is National Dent Repair’s published hail maximum per panel, not a quote.");
    }
    return result;
  }

  function estimateAll(panels) {
    var rows = panels.map(estimatePanel).filter(function (row) {
      return row.status !== "empty";
    });
    var lowKnown = 0;
    var high = 0;
    var missingLow = 0;
    var problems = 0;
    rows.forEach(function (row) {
      if (row.status === "need-count") problems += 1;
      if (typeof row.low === "number") lowKnown += row.low;
      else if (row.status === "off") missingLow += 1;
      if (typeof row.high === "number") high += row.high;
    });
    return {
      rows: rows,
      problems: problems,
      missingLow: missingLow,
      lowKnown: lowKnown,
      high: high
    };
  }

  function el(id) {
    return document.getElementById(id);
  }

  function collectPanels() {
    var nodes = document.querySelectorAll("[data-panel-key]");
    var list = [];
    nodes.forEach(function (card) {
      var countInput = card.querySelector('[name$="-count"]');
      var sizeInput = card.querySelector('[name$="-size"]');
      var alumInput = card.querySelector('[name$="-aluminum"]');
      var overInput = card.querySelector('[name$="-oversize"]');
      var tallInput = card.querySelector('[name$="-tallroof"]');
      list.push({
        id: card.getAttribute("data-panel-id"),
        panelKey: card.getAttribute("data-panel-key"),
        label: card.getAttribute("data-panel-label"),
        count: countInput ? countInput.value : 0,
        size: sizeInput ? sizeInput.value : "dime",
        aluminum: alumInput ? alumInput.checked : false,
        tallRoof: tallInput ? tallInput.checked : false,
        oversize: overInput ? overInput.value : 0
      });
    });
    return list;
  }

  function renderResult(data) {
    var box = el("estimate-result");
    var summary = el("estimate-summary");
    var breakdown = el("estimate-breakdown");
    var notes = el("estimate-notes");
    if (!box || !summary || !breakdown || !notes) return;

    if (!data.rows.length) {
      summary.innerHTML = "<p>Enter a dent count on at least one panel to see a range.</p>";
      breakdown.innerHTML = "";
      notes.innerHTML = "";
      return;
    }
    if (data.problems) {
      summary.innerHTML = "<p>Add the total dent count on any panel where you entered oversized dents.</p>";
      breakdown.innerHTML = "";
      notes.innerHTML = "";
      return;
    }

    var rangeText;
    if (data.missingLow && data.lowKnown > 0) {
      rangeText = "At least " + money(data.lowKnown) + " – " + money(data.high);
    } else if (data.missingLow && data.lowKnown === 0) {
      rangeText = "Off the published matrix on every panel you entered. A cited shop-guide ceiling is " + money(data.high) + " total, but that is not a quote.";
    } else {
      rangeText = money(data.lowKnown) + " – " + money(data.high);
    }

    summary.innerHTML =
      '<p class="estimate-kicker">Educational range, not a quote</p>' +
      '<p class="estimate-range">' + rangeText + "</p>" +
      "<p>Low end follows the cited insurer program matrix where a cell exists. High end follows the method described below. R&amp;I, conventional bodywork, and paint are not included.</p>";

    var rowsHtml = data.rows
      .map(function (row) {
        var low = typeof row.low === "number" ? money(row.low) : "Not listed";
        var high = typeof row.high === "number" ? money(row.high) : "—";
        var size = SIZE_LABELS[SIZES[row.size]] || row.size;
        var extras = [];
        if (row.aluminum) extras.push("aluminum");
        if (row.tallRoof) extras.push("tall-vehicle roof");
        if (row.oversize) extras.push(row.oversize + " oversized");
        var meta = row.count + " " + size + (extras.length ? " · " + extras.join(", ") : "");
        var note = row.notes.length
          ? '<span class="breakdown-note">' + row.notes.join(" ") + "</span>"
          : "";
        return (
          "<tr>" +
          "<th scope=\"row\">" + row.label + '<span class="breakdown-meta">' + meta + "</span></th>" +
          "<td>" + low + "</td>" +
          "<td>" + high + "</td>" +
          "</tr>" +
          (note ? '<tr class="note-row"><td colspan="3">' + note + "</td></tr>" : "")
        );
      })
      .join("");

    breakdown.innerHTML =
      "<h3>By panel</h3>" +
      '<div class="table-wrap"><table class="breakdown-table">' +
      "<thead><tr><th scope=\"col\">Panel</th><th scope=\"col\">Low</th><th scope=\"col\">High</th></tr></thead>" +
      "<tbody>" + rowsHtml + "</tbody></table></div>";

    var extra = [];
    if (data.missingLow) {
      extra.push(
        "At least one panel is off the published insurer matrix. The total low end only adds panels that have a listed cell."
      );
    }
    extra.push(
      "For a whole-vehicle comparison, T P Auto Repair’s 2025 consumer guide describes typical hail work as $1,000–$3,000 for light to moderate damage and $3,000–$5,000 or more for heavy damage. That is context, not a substitute for the panel-by-panel range above."
    );
    notes.innerHTML = "<ul>" + extra.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>";
  }

  function calculate(event) {
    if (event) event.preventDefault();
    renderResult(estimateAll(collectPanels()));
    var box = el("estimate-result");
    if (box && event && event.type === "submit") {
      box.focus();
    }
  }

  function resetForm() {
    var form = el("hail-estimator");
    if (form) form.reset();
    renderResult({ rows: [], problems: 0, missingLow: 0, lowKnown: 0, high: 0 });
  }

  function init() {
    var form = el("hail-estimator");
    if (!form) return;
    form.addEventListener("submit", calculate);
    form.addEventListener("input", calculate);
    form.addEventListener("change", calculate);
    var resetBtn = el("estimator-reset");
    if (resetBtn) resetBtn.addEventListener("click", resetForm);
    renderResult({ rows: [], problems: 0, missingLow: 0, lowKnown: 0, high: 0 });
  }

  window.HailEstimator = {
    estimatePanel: estimatePanel,
    estimateAll: estimateAll,
    lookup: lookup,
    money: money,
    MATRIX: MATRIX,
    BRACKETS: BRACKETS,
    NDR_PANEL_MIN: NDR_PANEL_MIN,
    NDR_PANEL_MAX: NDR_PANEL_MAX
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
