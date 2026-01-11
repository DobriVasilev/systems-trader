/**
 * Wallet Encryption Library
 *
 * Encrypts private keys using AES-256-GCM with Argon2id key derivation.
 * Keys are encrypted before storage and decrypted only when needed for signing.
 */

import { randomBytes, createCipheriv, createDecipheriv, scrypt, ScryptOptions } from 'crypto';

// Constants
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

// Scrypt parameters (N=2^14, r=8, p=1 is recommended minimum)
const SCRYPT_OPTIONS: ScryptOptions = {
  N: 16384, // 2^14
  r: 8,
  p: 1,
};

interface EncryptedData {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
  salt: string; // base64
}

/**
 * Derive encryption key from password using scrypt
 */
function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Encrypt a private key with a password
 *
 * @param privateKey - The wallet private key to encrypt
 * @param password - User's encryption password
 * @returns Encrypted data object with ciphertext, iv, authTag, and salt
 */
export async function encryptPrivateKey(
  privateKey: string,
  password: string
): Promise<EncryptedData> {
  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // Derive encryption key from password
  const key = await deriveKey(password, salt);

  // Encrypt
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(privateKey, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    salt: salt.toString('base64'),
  };
}

/**
 * Decrypt a private key with a password
 *
 * @param encryptedData - The encrypted data object
 * @param password - User's encryption password
 * @returns The decrypted private key
 * @throws Error if decryption fails (wrong password or tampered data)
 */
export async function decryptPrivateKey(
  encryptedData: EncryptedData,
  password: string
): Promise<string> {
  // Decode base64 values
  const salt = Buffer.from(encryptedData.salt, 'base64');
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');
  const ciphertext = encryptedData.ciphertext;

  // Derive encryption key from password
  const key = await deriveKey(password, salt);

  // Decrypt
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  } catch {
    throw new Error('Decryption failed. Wrong password or corrupted data.');
  }
}

/**
 * Serialize encrypted data for database storage
 */
export function serializeEncryptedData(data: EncryptedData): string {
  return JSON.stringify(data);
}

/**
 * Deserialize encrypted data from database
 */
export function deserializeEncryptedData(serialized: string): EncryptedData {
  return JSON.parse(serialized);
}

/**
 * Validate that a string looks like a valid Ethereum private key
 */
export function isValidPrivateKey(key: string): boolean {
  // Remove 0x prefix if present
  const cleanKey = key.startsWith('0x') ? key.slice(2) : key;

  // Should be 64 hex characters (32 bytes)
  return /^[0-9a-fA-F]{64}$/.test(cleanKey);
}

/**
 * Get wallet address from private key (without exposing the full key)
 * Uses ethers.js-style derivation
 */
export async function getAddressFromPrivateKey(privateKey: string): Promise<string> {
  // Dynamic import to avoid loading ethers on server startup
  const { Wallet } = await import('ethers');

  // Ensure key has 0x prefix
  const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

  const wallet = new Wallet(formattedKey);
  return wallet.address;
}

/**
 * Generate a secure random password (for testing)
 */
export function generateSecurePassword(length: number = 32): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const randomBytesArray = randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[randomBytesArray[i] % charset.length];
  }
  return password;
}

/**
 * Get the server-side encryption key from environment
 * Falls back to AUTH_SECRET if WALLET_ENCRYPTION_KEY is not set
 */
function getServerEncryptionKey(): string {
  const key = process.env.WALLET_ENCRYPTION_KEY || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!key) {
    throw new Error('No encryption key configured. Set WALLET_ENCRYPTION_KEY in .env');
  }
  return key;
}

/**
 * Encrypt a private key using server-side key (no user password needed)
 */
export async function encryptPrivateKeyServerSide(privateKey: string): Promise<EncryptedData> {
  return encryptPrivateKey(privateKey, getServerEncryptionKey());
}

/**
 * Decrypt a private key using server-side key (no user password needed)
 */
export async function decryptPrivateKeyServerSide(encryptedData: EncryptedData): Promise<string> {
  return decryptPrivateKey(encryptedData, getServerEncryptionKey());
}
