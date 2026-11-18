import { useSyncExternalStore } from 'react'
import {
  getDemoAccountSnapshot,
  getDemoProfilePath,
  hasDemoAccount,
  loginDemoAccount,
  logoutDemoAccount,
  subscribeDemoAccount,
} from '../lib/demoAccount'

export function useDemoAccount() {
  useSyncExternalStore(subscribeDemoAccount, getDemoAccountSnapshot, getDemoAccountSnapshot)
  return {
    isAuthenticated: hasDemoAccount(),
    profilePath: getDemoProfilePath(),
    login: loginDemoAccount,
    logout: logoutDemoAccount,
  }
}
