import { LimitWeight, PrismaClient, UnitOfMeasure } from '@prisma/client'
import dotenv from "dotenv";
dotenv.config()
const metrcMode = process.env.METRC_MODE


const prisma = new PrismaClient({
  errorFormat: 'colorless',
})
export interface Context {
  prisma: PrismaClient
}

export const context: Context = {
  prisma: prisma,
}

export function getConvertedWeight(qty: number, itemUnit: UnitOfMeasure, limitUnit: UnitOfMeasure) {
  let convertedQty = qty
  if(itemUnit == UnitOfMeasure.g){
    if(limitUnit == UnitOfMeasure.oz) convertedQty = qty * 0.035274
    if(limitUnit == UnitOfMeasure.mg) convertedQty = qty * 1000
  }
  if(itemUnit == UnitOfMeasure.mg){
    if(limitUnit == UnitOfMeasure.oz) convertedQty = qty * 0.000035274
    if(limitUnit == UnitOfMeasure.g) convertedQty = qty * 0.001
  }
  if(itemUnit == UnitOfMeasure.oz){
    if(limitUnit == UnitOfMeasure.g) convertedQty = qty * 28.3495
    if(limitUnit == UnitOfMeasure.mg) convertedQty = qty * 28349.5
  }
  return convertedQty
}

export function truncateToTwoDecimals(num: number) {
  return Math.floor(num * 100) / 100;
}

export function setFourDecimals(num: number) {
  return Math.floor(num * 10000) / 10000;
}

export type Timezones = 'AKST' | 'CST' | 'EST' | 'HAST' | 'MST' | 'PST';

export const timezoneMap: Record<Timezones, string> = {
  'AKST': 'America/Anchorage',    // Alaska
  'CST': 'America/Chicago',       // Central
  'EST': 'America/New_York',      // Eastern
  'HAST': 'Pacific/Honolulu',     // Hawaii
  'MST': 'America/Denver',        // Mountain
  'PST': 'America/Los_Angeles'    // Pacific
};

export function formatHour(hour) {
  const date = new Date(2000, 0, 1, hour);
  return date.toLocaleString('en-US', { hour: 'numeric', hour12: true });
}

export function getFiveMinutesBeforeInISOStyle(dateStr) {
  const dateObj = new Date(dateStr);
  const fiveMinutesBefore = new Date(dateObj.getTime() - 5 * 60 * 1000);
  
  const pad = (num, size = 2) => String(num).padStart(size, '0');
  const year = fiveMinutesBefore.getUTCFullYear();
  const month = pad(fiveMinutesBefore.getUTCMonth() + 1);
  const day = pad(fiveMinutesBefore.getUTCDate());
  const hours = pad(fiveMinutesBefore.getUTCHours());
  const minutes = pad(fiveMinutesBefore.getUTCMinutes());
  const seconds = pad(fiveMinutesBefore.getUTCSeconds());
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}

export const endPoints = metrcMode == 'sandbox' ? {
  OK: 'https://sandbox-api-ok.metrc.com/'
} : {
  OK: 'https://api-ok.metrc.com/'
}

