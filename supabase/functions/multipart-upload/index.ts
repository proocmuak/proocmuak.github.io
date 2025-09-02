import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { 
  S3Client, 
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} from "npm:@aws-sdk/client-s3"
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET, PUT, DELETE",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Initialize S3 client
const s3 = new S3Client({
  region: Deno.env.get("S3_REGION") || "ru-7",
  endpoint: Deno.env.get("S3_ENDPOINT") || "https://s3.ru-7.storage.selcloud.ru",
  forcePathStyle: true,
  credentials: {
    accessKeyId: Deno.env.get("S3_ACCESS_KEY") || "",
    secretAccessKey: Deno.env.get("S3_SECRET_KEY") || "",
  },
})

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      status: 200,
      headers: corsHeaders
    })
  }

  try {
    // Проверка переменных окружения
    const requiredEnvVars = ['S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_ENDPOINT', 'S3_BUCKET']
    for (const envVar of requiredEnvVars) {
      if (!Deno.env.get(envVar)) {
        return new Response(
          JSON.stringify({ error: `Missing environment variable: ${envVar}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    }

    // Parse request body
    let body;
    try {
      body = await req.json()
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { action, fileName, contentType, uploadId, key, partNumber, parts, chunkData } = body
    
    if (!action) {
      return new Response(
        JSON.stringify({ error: "Action parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const bucket = Deno.env.get("S3_BUCKET")!

    // 1. Initialize multipart upload
    if (action === "init") {
      if (!fileName) {
        return new Response(
          JSON.stringify({ error: "fileName required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
      if (!contentType) {
        return new Response(
          JSON.stringify({ error: "contentType required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
      if (!contentType.startsWith('video/')) {
        return new Response(
          JSON.stringify({ error: "Only video files are allowed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      const safeFilename = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
      const key = `videos/${crypto.randomUUID()}-${safeFilename}`

      const command = new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      })

      const { UploadId, Key } = await s3.send(command)
      const publicUrl = `${Deno.env.get("S3_PUBLIC_URL")}/${Key}`

      return new Response(
        JSON.stringify({ 
          uploadId: UploadId, 
          key: Key,
          publicUrl: publicUrl
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // 2. Generate presigned URL for a part
    if (action === "part") {
      if (!uploadId || !key || !partNumber) {
        return new Response(
          JSON.stringify({ error: "uploadId, key, and partNumber are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      })

      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 })
      
      return new Response(
        JSON.stringify({ signedUrl }),
        { 
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // 3. Upload part through proxy (решение CORS проблемы)
    if (action === "upload-part") {
      if (!uploadId || !key || !partNumber || !chunkData) {
        return new Response(
          JSON.stringify({ error: "uploadId, key, partNumber, and chunkData are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      // Get signed URL
      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      })

      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 })

      // Convert base64 chunk back to binary
      const chunkBuffer = Uint8Array.from(atob(chunkData), c => c.charCodeAt(0))

      // Upload through Edge Function (обход CORS)
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: chunkBuffer,
        headers: { 'Content-Type': 'application/octet-stream' }
      })

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`)
      }

      const etag = uploadResponse.headers.get('ETag')
      
      return new Response(
        JSON.stringify({ 
          success: true,
          etag: etag
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // 4. Complete multipart upload
    if (action === "complete") {
      if (!uploadId || !key || !parts) {
        return new Response(
          JSON.stringify({ error: "uploadId, key, and parts are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      const validParts = parts.map((part: any) => ({
        PartNumber: part.PartNumber,
        ETag: part.ETag?.replace(/"/g, '') || ''
      }))

      const command = new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: validParts },
      })

      const result = await s3.send(command)
      const publicUrl = `${Deno.env.get("S3_PUBLIC_URL")}/${key}`

      return new Response(
        JSON.stringify({ 
          success: true, 
          location: result.Location,
          key: key,
          publicUrl: publicUrl
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // 5. Abort multipart upload
    if (action === "abort") {
      if (!uploadId || !key) {
        return new Response(
          JSON.stringify({ error: "uploadId and key are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      const command = new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      })

      await s3.send(command)

      return new Response(
        JSON.stringify({ success: true }),
        { 
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: init, part, upload-part, complete, or abort" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (err) {
    console.error("Edge function error:", err)
    return new Response(
      JSON.stringify({ 
        error: err.message,
        details: err.toString() 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }
})  