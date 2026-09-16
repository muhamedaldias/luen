export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
  }
}

const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

export interface UploadResult {
  image_id: string;
  url: string;
  width: number;
  height: number;
  size_bytes: number;
  mime: string;
}

export interface OperationResponse {
  status: "done" | "processing";
  result_url?: string;
  job_id?: string;
}

export interface JobStatus {
  status: "processing" | "done" | "error";
  result_url?: string | null;
  error?: string | null;
}

async function readError(res: Response): Promise<ApiError> {
  let detail = res.statusText || `HTTP ${res.status}`;
  try {
    const body = await res.json();
    if (typeof body.detail === "string") detail = body.detail;
  } catch {
    // keep statusText fallback
  }
  return new ApiError(res.status, detail);
}

export function resolveUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE}${path}`;
}

export async function uploadImage(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(`${API_BASE}/api/images/upload`, { method: "POST", body: form });
  if (!res.ok) throw await readError(res);
  return res.json();
}

export async function runOperation(
  name: string,
  imageId: string,
  params: Record<string, number | string> = {},
): Promise<OperationResponse> {
  const res = await fetch(`${API_BASE}/api/operations/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_id: imageId, params }),
  });
  if (!res.ok) throw await readError(res);
  return res.json();
}

export async function pollJob(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/api/operations/${jobId}/status`);
  if (!res.ok) throw await readError(res);
  return res.json();
}

export async function runAndWait(
  name: string,
  imageId: string,
  params: Record<string, number | string> = {},
  onStatus?: (status: JobStatus) => void,
): Promise<string> {
  const first = await runOperation(name, imageId, params);
  if (first.status === "done" && first.result_url) {
    onStatus?.({ status: "done", result_url: first.result_url });
    return first.result_url;
  }
  if (!first.job_id) throw new ApiError(500, "operation returned no job id");

  while (true) {
    await new Promise((r) => setTimeout(r, 800));
    const status = await pollJob(first.job_id);
    onStatus?.(status);
    if (status.status === "done" && status.result_url) return status.result_url;
    if (status.status === "error") throw new ApiError(500, status.error ?? "operation failed");
  }
}