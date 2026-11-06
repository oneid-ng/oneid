/**
 * apps/web/src/lib/credential-store.ts
 *
 * Client-Side Encrypted Credential Vault (README §6.2, ADR-0003).
 *
 * Stores W3C SD-JWT Verifiable Credentials locally on the citizen's device
 * using browser IndexedDB and Web Cryptography (AES-GCM-256).
 * Never sends raw credentials or unrevealed claims back to the central server.
 * Provides in-memory fallback for SSR and headless environments.
 */

export interface StoredCredential {
  id: string;
  credentialHash: string;
  issuerName: string;
  issuerDomain: string;
  sdJwt: string;
  claims: Record<string, unknown>;
  status: "active" | "revoked" | "expired";
  expiresAt: string;
  issuedAt: string;
  chainTx?: string | null;
  ledger?: number | null;
}

const DB_NAME = "oneid_vault";
const STORE_NAME = "credentials";
const DB_VERSION = 1;
const FALLBACK_SECRET = "oneid-device-vault-key-salt";

// In-memory fallback for environments without window or IndexedDB
const memoryStore = new Map<string, string>();

async function getVaultKey(): Promise<CryptoKey | null> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return null;
  }
  try {
    const rawKey = new TextEncoder().encode(FALLBACK_SECRET);
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "PBKDF2" },
      false,
      ["deriveKey"],
    );

    return await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: new TextEncoder().encode("oneid-salt-2026"),
        iterations: 100_000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  } catch {
    return null;
  }
}

async function encryptData(data: string): Promise<string> {
  const key = await getVaultKey();
  if (!key || typeof window === "undefined") {
    return btoa(data);
  }

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

async function decryptData(encryptedB64: string): Promise<string> {
  const key = await getVaultKey();
  if (!key || typeof window === "undefined") {
    return atob(encryptedB64);
  }

  try {
    const combined = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data,
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    // If decryption fails (e.g. plaintext fallback)
    return atob(encryptedB64);
  }
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => resolve(null);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
    } catch {
      resolve(null);
    }
  });
}

export const CredentialVault = {
  async save(credential: StoredCredential): Promise<void> {
    const serialized = JSON.stringify(credential);
    const encrypted = await encryptData(serialized);

    const db = await openDb();
    if (!db) {
      memoryStore.set(credential.id, encrypted);
      memoryStore.set(credential.credentialHash, encrypted);
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put({
          id: credential.id,
          encrypted,
          credentialHash: credential.credentialHash,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  },

  async get(idOrHash: string): Promise<StoredCredential | null> {
    const db = await openDb();
    let encrypted: string | undefined;

    if (!db) {
      encrypted = memoryStore.get(idOrHash);
    } else {
      encrypted = await new Promise<string | undefined>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(idOrHash);
          req.onsuccess = () => {
            if (req.result) resolve(req.result.encrypted);
            else {
              // Try scanning if queried by credentialHash
              const allReq = store.getAll();
              allReq.onsuccess = () => {
                const found = (allReq.result || []).find(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (r: any) => r.credentialHash === idOrHash,
                );
                resolve(found?.encrypted);
              };
              allReq.onerror = () => resolve(undefined);
            }
          };
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      });
    }

    if (!encrypted) return null;

    try {
      const decrypted = await decryptData(encrypted);
      return JSON.parse(decrypted) as StoredCredential;
    } catch {
      return null;
    }
  },

  async list(): Promise<StoredCredential[]> {
    const db = await openDb();
    const results: StoredCredential[] = [];

    if (!db) {
      for (const enc of memoryStore.values()) {
        try {
          const decrypted = await decryptData(enc);
          const cred = JSON.parse(decrypted) as StoredCredential;
          if (!results.some((r) => r.id === cred.id)) {
            results.push(cred);
          }
        } catch {
          // ignore invalid
        }
      }
      return results;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = async () => {
          const rows = req.result || [];
          for (const row of rows) {
            try {
              const decrypted = await decryptData(row.encrypted);
              results.push(JSON.parse(decrypted) as StoredCredential);
            } catch {
              // skip
            }
          }
          resolve(results);
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  },

  async delete(id: string): Promise<void> {
    const db = await openDb();
    if (!db) {
      memoryStore.delete(id);
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  },

  clearMemory(): void {
    memoryStore.clear();
  },
};
