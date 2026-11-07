import assert from "node:assert/strict";
import { test } from "node:test";
import { subject } from "./digest.ts";

test("subject", () => assert.equal(subject(3), "3 new updates"));
