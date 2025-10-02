// supabase/functions/s3-upload/index.ts
// Deno + npm пакеты. Работает в Edge Functions Supabase.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  S3Client,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  ListPartsCommand,
  AbortMultipartUploadCommand,
  UploadPartCommand,
} from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

const ALLOW_ORIGIN =
  Deno.env.get("CORS_ALLOW_ORIGIN") ?? "*"; // можно перечислять через запятую
const DEFAULT_BUCKET = Deno.env.get("S3_BUCKET") ?? "";
if (!DEFAULT_BUCKET) console.warn("WARNING: S3_BUCKET is not set");
try {
  const { S3Client } = await import("npm:@aws-sdk/client-s3");
  const { getSignedUrl } = await import("npm:@aws-sdk/s3-request-presigner");
   } catch (error) {
  console.error("❌ Ошибка загрузки модулей:", error.message);
}
const s3 = new S3Client({
  region: Deno.env.get("S3_REGION") ?? "ru-7",
  endpoint: Deno.env.get("S3_ENDPOINT")!, // напр. https://s3.storage.selcloud.ru  (укажи свой)
  credentials: {
    accessKeyId: Deno.env.get("S3_ACCESS_KEY")!,
    secretAccessKey: Deno.env.get("S3_SECRET_KEY")!,
  },
  forcePathStyle: (Deno.env.get("S3_PUBLIC_URL") ?? "true") === "true",
});

function cors(headers: Record<string, string> = {}) {
  return {
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: cors(headers) });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });

  const url = new URL(req.url);
  // path после имени функции (s3-upload/...)
  const route = url.pathname.split("/").slice(2).join("/");

  try {
    if (req.method === "POST" && route === "start") {
      const { key, contentType, bucket } = await req.json();
      const Bucket = (bucket || DEFAULT_BUCKET) as string;
      if (!Bucket || !key) return json({ error: "Missing bucket/key" }, 400);

      const out = await s3.send(
        new CreateMultipartUploadCommand({
          Bucket,
          Key: key,
          ContentType: contentType || "application/octet-stream",
        }),
      );

      return json({
        uploadId: out.UploadId,
        bucket: Bucket,
        key,
      });
    }

    if (req.method === "GET" && route === "sign-part") {
      const key = url.searchParams.get("key")!;
      const uploadId = url.searchParams.get("uploadId")!;
      const partNumber = Number(url.searchParams.get("partNumber"));
      const bucket = (url.searchParams.get("bucket") || DEFAULT_BUCKET) as string;

      if (!bucket || !key || !uploadId || !partNumber)
        return json({ error: "Missing required params" }, 400);

      const cmd = new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        // Body не требуется для пресайна
      });

      // срок жизни ссылки, сек (можно уменьшить/увеличить)
      const signed = await getSignedUrl(s3, cmd, { expiresIn: 60 * 60 });
      return json({ url: signed });
    }

    if (req.method === "POST" && route === "complete") {
      const { key, uploadId, parts, bucket } = await req.json();
      const Bucket = (bucket || DEFAULT_BUCKET) as string;

      if (!Bucket || !key || !uploadId || !Array.isArray(parts) || parts.length === 0)
        return json({ error: "Invalid payload" }, 400);

      // сортируем по номеру части
      parts.sort((a: any, b: any) => a.PartNumber - b.PartNumber);

      const out = await s3.send(
        new CompleteMultipartUploadCommand({
          Bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts },
        }),
      );

      return json({
        ok: true,
        location: out.Location,
        etag: out.ETag,
        bucket: Bucket,
        key,
      });
    }

    if (req.method === "GET" && route === "list-parts") {
      const key = url.searchParams.get("key")!;
      const uploadId = url.searchParams.get("uploadId")!;
      const bucket = (url.searchParams.get("bucket") || DEFAULT_BUCKET) as string;
      if (!bucket || !key || !uploadId) return json({ error: "Missing params" }, 400);

      const out = await s3.send(
        new ListPartsCommand({ Bucket: bucket, Key: key, UploadId: uploadId }),
      );

      const parts = (out.Parts ?? []).map((p) => ({
        PartNumber: p.PartNumber!,
        ETag: p.ETag!,
        Size: p.Size!,
      }));

      return json({ parts });
    }

    if (req.method === "POST" && route === "abort") {
      const { key, uploadId, bucket } = await req.json();
      const Bucket = (bucket || DEFAULT_BUCKET) as string;
      if (!Bucket || !key || !uploadId) return json({ error: "Missing params" }, 400);

      await s3.send(
        new AbortMultipartUploadCommand({ Bucket, Key: key, UploadId: uploadId }),
      );
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});