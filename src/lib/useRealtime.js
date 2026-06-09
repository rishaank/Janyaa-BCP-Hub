import { useEffect } from 'react'
import { supabase } from './supabase'

// Subscribe to live Postgres changes on one or more tables and run `onChange`
// (typically a page's reload fn) whenever anyone inserts/updates/deletes.
// No-ops harmlessly until the tables are added to the supabase_realtime
// publication (see migration 0003).
export function useRealtime(tables, onChange) {
  useEffect(() => {
    const list = Array.isArray(tables) ? tables : [tables]
    // Unique per hook instance: two mounted components can watch the same table
    // without colliding on the channel topic (which throws ".on after subscribe").
    const channel = supabase.channel(`rt-${list.join('-')}-${Math.random().toString(36).slice(2)}`)
    list.forEach((table) =>
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange),
    )
    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
