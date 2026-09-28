/**
 * Fetches public images used by the report template.
 *
 * The template is a sample, so its images come from a public placeholder
 * service rather than from any real company. Every download is cached under the
 * workspace's ignored `local/` directory, so a rebuild does not hit the network
 * again and the repository never stores third-party image bytes.
 *
 * Nothing here is used for a real student's report: their own approved photos go
 * through the report's own asset folders instead.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const USER_AGENT = "naita-report-template/1.0 (report template build)";

export const imageBytes = async (url, timeoutMs = 20_000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Image download failed (${response.status}): ${url}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 1024) {
      throw new Error(
        `Image download returned only ${bytes.length} bytes: ${url}`
      );
    }
    return Buffer.from(bytes);
  } finally {
    clearTimeout(timer);
  }
};

export const imageKind = (bytes) =>
  bytes[0] === 0x89 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x4e &&
  bytes[3] === 0x47
    ? "png"
    : "jpg";

/** Reads JPEG/PNG dimensions from the header, avoiding a full image decode. */
export const imageSize = (bytes) => {
  if (imageKind(bytes) === "png") {
    return { height: bytes.readUInt32BE(20), width: bytes.readUInt32BE(16) };
  }
  let offset = 2;
  while (offset < bytes.length - 9) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    ) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  throw new Error("Could not read JPEG dimensions.");
};

/**
 * Downloads each image once and reuses the cached copy afterwards. A download
 * failure is reported rather than swallowed, because a template missing half
 * its figures is worse than a build that stops with a clear message.
 */
export const fetchImages = async (folder, images) => {
  mkdirSync(folder, { recursive: true });
  return await Promise.all(
    images.map(async (image) => {
      const file = path.join(folder, image.file);
      if (!existsSync(file)) {
        writeFileSync(file, await imageBytes(image.url));
      }
      const bytes = readFileSync(file);
      const { height, width } = imageSize(bytes);
      return {
        ...image,
        height,
        kind: imageKind(bytes),
        path: file,
        width,
      };
    })
  );
};
