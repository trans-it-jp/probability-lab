/*!
 * probability-lab — app.js
 * 画面の配線と図の描画。計算は js/probability/experiment.js に置き、ここでは呼ぶだけ。
 * 図は素の SVG で描く。外部ライブラリは使わない。
 */
(function (global, document) {
  "use strict";

  var Experiment = global.ProbabilityLab.Experiment;
  var STORAGE_KEY = "probability-lab/explanation";

  function $(id) { return document.getElementById(id); }

  function weightInputs() {
    return [$("w1"), $("w2"), $("w3"), $("w4"), $("w5"), $("w6")];
  }

  function currentInput() {
    return {
      weights: weightInputs().map(function (el) { return el.value; }),
      face: $("face").value,
      trials: $("trials").value,
      prediction: $("prediction").value,
      seed: $("seed").value
    };
  }

  function ratio(value) {
    return value.toFixed(4) + "（" + (value * 100).toFixed(2) + "%）";
  }

  function signed(value, digits) {
    var text = value.toFixed(digits);
    return value > 0 ? "+" + text : text;
  }

  /* --- 条件を変えるたびに理論確率を出す --- */

  function updateProbabilityReadout() {
    var readout = $("probability-readout");
    var weights = weightInputs().map(function (el) { return Experiment.toInteger(el.value); });
    var face = Experiment.toInteger($("face").value);
    if (weights.indexOf(null) !== -1 || face === null) {
      readout.textContent = "重みは0以上の整数で入れてください。";
      return;
    }
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    if (total <= 0) {
      readout.textContent = "重みの合計が0です。どれか1つ以上を1以上にしてください。";
      return;
    }
    var p = weights[face - 1] / total;
    readout.textContent = "いまの条件では、" + face + " の目が出る理論上の確率は "
      + weights[face - 1] + " ÷ " + total + " = " + ratio(p) + " です。";
  }

  /* --- 誤りの表示 --- */

  function showErrors(errors) {
    var box = $("errors");
    if (errors.length === 0) {
      box.hidden = true;
      box.innerHTML = "";
      return null;
    }
    var list = errors.map(function (e) { return "<li>" + e.message + "</li>"; }).join("");
    box.innerHTML = "<strong>入力を直してください。</strong><ul>" + list + "</ul>";
    box.hidden = false;
    return errors[0].field;
  }

  function focusField(field) {
    var map = { trials: "trials", prediction: "prediction", face: "face", seed: "seed", weights: "w1" };
    var id = map[field] || field;
    var el = $(id);
    if (el && typeof el.focus === "function") { el.focus(); }
  }

  /* --- 図（素の SVG） --- */

  var NS = "http://www.w3.org/2000/svg";

  function svgEl(name, attrs) {
    var node = document.createElementNS(NS, name);
    Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  function text(x, y, content, className, anchor) {
    var node = svgEl("text", { x: x, y: y, class: className });
    if (anchor) { node.setAttribute("text-anchor", anchor); }
    node.textContent = content;
    return node;
  }

  /**
   * 相対度数の推移を描く。
   * 文字は線の上に重ねず、描画領域の外側（右の余白と軸の外）に置く。
   */
  function drawChart(result) {
    var wrap = $("chart");
    wrap.innerHTML = "";

    var W = 640, H = 320;
    var left = 56, right = 108, top = 28, bottom = 52;
    var plotW = W - left - right;
    var plotH = H - top - bottom;

    var svg = svgEl("svg", {
      viewBox: "0 0 " + W + " " + H,
      role: "img",
      "aria-label": "試行回数が増えるにつれて相対度数が理論上の確率にどう近づくかを示す折れ線"
    });

    var maxN = Math.max(result.trials, 1);
    function px(n) { return left + (n / maxN) * plotW; }
    function py(p) { return top + (1 - p) * plotH; }

    /* 横の目盛り線と y 軸ラベル（軸の外側に置く） */
    [0, 0.25, 0.5, 0.75, 1].forEach(function (p) {
      var y = py(p);
      svg.appendChild(svgEl("line", { x1: left, y1: y, x2: left + plotW, y2: y, class: "axis-line", opacity: p === 0 ? 1 : 0.18 }));
      svg.appendChild(text(left - 8, y + 4, p.toFixed(2), "tick-label", "end"));
    });

    /* 縦軸・横軸 */
    svg.appendChild(svgEl("line", { x1: left, y1: top, x2: left, y2: top + plotH, class: "axis-line" }));
    svg.appendChild(text(left - 8, top - 12, "相対度数", "axis-title", "start"));
    svg.appendChild(text(left, H - 14, "0", "tick-label", "middle"));
    svg.appendChild(text(left + plotW, H - 14, String(result.trials), "tick-label", "middle"));
    svg.appendChild(text(left + plotW / 2, H - 14, "試行回数", "axis-title", "middle"));

    /* 理論値の基準線。破線にして、色が出ない環境でも実測と見分けられるようにする。 */
    var yTheory = py(result.probability);
    svg.appendChild(svgEl("line", {
      x1: left, y1: yTheory, x2: left + plotW, y2: yTheory, class: "theory-line"
    }));

    var yLast = yTheory;
    if (result.series.length > 0) {
      var points = result.series.map(function (point) {
        return px(point.n) + "," + py(point.relative);
      }).join(" ");
      svg.appendChild(svgEl("polyline", { points: points, class: "series-line" }));
      yLast = py(result.series[result.series.length - 1].relative);
    }

    /* ラベルは右の余白（線の外側）へ。近すぎるときは上下に離して重なりを防ぐ。 */
    var labelX = left + plotW + 8;
    var theoryY = yTheory;
    var seriesY = yLast;
    if (Math.abs(theoryY - seriesY) < 16) {
      if (seriesY <= theoryY) { seriesY = theoryY - 16; } else { seriesY = theoryY + 16; }
    }
    svg.appendChild(text(labelX, theoryY + 4, "理論値", "theory-label", "start"));
    if (result.series.length > 0) {
      svg.appendChild(text(labelX, seriesY + 4, "実測", "series-label", "start"));
    }

    wrap.appendChild(svg);

    $("chart-note").textContent = result.series.length === 0
      ? "試行回数が0回のため、実測の線はありません。破線は理論上の確率です。"
      : "破線が理論上の確率（" + ratio(result.probability) + "）、実線が実測の相対度数です。"
        + "点は" + result.series.length + "か所で記録しています。";
  }

  /* --- 結果の表示 --- */

  function renderCounts(result) {
    var total = result.counts.reduce(function (a, b) { return a + b; }, 0);
    var weights = weightInputs().map(function (el) { return Experiment.toInteger(el.value); });
    var weightTotal = weights.reduce(function (a, b) { return a + b; }, 0);
    var body = $("counts-body");
    body.innerHTML = "";
    result.counts.forEach(function (count, index) {
      var p = weightTotal > 0 ? weights[index] / weightTotal : 0;
      var row = document.createElement("tr");
      row.innerHTML = "<th scope=\"row\">" + (index + 1) + " の目</th>"
        + "<td>" + (p * total).toFixed(1) + " 回</td>"
        + "<td>" + count + " 回</td>";
      body.appendChild(row);
    });
  }

  function renderResult(result) {
    $("prediction-echo").textContent = "あなたの予想は " + result.prediction + " 回でした。"
      + "実際は " + result.hits + " 回出ました。";

    $("p-theory").textContent = ratio(result.probability);
    $("c-theory").textContent = result.expected.toFixed(1) + " 回";
    $("c-actual").textContent = result.hits + " 回";
    $("c-diff").textContent = signed(result.hits - result.expected, 1) + " 回";

    if (result.relative === null) {
      $("p-actual").textContent = "—";
      $("p-diff").textContent = "—";
    } else {
      $("p-actual").textContent = ratio(result.relative);
      $("p-diff").textContent = signed(result.relative - result.probability, 4);
    }

    drawChart(result);
    renderCounts(result);

    $("result").hidden = false;
    $("explain-step").hidden = false;
  }

  /* --- 説明の保存（この端末の中だけ） --- */

  function loadExplanation() {
    try {
      var saved = global.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        $("explanation").value = saved;
        $("saved-note").textContent = "前に書いた内容を読み込みました。";
        $("explain-step").hidden = false;
      }
    } catch (error) {
      $("saved-note").textContent = "この環境では保存できません。書いた内容は画面を閉じると消えます。";
    }
  }

  function saveExplanation() {
    try {
      global.localStorage.setItem(STORAGE_KEY, $("explanation").value);
      $("saved-note").textContent = "この端末に保存しました。";
    } catch (error) {
      $("saved-note").textContent = "この環境では保存できません。書いた内容は画面を閉じると消えます。";
    }
  }

  function clearExplanation() {
    $("explanation").value = "";
    try {
      global.localStorage.removeItem(STORAGE_KEY);
      $("saved-note").textContent = "消しました。";
    } catch (error) {
      $("saved-note").textContent = "消しました（この環境では保存されていません）。";
    }
  }

  /* --- 配線 --- */

  function init() {
    weightInputs().forEach(function (el) { el.addEventListener("input", updateProbabilityReadout); });
    $("face").addEventListener("change", updateProbabilityReadout);

    $("preset-even").addEventListener("click", function () {
      weightInputs().forEach(function (el) { el.value = "1"; });
      updateProbabilityReadout();
    });

    $("preset-biased").addEventListener("click", function () {
      var values = ["3", "1", "3", "3", "3", "3"];
      weightInputs().forEach(function (el, i) { el.value = values[i]; });
      $("face").value = "2";
      updateProbabilityReadout();
    });

    $("experiment-form").addEventListener("submit", function (event) {
      event.preventDefault();
      var input = currentInput();
      var check = Experiment.validate(input);
      var firstBad = showErrors(check.errors);
      if (firstBad) {
        focusField(firstBad);
        $("result").hidden = true;
        return;
      }
      renderResult(Experiment.run(input));
      $("result").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    var explanation = $("explanation");
    var saveTimer = null;
    explanation.addEventListener("input", function () {
      global.clearTimeout(saveTimer);
      saveTimer = global.setTimeout(saveExplanation, 400);
    });
    $("clear-explanation").addEventListener("click", clearExplanation);

    updateProbabilityReadout();
    loadExplanation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window, document);
