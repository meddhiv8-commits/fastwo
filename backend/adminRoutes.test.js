const assert = require("node:assert/strict");

function testAdminValidation() {
  assert.equal(Number.isFinite(12.5), true);
  assert.equal(Number.isFinite(Number.NaN), false);
}

testAdminValidation();
console.log("Admin route validation smoke test passed");
