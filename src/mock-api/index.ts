/**
 * Public entry point of the data layer. UI code imports from '@/mock-api' only.
 * To move to a real backend, re-implement `api` with HTTP calls and keep the types.
 */
export { api, ApiError } from './api';
export type { Api } from './api';
export * from './types';
export { evaluateCharge, blockReasonsFor, cartTotal, round2 } from './engine';
export { dayKey, addDays, parseDayKey } from './dates';
export { DEMO_PARENT_ID, DEMO_STUDENT_ID, DEMO_VENDOR_ID } from './seed';
export type { ChangeEvent } from './store';
