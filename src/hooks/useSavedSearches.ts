import { useState } from 'react'

const STORAGE_KEY = 'saved-searches'

export interface SavedSearch {
  id: string
  name: string
  filters: {
    search?: string
    species?: string
    size?: string[]
    sex?: string
    sort?: string
  }
  alertsEnabled: boolean
}

function readStorage(): SavedSearch[] {
  return JSON.parse(
    localStorage.getItem(STORAGE_KEY) ?? '[]',
  )
}

function writeStorage(searches: SavedSearch[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(searches),
  )
}

export function useSavedSearches() {
  const [searches, setSearches] = useState(readStorage)

  const saveSearch = (search: SavedSearch) => {
    const updatedSearches = [
      ...searches,
      search,
    ]
    writeStorage(updatedSearches)
    setSearches(updatedSearches)
  }

  const deleteSearch = (id: string) => {
    const updatedSearches = searches.filter((search) => search.id !== id)
    writeStorage(updatedSearches)
    setSearches(updatedSearches)
  }

  const renameSearch = (id: string, newName: string) => {
    const updatedSearches = searches.map((search) =>
      search.id === id
        ? {
            ...search,
            name: newName,
          }
        : search,
    )
    writeStorage(updatedSearches)
    setSearches(updatedSearches)
  }

  const toggleAlert = (id: string) => {
    const updatedSearches = searches.map((search) =>
      search.id === id
        ? {
            ...search,
            alertsEnabled: !search.alertsEnabled,
          }
        : search,
    )
    writeStorage(updatedSearches)
    setSearches(updatedSearches)
  }

  return {
    searches,
    saveSearch,
    deleteSearch,
    renameSearch,
    toggleAlert,
  }
}
