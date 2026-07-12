export const MAX_AVATAR_BYTES = 512 * 1024;
export const MAX_AVATAR_DIMENSION = 1024;

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type AvatarValidationResult =
  | { ok: true; contentType: string; width: number; height: number }
  | { ok: false; error: string };

function isPng(buf: Buffer): boolean {
  return (
    buf.length >= 24 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  );
}

function pngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (!isPng(buf)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function isJpeg(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function jpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (!isJpeg(buf)) return null;
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = buf.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      return {
        height: buf.readUInt16BE(offset + 5),
        width: buf.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function isWebp(buf: Buffer): boolean {
  return (
    buf.length >= 30 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  );
}

function webpDimensions(buf: Buffer): { width: number; height: number } | null {
  if (!isWebp(buf)) return null;
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    if (buf.length < 30) return null;
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    if (buf.length < 25) return null;
    const bits = buf.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === "VP8X") {
    if (buf.length < 30) return null;
    const width = 1 + buf.readUIntLE(24, 3);
    const height = 1 + buf.readUIntLE(27, 3);
    return { width, height };
  }
  return null;
}

function detectContentType(buf: Buffer): string | null {
  if (isPng(buf)) return "image/png";
  if (isJpeg(buf)) return "image/jpeg";
  if (isWebp(buf)) return "image/webp";
  return null;
}

function readDimensions(
  buf: Buffer,
  contentType: string
): { width: number; height: number } | null {
  if (contentType === "image/png") return pngDimensions(buf);
  if (contentType === "image/jpeg") return jpegDimensions(buf);
  if (contentType === "image/webp") return webpDimensions(buf);
  return null;
}

export function buildAvatarApiUrl(
  userId: string,
  updatedAt: Date | null
): string | null {
  if (!updatedAt) return null;
  return `/api/auth/avatars/${userId}?v=${updatedAt.getTime()}`;
}

export function validateAvatarUpload(
  buf: Buffer,
  declaredContentType?: string
): AvatarValidationResult {
  if (!buf.length) {
    return { ok: false, error: "Avatar image is required" };
  }
  if (buf.length > MAX_AVATAR_BYTES) {
    return { ok: false, error: "Avatar must be 512 KB or smaller" };
  }

  const detected = detectContentType(buf);
  if (!detected) {
    return { ok: false, error: "Avatar must be a JPEG, PNG, or WebP image" };
  }

  const normalizedDeclared = declaredContentType?.split(";")[0]?.trim().toLowerCase();
  if (normalizedDeclared && !ALLOWED_CONTENT_TYPES.has(normalizedDeclared)) {
    return { ok: false, error: "Avatar must be a JPEG, PNG, or WebP image" };
  }
  if (normalizedDeclared && normalizedDeclared !== detected) {
    return { ok: false, error: "Avatar content does not match its type" };
  }

  const dimensions = readDimensions(buf, detected);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
    return { ok: false, error: "Could not read avatar dimensions" };
  }
  if (
    dimensions.width > MAX_AVATAR_DIMENSION ||
    dimensions.height > MAX_AVATAR_DIMENSION
  ) {
    return {
      ok: false,
      error: `Avatar dimensions must be ${MAX_AVATAR_DIMENSION}px or smaller`,
    };
  }

  return {
    ok: true,
    contentType: detected,
    width: dimensions.width,
    height: dimensions.height,
  };
}
