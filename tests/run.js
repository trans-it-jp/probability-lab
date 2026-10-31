#!/usr/bin/env node
/*!
 * probability-lab / tests — run.js
 * tests/cases.js を Node で走らせる。外部パッケージは使わない。
 *
 *   node tests/run.js
 *
 * 1件でも落ちたら終了コード1を返すので、提供前の確認にそのまま使える。
 * 画面が要る確認（図と数値の一致・表示倍率・キーボード操作・初見利用）は
 * ここでは扱わない。tests/index.html をブラウザで開いて確かめる。
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var root = path.join(__dirname, "..");

[
  "js/core/seeded-random.js",
  "js/probability/experiment.js",
  "tests/cases.js"
].forEach(function (file) {
  var full = path.join(root, file);
  vm.runInThisContext(fs.readFileSync(full, "utf8"), { filename: full });
});

var cases = globalThis.ProbabilityLab.cases;
var failures = [];
var currentGroup = null;

cases.forEach(function (testCase) {
  if (testCase.group !== currentGroup) {
    currentGroup = testCase.group;
    process.stdout.write("\n" + currentGroup + "\n");
  }
  try {
    testCase.run();
    process.stdout.write("  OK   " + testCase.name + "\n");
  } catch (error) {
    failures.push({ name: testCase.group + " / " + testCase.name, message: error.message });
    process.stdout.write("  NG   " + testCase.name + "\n");
  }
});

process.stdout.write("\n" + (cases.length - failures.length) + " / " + cases.length + " 件が合格\n");

if (failures.length > 0) {
  process.stdout.write("\n落ちた項目\n");
  failures.forEach(function (failure) {
    process.stdout.write("  " + failure.name + "\n    " + failure.message + "\n");
  });
  process.exit(1);
}
