// API Client（中文註解：集中處理 fetch 與錯誤格式，避免各頁面重複寫）

export type ApiOk<T> = { success: true; data: T }
export type ApiFail = { success: false; code: string; message: string; detail?: unknown }
export type ApiResponse<T> = ApiOk<T> | ApiFail

// 中文註解：HTTP 401 時通知 authStore 清除登入狀態（使用 CustomEvent 避免循環引用）
const dispatchUnauthorized = () => window.dispatchEvent(new CustomEvent('api:unauthorized'))

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' })
  if (res.status === 401) {
    dispatchUnauthorized()
    throw new Error('UNAUTHORIZED: 登入已逾時，請重新登入')
  }
  // 中文註解：先讀 text，避免空 body 直接呼叫 res.json() 爆錯
  const text = await res.text()
  if (!text.trim()) throw new Error(`HTTP_${res.status}: 空回應`)
  const json = JSON.parse(text) as ApiResponse<T>
  if (!res.ok || !json.success) {
    throw new Error(!json.success ? `${json.code}: ${json.message}` : `HTTP_${res.status}`)
  }
  return json.data
}

export async function apiSend<T>(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 401) {
    dispatchUnauthorized()
    throw new Error('UNAUTHORIZED: 登入已逾時，請重新登入')
  }
  // 中文註解：先讀 text，避免空 body（204 / DELETE）直接呼叫 res.json() 爆錯
  const text = await res.text()
  if (!text.trim()) {
    if (!res.ok) throw new Error(`HTTP_${res.status}`)
    return null as T
  }
  const json = JSON.parse(text) as ApiResponse<T>
  if (!res.ok || !json.success) {
    throw new Error(!json.success ? `${json.code}: ${json.message}` : `HTTP_${res.status}`)
  }
  return json.data
}

