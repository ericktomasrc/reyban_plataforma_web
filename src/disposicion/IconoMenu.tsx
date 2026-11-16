import type { ReactNode } from 'react'

const trazos: Record<string, ReactNode> = {
  'house': <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></>,
  'building': <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-5h6v5M8 7h1m6 0h1M8 11h1m6 0h1"/></>,
  'users': <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/></>,
  'flag': <><path d="M5 21V4m0 1c6-4 8 4 15 0v11c-7 4-9-4-15 0"/></>,
  'layers': <><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/></>,
  'arrow-left-right': <><path d="M3 7h18m-4-4 4 4-4 4M21 17H3m4-4-4 4 4 4"/></>,
  'book-open': <><path d="M12 6c-4-3-7-3-10-2v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-3-1-6-1-10 2Zm0 0v15"/></>,
  'triangle-alert': <><path d="m10.3 3.9-8.7 15A2 2 0 0 0 3.3 22h17.4a2 2 0 0 0 1.7-3.1l-8.7-15a2 2 0 0 0-3.4 0ZM12 9v5m0 4h.01"/></>,
  'chart': <><path d="M4 20h16M6 17V9h3v8m3 0V4h3v13m3 0v-6h3v6"/></>,
  'refresh': <><path d="M20 7h-9m0 0 3-3m-3 3 3 3M4 17h9m0 0-3-3m3 3-3 3"/></>,
  'mail': <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/></>,
  'key': <><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9 2 2-3 3 2 2-3 3-2-2-3 3"/></>,
  'search': <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  'clock': <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>,
  'file-text': <><path d="M6 2h9l5 5v14H6zM15 2v5h5M9 12h8m-8 4h8"/></>,
  'package': <><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm-9 5 9 5 9-5m-9 5v10"/></>,
  'download': <><path d="M12 3v13m-5-5 5 5 5-5M4 20h16"/></>,
  'map-pin': <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  'truck': <><path d="M3 6h11v11H3zM14 10h4l3 4v3h-7M7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></>,
  'shopping-cart': <><path d="M3 4h2l3 12h11l3-9H6M10 21h.01M18 21h.01"/></>,
  'settings': <><circle cx="12" cy="12" r="3"/><path d="M10 2h4l1 3 3 1 3-1 2 4-2 2v3l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-3L1 9l2-4 3 1 3-1z"/></>,
  'circle': <><circle cx="12" cy="12" r="7"/></>
}
export function IconoMenu({ nombre }: { nombre: string }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{trazos[nombre] ?? trazos.circle}</svg>
}
export function iconoDeSimbolo(simbolo: string) {
  const equivalencias: Record<string, string> = {"⌂": "house", "▦": "building", "◎": "users", "⚑": "flag", "◈": "layers", "◆": "building", "⇄": "arrow-left-right", "✎": "book-open", "⚠": "triangle-alert", "▥": "chart", "⇆": "refresh", "✉": "mail", "⚿": "key", "⌕": "search", "◑": "users", "◷": "clock", "▤": "file-text", "☺": "users", "◫": "package", "⇣": "download", "⌖": "map-pin", "⛟": "truck", "▣": "shopping-cart", "◍": "users", "⚙": "settings", "•": "circle", "▨": "building"}
  return equivalencias[simbolo] ?? 'circle'
}
