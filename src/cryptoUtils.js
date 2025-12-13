// src/cryptoUtils.js
import CryptoJS from 'crypto-js';

// ⚠️ SECURITY NOTE: In a real production app, use import.meta.env.VITE_APP_SECRET
// For this prototype, we are using a hardcoded key.
const SECRET_KEY = "sri-lanka-disaster-secure-key-2025"; 

/**
 * Encrypts a text string.
 * Returns null if the value is empty.
 */
export const encryptData = (text) => {
  if (!text) return null;
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
};

/**
 * Decrypts an encrypted string.
 * Returns the original text, or 'Error' if decryption fails.
 */
export const decryptData = (cipherText) => {
  if (!cipherText) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText || 'Decryption Failed';
  } catch (error) {
    console.error("Decryption error:", error);
    return 'Data Corrupted';
  }
};