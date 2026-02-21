/**
 * Global Constants
 * Centralized constants used across the application
 * @author Abdulkerim Sesli
 * @version 1.0.0
 */

// Base URLs
export const BASE_URL = 'https://www.abdulkerimsesli.de';
export const BASE_URL_DEV = 'http://localhost:8080';
export const R2_PUBLIC_BASE_URL = 'https://img.abdulkerimsesli.de';
export const R2_ICONS_BASE_URL = `${R2_PUBLIC_BASE_URL}/icons`;
export const ICONS_VERSION = '20260221';

export function iconUrl(filename) {
  return `${R2_ICONS_BASE_URL}/${filename}?v=${ICONS_VERSION}`;
}
