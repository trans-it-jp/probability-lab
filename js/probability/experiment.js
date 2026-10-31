/*!
 * probability-lab / probability — experiment.js
 * さいころを指定回数振り、注目する目の相対度数と理論確率を並べて返す。
 * DOM を使わないので Node でもそのまま読める（tests/run.js で検証する）。
 * 乱数は js/core/seeded-random.js を使い、同じ種なら必ず同じ結果になる。
 */
(function (global) {
  "use strict";

  var Lab = global.ProbabilityLab || (global.ProbabilityLab = {});

  var FACES = 6;
  var MAX_TRIALS = 1000000;
  var MAX_WEIGHT = 1000000;
  var MAX_CHECKPOINTS = 100;

  /**
   * 表示用の文字列を整数にする。小数・負・空欄・文字は null を返す。
   * 「0 は有効、空欄は無効」を呼び出し側で区別できるようにするため、
   * 判定をここに集めて app 側では使い回す。
   * @param {string|number} text
   * @returns {number|null}
   */
  function toInteger(text) {
    if (typeof text === "number") {
      return Number.isInteger(text) && text >= 0 ? text : null;
    }
    if (typeof text !== "string") { return null; }
    var trimmed = text.trim();
    if (trimmed === "") { return null; }
    if (!/^[0-9]+$/.test(trimmed)) { return null; } /* 小数点・符号・全角はここで落ちる */
    var value = Number(trimmed);
    return Number.isSafeInteger(value) ? value : null;
  }

  function sum(list) {
    var total = 0;
    for (var i = 0; i < list.length; i += 1) { total += list[i]; }
    return total;
  }

  /**
   * 指定した目の理論確率。重みの合計に対する割合。
   * @param {number[]} weights 面ごとの重み（長さ FACES）
   * @param {number} face 1..FACES
   * @returns {number}
   */
  function theoretical(weights, face) {
    var total = sum(weights);
    if (total <= 0) { return 0; }
    return weights[face - 1] / total;
  }

  /**
   * 入力を検証する。1件でも問題があれば実験を走らせない。
   * @returns {{ok:boolean, errors:Array<{field:string, message:string}>}}
   */
  function validate(input) {
    var errors = [];

    var weights = input.weights;
    if (!Array.isArray(weights) || weights.length !== FACES) {
      errors.push({ field: "weights", message: "重みは" + FACES + "個必要です。" });
    } else {
      for (var i = 0; i < FACES; i += 1) {
        var w = toInteger(weights[i]);
        if (w === null) {
          errors.push({ field: "weight" + (i + 1), message: (i + 1) + "の重みは0以上の整数で入れてください。" });
        } else if (w > MAX_WEIGHT) {
          errors.push({ field: "weight" + (i + 1), message: (i + 1) + "の重みは" + MAX_WEIGHT + "以下にしてください。" });
        }
      }
      if (errors.length === 0 && sum(weights.map(toInteger)) <= 0) {
        errors.push({ field: "weights", message: "重みの合計が0です。どれか1つ以上を1以上にしてください。" });
      }
    }

    var face = toInteger(input.face);
    if (face === null || face < 1 || face > FACES) {
      errors.push({ field: "face", message: "注目する目は1から" + FACES + "までです。" });
    }

    var trials = toInteger(input.trials);
    if (trials === null) {
      errors.push({ field: "trials", message: "試行回数は0以上の整数で入れてください。" });
    } else if (trials > MAX_TRIALS) {
      errors.push({ field: "trials", message: "試行回数は" + MAX_TRIALS + "回までです。" });
    }

    /* 予想は必須。入力しないと実験に進めない。 */
    var prediction = toInteger(input.prediction);
    if (prediction === null) {
      errors.push({ field: "prediction", message: "予想を入れてください。実験の前に自分の見当を書きます。" });
    } else if (trials !== null && prediction > trials) {
      errors.push({ field: "prediction", message: "予想が試行回数を超えています。" });
    }

    var seed = input.seed;
    if (typeof seed !== "string" && typeof seed !== "number") {
      errors.push({ field: "seed", message: "乱数の種を入れてください。" });
    } else if (String(seed).trim() === "") {
      errors.push({ field: "seed", message: "乱数の種を入れてください。" });
    }

    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * 途中経過を記録する間隔。回数が増えても点が増えすぎないようにする。
   * @param {number} trials
   * @returns {number}
   */
  function checkpointStep(trials) {
    if (trials <= MAX_CHECKPOINTS) { return 1; }
    return Math.ceil(trials / MAX_CHECKPOINTS);
  }

  /**
   * 実験を走らせる。validate を通った入力だけを渡すこと。
   * @returns {{trials:number, face:number, hits:number, relative:number,
   *            probability:number, expected:number, prediction:number,
   *            seed:(string|number), series:Array<{n:number, relative:number}>,
   *            counts:number[]}}
   */
  function run(input) {
    var weights = input.weights.map(toInteger);
    var face = toInteger(input.face);
    var trials = toInteger(input.trials);
    var prediction = toInteger(input.prediction);
    var probability = theoretical(weights, face);

    var total = sum(weights);
    var bounds = [];
    var running = 0;
    for (var f = 0; f < FACES; f += 1) {
      running += weights[f];
      bounds.push(running);
    }

    var random = global.JsDemo.Random.create(input.seed);
    var counts = [0, 0, 0, 0, 0, 0];
    var hits = 0;
    var step = checkpointStep(trials);
    var series = [];

    for (var i = 1; i <= trials; i += 1) {
      var point = random.next() * total;
      var rolled = FACES - 1;
      for (var b = 0; b < FACES; b += 1) {
        if (point < bounds[b]) { rolled = b; break; }
      }
      counts[rolled] += 1;
      if (rolled === face - 1) { hits += 1; }
      if (i % step === 0 || i === trials) {
        series.push({ n: i, relative: hits / i });
      }
    }

    return {
      trials: trials,
      face: face,
      hits: hits,
      /* 試行0回のときは割合を出さない。0 と「未測定」を取り違えないため null にする。 */
      relative: trials === 0 ? null : hits / trials,
      probability: probability,
      expected: trials * probability,
      prediction: prediction,
      seed: input.seed,
      series: series,
      counts: counts
    };
  }

  Lab.Experiment = {
    FACES: FACES,
    MAX_TRIALS: MAX_TRIALS,
    MAX_WEIGHT: MAX_WEIGHT,
    toInteger: toInteger,
    theoretical: theoretical,
    validate: validate,
    checkpointStep: checkpointStep,
    run: run
  };
})(typeof window !== "undefined" ? window : globalThis);
