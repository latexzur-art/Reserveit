'use client'

import React from 'react'
import { SWRConfig } from 'swr'
import { jsonFetcher } from '@/lib/swr'

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: jsonFetcher,
        dedupingInterval: 5000,
        revalidateOnFocus: true,
        keepPreviousData: true,
        errorRetryCount: 2,
      }}
    >
      {children}
    </SWRConfig>
  )
}
