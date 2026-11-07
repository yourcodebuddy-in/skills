#!/usr/bin/env node
// Builds the real-PR suite from Martian's Code Review Bench (MIT): github.com/withmartian/code-review-benchmark
//   node evals/review-receipts/prepare-real-prs.mjs download           fetches PR text and known issues, at the pinned commit, into workspace/review-receipts/cache
//   node evals/review-receipts/prepare-real-prs.mjs snapshots [--all]  builds local repos for the dev set, or for every PR
//   node evals/review-receipts/prepare-real-prs.mjs manifest           rewrites evals/review-receipts/real-prs.json from the downloaded list, to change the suite
//
// Each snapshot is a small repo with `main` at the PR's merge base and `feature` holding the PR as one commit.
// History is left out so a run can't read later fixes or the original review threads.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const CACHE = join(ROOT, "workspace/review-receipts/cache");
const GOLDEN = join(CACHE, "martian/golden_comments");
const MANIFEST = join(HERE, "real-prs.json");
const SUITE = join(CACHE, "real-prs.json");
const GOLDEN_FILES = ["cal_dot_com", "discourse", "grafana", "keycloak", "sentry"];

// Three per project, chosen by id only, across sizes. All others stay unseen until the final run.
const DEV = new Set([
  "calcom-cal.com-8087", "calcom-cal.com-10967", "calcom-cal.com-14943",
  "ai-code-review-evaluation-discourse-graphite-2", "ai-code-review-evaluation-discourse-graphite-5", "ai-code-review-evaluation-discourse-graphite-8",
  "grafana-grafana-79265", "grafana-grafana-103633", "grafana-grafana-97529",
  "keycloak-keycloak-32918", "keycloak-keycloak-36882", "keycloak-keycloak-40940",
  "ai-code-review-evaluation-sentry-greptile-1", "getsentry-sentry-80528", "getsentry-sentry-67876",
]);

function run(command, args, cwd, input) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", input, maxBuffer: 1 << 30 });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")}: ${result.stderr}`);
  return result.stdout;
}

const gh = (...args) => run("gh", args, ROOT);

function goldenByUrl() {
  const byUrl = new Map();
  for (const file of GOLDEN_FILES) {
    for (const pr of JSON.parse(readFileSync(join(GOLDEN, `${file}.json`), "utf8"))) byUrl.set(pr.url, pr);
  }
  return byUrl;
}

async function fetchFile(commit, path, target) {
  const url = `https://raw.githubusercontent.com/withmartian/code-review-benchmark/${commit}/offline/${path}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
}

async function download() {
  const { source, prs } = JSON.parse(readFileSync(MANIFEST, "utf8"));
  for (const file of GOLDEN_FILES) await fetchFile(source.commit, `golden_comments/${file}.json`, join(GOLDEN, `${file}.json`));
  await fetchFile(source.commit, "results/benchmark_data.json", join(CACHE, "martian/results/benchmark_data.json"));

  const golden = goldenByUrl();
  const suite = prs.map((pr) => {
    const entry = golden.get(`https://github.com/${pr.repo}/pull/${pr.number}`);
    const { body } = JSON.parse(gh("pr", "view", String(pr.number), "-R", pr.repo, "--json", "body"));
    console.log(pr.id);
    return {
      ...pr,
      kind: "real-pr",
      prompt: "Review this pull request: the `feature` branch against `main`.",
      commit: `${entry.pr_title}\n\n${body ?? ""}`.trim(),
      golden: entry.comments,
    };
  });
  writeFileSync(SUITE, `${JSON.stringify(suite, null, 2)}\n`);
}

function manifest() {
  const { source } = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const prs = [...goldenByUrl().keys()].map((url) => {
    const [, repo, number] = url.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
    const view = JSON.parse(gh("pr", "view", number, "-R", repo, "--json", "baseRefOid,headRefOid"));
    const { mergeBase } = JSON.parse(gh("api", `repos/${repo}/compare/${view.baseRefOid}...${view.headRefOid}`, "--jq", "{mergeBase: .merge_base_commit.sha}"));
    const id = `${repo.replace("/", "-")}-${number}`;
    console.log(id);
    return { id, dev: DEV.has(id), repo, number: Number(number), mergeBase, head: view.headRefOid };
  });
  writeFileSync(MANIFEST, `${JSON.stringify({ source, prs }, null, 2)}\n`);
}

function snapshot(pr) {
  const target = join(CACHE, "snapshots", pr.id);
  if (existsSync(join(target, ".git"))) return;
  const scratch = mkdtempSync(join(tmpdir(), "er-pr-"));
  const url = `https://github.com/${pr.repo}.git`;
  run("git", ["init", "-q", "--template="], scratch);
  run("git", ["fetch", "-q", "--depth=1", url, pr.mergeBase], scratch);
  run("git", ["fetch", "-q", "--depth=1", url, pr.head], scratch);
  const patch = spawnSync("git", ["diff", "--binary", pr.mergeBase, pr.head], { cwd: scratch, maxBuffer: 1 << 30 }).stdout;

  mkdirSync(target, { recursive: true });
  run("sh", ["-c", `git archive ${pr.mergeBase} | tar -x -C "${target}"`], scratch);
  const git = (...args) => run("git", ["-c", "user.name=Dev", "-c", "user.email=dev@example.com", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], target);
  run("git", ["init", "-q", "-b", "main", "--template="], target);
  git("add", "-A", "-f");
  git("commit", "-qm", "Base of the pull request");
  git("checkout", "-qb", "feature");
  const apply = spawnSync("git", ["apply", "--index", "--whitespace=nowarn"], { cwd: target, input: patch, maxBuffer: 1 << 30 });
  if (apply.status !== 0) throw new Error(`apply ${pr.id}: ${apply.stderr}`);
  git("commit", "-qm", pr.commit);
  rmSync(scratch, { recursive: true, force: true });
  console.log("built", pr.id, run("du", ["-sh", target]).split("\t")[0]);
}

const [command, flag] = process.argv.slice(2);
if (command === "download") {
  await download();
} else if (command === "manifest") {
  manifest();
} else if (command === "snapshots") {
  const suite = JSON.parse(readFileSync(SUITE, "utf8"));
  for (const pr of suite.filter((p) => flag === "--all" || p.dev)) {
    try {
      snapshot(pr);
    } catch (error) {
      console.error("FAILED", pr.id, String(error).slice(0, 400));
      rmSync(join(CACHE, "snapshots", pr.id), { recursive: true, force: true });
    }
  }
} else {
  console.error("usage: prepare-real-prs.mjs download | snapshots [--all] | manifest");
  process.exit(2);
}
