'use client'

import { useState, useEffect, useCallback } from 'react'

export interface ActivityLogItem {
    id: string
    type: 'ADDITION' | 'MODIFICATION' | 'DELETION' | 'CHANGE_REQUEST'
    timestamp: string
    details: any
}

export function useActivityLogs() {
    const [logs, setLogs] = useState<ActivityLogItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchLogs = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/schedules/activity-logs')
            if (!res.ok) throw new Error('Failed to fetch activity logs')
            const data = await res.json()

            const combinedLogs: ActivityLogItem[] = []

            // Additions
            data.additions?.forEach((item: any) => {
                combinedLogs.push({
                    id: `add-${item.id}`,
                    type: 'ADDITION',
                    timestamp: item.created_at,
                    details: item
                })
            })

            // Modifications
            data.modifications?.forEach((item: any) => {
                combinedLogs.push({
                    id: `mod-${item.original.id}`,
                    type: 'MODIFICATION',
                    timestamp: item.original.superseded_at || item.original.updated_at,
                    details: item
                })
            })

            // Deletions
            data.deletions?.forEach((item: any) => {
                combinedLogs.push({
                    id: `del-${item.id}`,
                    type: 'DELETION',
                    timestamp: item.superseded_at || item.updated_at,
                    details: item
                })
            })

            // Change Requests
            data.changeRequests?.forEach((item: any) => {
                combinedLogs.push({
                    id: `cr-${item.id}`,
                    type: 'CHANGE_REQUEST',
                    timestamp: item.created_at,
                    details: item
                })
            })

            // Sort desc
            combinedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

            setLogs(combinedLogs)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchLogs()
    }, [fetchLogs])

    return {
        logs,
        loading,
        error,
        refresh: fetchLogs
    }
}
