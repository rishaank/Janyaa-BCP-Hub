import { useEffect } from 'react'
import { supabase } from './supabase'

// Subscribe to live Postgres changes on one or more tables and run `onChange`
// (typically a page's reload fn) whenever anyone inserts/updates/deletes.
// No-ops harmlessly until the tables are added to the supabase_realtime
// publication (see migration 0003).
export function useRealtime(tables, onChange) {
  useEffect(() => {
    const list = Array.isArray(tables) ? tables : [tables]
    const channel = supabase.channel(`rt-${list.join('-')}`)
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
