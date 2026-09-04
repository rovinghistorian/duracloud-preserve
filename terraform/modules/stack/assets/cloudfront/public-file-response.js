var INLINE_MIME_TYPES = {
  "aac": "audio/aac",
  "avif": "image/avif",
  "gif": "image/gif",
  "jpeg": "image/jpeg",
  "jpg": "image/jpeg",
  "key": "application/octet-stream",
  "m3u8": "application/vnd.apple.mpegurl",
  "m4a": "audio/mp4",
  "m4s": "video/iso.segment",
  "mov": "video/quicktime",
  "mp3": "audio/mpeg",
  "mp4": "video/mp4",
  "ogg": "audio/ogg",
  "pdf": "application/pdf",
  "png": "image/png",
  "ts": "video/mp2t",
  "vtt": "text/vtt",
  "wav": "audio/wav",
  "webm": "video/webm",
  "webp": "image/webp"
};

var CONTENT_SECURITY_POLICY = "sandbox; default-src 'none'; base-uri 'none'; form-action 'none'";

function literalExtension(uri) {
  var segment = uri.substring(uri.lastIndexOf("/") + 1);
  var dot = segment.lastIndexOf(".");

  if (dot <= 0 || dot === segment.length - 1) {
    return "";
  }

  var extension = segment.substring(dot + 1);
  if (!/^[A-Za-z0-9]+$/.test(extension)) {
    return "";
  }

  return extension.toLowerCase();
}

function setHeader(headers, name, value) {
  headers[name] = { value: value };
}

function handler(event) {
  var request = event.request;
  var response = event.response;
  var headers = response.headers;
  var uri = request.uri || "";

  setHeader(headers, "content-security-policy", CONTENT_SECURITY_POLICY);
  setHeader(headers, "x-content-type-options", "nosniff");
  setHeader(headers, "referrer-policy", "no-referrer");

  if (uri === "/404.txt") {
    setHeader(headers, "content-type", "text/plain; charset=utf-8");
    setHeader(headers, "content-disposition", "inline");
    return response;
  }

  var mimeType = INLINE_MIME_TYPES[literalExtension(uri)];
  if (mimeType) {
    setHeader(headers, "content-type", mimeType);
    setHeader(headers, "content-disposition", "inline");
  } else {
    setHeader(headers, "content-type", "application/octet-stream");
    setHeader(headers, "content-disposition", "attachment");
  }

  return response;
}
