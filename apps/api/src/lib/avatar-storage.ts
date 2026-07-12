import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type AvatarObject = {
  body: Buffer;
  contentType: string;
};

type AvatarStorageBackend = {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<AvatarObject | null>;
  delete(key: string): Promise<void>;
};

const memoryStore = new Map<string, { body: Buffer; contentType: string }>();

const memoryBackend: AvatarStorageBackend = {
  async put(key, body, contentType) {
    memoryStore.set(key, { body: Buffer.from(body), contentType });
  },
  async get(key) {
    const entry = memoryStore.get(key);
    if (!entry) return null;
    return { body: Buffer.from(entry.body), contentType: entry.contentType };
  },
  async delete(key) {
    memoryStore.delete(key);
  },
};

let r2Client: S3Client | null = null;

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucketName };
}

export function isAvatarStorageConfigured(): boolean {
  return getR2Config() != null;
}

function getR2Client(config: NonNullable<ReturnType<typeof getR2Config>>): S3Client {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return r2Client;
}

function createR2Backend(
  config: NonNullable<ReturnType<typeof getR2Config>>
): AvatarStorageBackend {
  const client = getR2Client(config);
  const bucket = config.bucketName;

  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: "private, max-age=3600",
        })
      );
    },
    async get(key) {
      try {
        const response = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key })
        );
        if (!response.Body) return null;
        const bytes = await response.Body.transformToByteArray();
        return {
          body: Buffer.from(bytes),
          contentType: response.ContentType ?? "application/octet-stream",
        };
      } catch (err) {
        if (
          typeof err === "object" &&
          err !== null &&
          "name" in err &&
          (err as { name?: string }).name === "NoSuchKey"
        ) {
          return null;
        }
        throw err;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

function getBackend(): AvatarStorageBackend {
  const config = getR2Config();
  if (config) return createR2Backend(config);
  if (process.env.NODE_ENV === "production") {
    throw new Error("Avatar storage is not configured");
  }
  return memoryBackend;
}

export function avatarObjectKey(userId: string, contentType: string): string {
  const ext =
    contentType === "image/jpeg"
      ? ".jpg"
      : contentType === "image/png"
        ? ".png"
        : contentType === "image/webp"
          ? ".webp"
          : "";
  return `avatars/${userId}${ext}`;
}

export async function putAvatarObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await getBackend().put(key, body, contentType);
}

export async function getAvatarObject(key: string): Promise<AvatarObject | null> {
  return getBackend().get(key);
}

export async function deleteAvatarObject(key: string): Promise<void> {
  await getBackend().delete(key);
}

/** Test-only helper to reset in-memory avatar storage between tests. */
export function resetAvatarStorageForTests(): void {
  memoryStore.clear();
  r2Client = null;
}
