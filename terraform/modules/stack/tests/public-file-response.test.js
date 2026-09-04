const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const functionPath = path.join(
  __dirname,
  "..",
  "assets",
  "cloudfront",
  "public-file-response.js",
);
const source = fs.readFileSync(functionPath, "utf8");
const context = {};

vm.runInNewContext(`${source}\nthis.testHandler = handler;`, context);

function execute(uri, headers = {}, request = {}) {
  const event = {
    request: { uri, ...request },
    response: {
      statusCode: 200,
      headers: JSON.parse(JSON.stringify(headers)),
      cookies: { session: { value: "unchanged" } },
    },
  };

  return context.testHandler(event);
}

function header(response, name) {
  return response.headers[name].value;
}

test("forces MIME types for approved inline files", () => {
  const cases = {
    "/documents/report.pdf": "application/pdf",
    "/video/master.M3U8": "application/vnd.apple.mpegurl",
    "/video/segment.ts": "video/mp2t",
    "/video/segment.m4s": "video/iso.segment",
    "/video/movie.mp4": "video/mp4",
    "/subtitles/en.vtt": "text/vtt",
    "/images/poster.JpEg": "image/jpeg",
  };

  for (const [uri, mimeType] of Object.entries(cases)) {
    const response = execute(uri, {
      "content-type": { value: "text/html" },
      "content-disposition": { value: "attachment; filename=evil.html" },
    });

    assert.equal(header(response, "content-type"), mimeType);
    assert.equal(header(response, "content-disposition"), "inline");
  }
});

test("makes active and unknown content download-only", () => {
  const paths = [
    "/page.html",
    "/image.svg",
    "/worker.js",
    "/module.wasm",
    "/feed.xml",
    "/archive.zip",
    "/extensionless",
    "/encoded.%70df",
    "/trailing.pdf/",
  ];

  for (const uri of paths) {
    const response = execute(uri, {
      "content-type": { value: "text/html" },
      "content-disposition": { value: "inline" },
    });

    assert.equal(header(response, "content-type"), "application/octet-stream");
    assert.equal(header(response, "content-disposition"), "attachment");
  }
});

test("uses only the final literal extension", () => {
  const response = execute("/payload.html.pdf");

  assert.equal(header(response, "content-type"), "application/pdf");
  assert.equal(header(response, "content-disposition"), "inline");
});

test("ignores the separate CloudFront query string", () => {
  const response = execute("/movie.mp4", {}, {
    querystring: { download: { value: "html" } },
  });

  assert.equal(header(response, "content-type"), "video/mp4");
});

test("adds browser security headers and preserves unrelated response data", () => {
  const response = execute("/movie.mp4", {
    "content-security-policy": { value: "script-src *" },
    "x-content-type-options": { value: "off" },
    "referrer-policy": { value: "unsafe-url" },
    etag: { value: "original-etag" },
    "content-range": { value: "bytes 0-99/1000" },
  });

  assert.equal(
    header(response, "content-security-policy"),
    "sandbox; default-src 'none'; base-uri 'none'; form-action 'none'",
  );
  assert.equal(header(response, "x-content-type-options"), "nosniff");
  assert.equal(header(response, "referrer-policy"), "no-referrer");
  assert.equal(header(response, "etag"), "original-etag");
  assert.equal(header(response, "content-range"), "bytes 0-99/1000");
  assert.deepEqual(response.cookies, { session: { value: "unchanged" } });
});

test("handles the controlled error object as plain text", () => {
  const response = execute("/404.txt");

  assert.equal(header(response, "content-type"), "text/plain; charset=utf-8");
  assert.equal(header(response, "content-disposition"), "inline");
});
