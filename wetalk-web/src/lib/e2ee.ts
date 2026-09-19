import { userApi } from '@/api/users'

/**
 * E2EE（简化实现，仅单聊）：
 * - ECDH P-256 派生共享密钥 + AES-GCM 加密文本
 * - 私钥 JWK 存本机 localStorage（设备绑定，换设备历史不可解），公钥注册到服务端
 * - 公钥经 /api/users/e2ee-key 交换，服务端不感知明文
 * - 密文前缀 e2e:（base64(iv):base64(cipher)），群聊不支持
 * - 指纹 = 双方公钥 x 坐标 SHA-256 前 8 字节（双方核对防中间人）
 */

const PRIV_KEY = 'wetalk.e2ee.priv'
const PUB_KEY = 'wetalk.e2ee.pub'
const PREFIX = 'e2e:'

let keyPair: CryptoKeyPair | null = null
const sharedKeys = new Map<number, CryptoKey>()

function b64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

function unb64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
}

export function isEncrypted(content: string | null | undefined): boolean {
  return !!content && content.startsWith(PREFIX)
}

async function importEcdh(jwk: JsonWebKey, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, usages)
}

/** 确保本机密钥对存在并注册公钥（登录后调用一次） */
export async function ensureRegistered(): Promise<void> {
  try {
    if (localStorage.getItem(PRIV_KEY) && localStorage.getItem(PUB_KEY)) {
      const priv = await importEcdh(JSON.parse(localStorage.getItem(PRIV_KEY)!), ['deriveKey'])
      const pub = await importEcdh(JSON.parse(localStorage.getItem(PUB_KEY)!), [])
      keyPair = { privateKey: priv, publicKey: pub }
      await userApi.putE2eeKey(localStorage.getItem(PUB_KEY)!)
      return
    }
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
    const privJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
    const pubJwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
    localStorage.setItem(PRIV_KEY, JSON.stringify(privJwk))
    localStorage.setItem(PUB_KEY, JSON.stringify(pubJwk))
    keyPair = pair
    await userApi.putE2eeKey(JSON.stringify(pubJwk))
  } catch {
    // E2EE 注册失败不阻塞聊天主链路（发送时再报错）
  }
}

async function getSharedKey(peerId: number): Promise<CryptoKey | null> {
  if (sharedKeys.has(peerId)) return sharedKeys.get(peerId)!
  if (!keyPair) return null
  const peerJwkRaw = await userApi.getE2eeKey(peerId).catch(() => null)
  if (!peerJwkRaw) return null
  const peerPub = await importEcdh(JSON.parse(peerJwkRaw), [])
  const key = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: peerPub },
    keyPair.privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
  sharedKeys.set(peerId, key)
  return key
}

/** 加密文本 → e2e:iv:cipher；对方未注册密钥时抛错 */
export async function encrypt(peerId: number, text: string): Promise<string> {
  const key = await getSharedKey(peerId)
  if (!key) throw new Error('对方未开启端到端加密')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text))
  return `${PREFIX}${b64(iv.buffer)}:${b64(cipher)}`
}

/** 解密 e2e: 内容；失败返回占位文本 */
export async function decrypt(peerId: number, content: string): Promise<string> {
  if (!isEncrypted(content)) return content
  try {
    const key = await getSharedKey(peerId)
    if (!key) return '🔒 无法解密（本机无私钥）'
    const [ivB64, cipherB64] = content.slice(PREFIX.length).split(':')
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(ivB64) },
      key,
      unb64(cipherB64)
    )
    return new TextDecoder().decode(plain)
  } catch {
    return '🔒 解密失败'
  }
}

/** 双方公钥 x 坐标 SHA-256 前 8 字节指纹（hex 分组），双方核对防中间人 */
export async function fingerprint(peerId: number): Promise<string> {
  const peerJwkRaw = await userApi.getE2eeKey(peerId).catch(() => null)
  if (!peerJwkRaw || !keyPair) return ''
  const myJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  const joined = JSON.stringify({ a: (myJwk as JsonWebKey).x, b: JSON.parse(peerJwkRaw).x })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(joined))
  return Array.from(new Uint8Array(digest.slice(0, 8)))
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .reduce((acc, cur, i) => (i % 4 === 0 && i > 0 ? `${acc} ${cur}` : acc + cur), '')
}
