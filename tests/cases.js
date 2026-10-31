/*!
 * probability-lab / tests — cases.js
 * 受入条件のうち、計算で確かめられるものを並べる。
 * 初見利用・キーボード操作・表示倍率・図と数値の一致は実画面でしか見えないので、
 * ここには入れない（tests/index.html と手元の確認で扱う）。
 */
(function (global) {
  "use strict";

  var Lab = global.ProbabilityLab;
  var Experiment = Lab.Experiment;
  var cases = [];

  function add(group, name, fn) {
    cases.push({ group: group, name: name, run: fn });
  }

  function assert(ok, message) {
    if (!ok) { throw new Error(message); }
  }

  function near(actual, expected, tolerance, message) {
    assert(Math.abs(actual - expected) <= tolerance,
      message + "（期待 " + expected + " ± " + tolerance + "、実際 " + actual + "）");
  }

  var EVEN = [1, 1, 1, 1, 1, 1];

  function input(over) {
    var base = { weights: EVEN, face: 1, trials: 100, prediction: 17, seed: "test" };
    for (var key in over) { if (over.hasOwnProperty(key)) { base[key] = over[key]; } }
    return base;
  }

  /* --- 受入条件1: 既知の理論値 --- */

  add("既知の理論値", "均等なさいころの理論確率は 1/6", function () {
    near(Experiment.theoretical(EVEN, 3), 1 / 6, 1e-12, "理論確率が 1/6 でない");
  });

  add("既知の理論値", "コイン相当（2面だけ重み1）の理論確率は 1/2", function () {
    near(Experiment.theoretical([1, 1, 0, 0, 0, 0], 1), 0.5, 1e-12, "理論確率が 1/2 でない");
  });

  add("既知の理論値", "試行回数を増やすと相対度数が理論値に近づく", function () {
    var far = Experiment.run(input({ trials: 50, prediction: 8 }));
    var near1k = Experiment.run(input({ trials: 1000, prediction: 167 }));
    var near100k = Experiment.run(input({ trials: 100000, prediction: 16667 }));
    var d50 = Math.abs(far.relative - 1 / 6);
    var d1k = Math.abs(near1k.relative - 1 / 6);
    var d100k = Math.abs(near100k.relative - 1 / 6);
    assert(d100k < d1k, "100000回が1000回より離れている（" + d100k + " vs " + d1k + "）");
    assert(d1k < d50, "1000回が50回より離れている（" + d1k + " vs " + d50 + "）");
    near(near100k.relative, 1 / 6, 0.01, "100000回でも理論値から離れすぎ");
  });

  /* --- 受入条件2: 偏りの指定 --- */

  add("偏りの指定", "指定した偏りどおりの理論確率になる", function () {
    var weights = [5, 1, 1, 1, 1, 1];
    near(Experiment.theoretical(weights, 1), 5 / 10, 1e-12, "偏らせた目の理論確率が合わない");
    near(Experiment.theoretical(weights, 2), 1 / 10, 1e-12, "他の目の理論確率が合わない");
  });

  add("偏りの指定", "偏らせた結果が実測にも出る", function () {
    var result = Experiment.run(input({ weights: [5, 1, 1, 1, 1, 1], trials: 100000, prediction: 50000 }));
    near(result.relative, 0.5, 0.01, "偏りを入れた目の相対度数が理論値から離れすぎ");
  });

  add("偏りの指定", "重み0の目は一度も出ない", function () {
    var result = Experiment.run(input({ weights: [0, 1, 1, 1, 1, 1], trials: 10000, prediction: 0 }));
    assert(result.hits === 0, "重み0の目が出た（" + result.hits + "回）");
    assert(result.counts[0] === 0, "重み0の目の出目が記録された");
  });

  /* --- 受入条件3: 極端な試行回数 --- */

  add("極端な試行回数", "0回でも破綻せず、割合は null になる", function () {
    var result = Experiment.run(input({ trials: 0, prediction: 0 }));
    assert(result.hits === 0, "0回なのに出た回数がある");
    assert(result.relative === null, "0回の割合が null でない（0 と未測定を区別する）");
    assert(result.expected === 0, "0回の期待回数が0でない");
    assert(result.series.length === 0, "0回なのに推移の点がある");
  });

  add("極端な試行回数", "1回でも破綻しない", function () {
    var result = Experiment.run(input({ trials: 1, prediction: 0 }));
    assert(result.hits === 0 || result.hits === 1, "1回の結果が0でも1でもない");
    assert(result.series.length === 1, "1回なのに推移の点が1件でない");
    assert(result.series[0].n === 1, "推移の点の回数が1でない");
  });

  add("極端な試行回数", "上限の100万回でも点の数が増えすぎない", function () {
    var result = Experiment.run(input({ trials: Experiment.MAX_TRIALS, prediction: 166667 }));
    assert(result.trials === Experiment.MAX_TRIALS, "試行回数が渡した値と違う");
    assert(result.series.length <= 101, "推移の点が多すぎる（" + result.series.length + "件）");
    assert(result.series[result.series.length - 1].n === Experiment.MAX_TRIALS,
      "推移の最後の点が最終回数になっていない");
    near(result.relative, 1 / 6, 0.005, "100万回の相対度数が理論値から離れすぎ");
  });

  /* --- 受入条件4: 不正入力 --- */

  add("不正入力", "負の数は通さない", function () {
    assert(Experiment.toInteger("-1") === null, "負の数が通った");
    assert(!Experiment.validate(input({ trials: "-5" })).ok, "負の試行回数が通った");
  });

  add("不正入力", "小数は通さない", function () {
    assert(Experiment.toInteger("1.5") === null, "小数が通った");
    assert(!Experiment.validate(input({ trials: "10.5" })).ok, "小数の試行回数が通った");
  });

  add("不正入力", "文字と空欄は通さない", function () {
    assert(Experiment.toInteger("abc") === null, "文字が通った");
    assert(Experiment.toInteger("") === null, "空欄が通った");
    assert(Experiment.toInteger("   ") === null, "空白だけが通った");
    assert(Experiment.toInteger("１０") === null, "全角数字が通った");
    assert(!Experiment.validate(input({ trials: "" })).ok, "空欄の試行回数が通った");
  });

  add("不正入力", "予想が空欄なら実験に進めない", function () {
    var result = Experiment.validate(input({ prediction: "" }));
    assert(!result.ok, "予想が空欄でも通った");
    assert(result.errors.some(function (e) { return e.field === "prediction"; }),
      "予想の欄が誤りとして示されていない");
  });

  add("不正入力", "予想が試行回数を超えたら通さない", function () {
    assert(!Experiment.validate(input({ trials: 10, prediction: 11 })).ok, "予想が試行回数を超えても通った");
    assert(Experiment.validate(input({ trials: 10, prediction: 10 })).ok, "予想が試行回数と同じで落ちた");
  });

  add("不正入力", "重みの合計が0なら通さない", function () {
    assert(!Experiment.validate(input({ weights: [0, 0, 0, 0, 0, 0] })).ok, "重みの合計0が通った");
  });

  add("不正入力", "注目する目が範囲外なら通さない", function () {
    assert(!Experiment.validate(input({ face: 0 })).ok, "目0が通った");
    assert(!Experiment.validate(input({ face: 7 })).ok, "目7が通った");
  });

  add("不正入力", "試行回数0と予想0は正しい入力として通る", function () {
    assert(Experiment.validate(input({ trials: 0, prediction: 0 })).ok, "0回0予想が落ちた");
  });

  add("不正入力", "種が空欄なら通さない", function () {
    assert(!Experiment.validate(input({ seed: "" })).ok, "空欄の種が通った");
    assert(!Experiment.validate(input({ seed: "   " })).ok, "空白だけの種が通った");
  });

  /* --- 受入条件5: 乱数の再現性 --- */

  add("乱数の再現性", "同じ種なら同じ結果になる", function () {
    var a = Experiment.run(input({ trials: 5000, prediction: 833, seed: "2026-11-01" }));
    var b = Experiment.run(input({ trials: 5000, prediction: 833, seed: "2026-11-01" }));
    assert(a.hits === b.hits, "同じ種で出た回数が違う（" + a.hits + " vs " + b.hits + "）");
    assert(JSON.stringify(a.counts) === JSON.stringify(b.counts), "同じ種で出目の内訳が違う");
    assert(JSON.stringify(a.series) === JSON.stringify(b.series), "同じ種で推移が違う");
  });

  add("乱数の再現性", "種を変えると結果が変わる", function () {
    var a = Experiment.run(input({ trials: 5000, prediction: 833, seed: "seed-a" }));
    var b = Experiment.run(input({ trials: 5000, prediction: 833, seed: "seed-b" }));
    assert(a.hits !== b.hits, "別の種で出た回数が同じ（偶然の一致なら種を変えて確認する）");
  });

  add("乱数の再現性", "数字の種と文字の種のどちらも使える", function () {
    var a = Experiment.run(input({ trials: 1000, prediction: 167, seed: 12345 }));
    var b = Experiment.run(input({ trials: 1000, prediction: 167, seed: 12345 }));
    assert(a.hits === b.hits, "数字の種で再現できない");
  });

  /* --- 受入条件7: 割合と回数の併記 --- */

  add("割合と回数の併記", "割合と回数の両方が返る", function () {
    var result = Experiment.run(input({ trials: 600, prediction: 100 }));
    assert(typeof result.relative === "number", "相対度数が返らない");
    assert(typeof result.probability === "number", "理論確率が返らない");
    assert(typeof result.hits === "number", "実測回数が返らない");
    assert(typeof result.expected === "number", "期待回数が返らない");
  });

  add("割合と回数の併記", "回数と割合が同じ結果を指している", function () {
    var result = Experiment.run(input({ trials: 600, prediction: 100 }));
    near(result.relative * result.trials, result.hits, 1e-9, "割合×試行回数が実測回数と合わない");
    near(result.expected, result.probability * result.trials, 1e-9, "期待回数が理論確率×試行回数と合わない");
  });

  add("割合と回数の併記", "出目の内訳の合計が試行回数と一致する", function () {
    var result = Experiment.run(input({ trials: 777, prediction: 130 }));
    var total = result.counts.reduce(function (a, b) { return a + b; }, 0);
    assert(total === result.trials, "出目の合計が試行回数と違う（" + total + " vs " + result.trials + "）");
    assert(result.counts[result.face - 1] === result.hits, "注目した目の内訳が実測回数と違う");
  });

  /* --- 推移の整合 --- */

  add("推移の整合", "推移の最後の点が最終的な相対度数と一致する", function () {
    var result = Experiment.run(input({ trials: 3000, prediction: 500 }));
    var last = result.series[result.series.length - 1];
    assert(last.n === result.trials, "推移の最後の点が最終回数でない");
    near(last.relative, result.relative, 1e-12, "推移の最後の点が最終的な相対度数と違う");
  });

  add("推移の整合", "推移の回数は増加し続ける", function () {
    var result = Experiment.run(input({ trials: 12345, prediction: 2000 }));
    for (var i = 1; i < result.series.length; i += 1) {
      assert(result.series[i].n > result.series[i - 1].n, "推移の回数が増えていない箇所がある");
    }
  });

  Lab.cases = cases;
})(typeof window !== "undefined" ? window : globalThis);
