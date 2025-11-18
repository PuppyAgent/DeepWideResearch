import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE_PATH = path.join(DATA_DIR, 'waiting_list.json')

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true })
  try {
    await fs.access(FILE_PATH)
  } catch {
    await fs.writeFile(FILE_PATH, '[]', 'utf-8')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const sources = Array.isArray(body?.sources) ? (body.sources as string[]) : []
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'invalid email' }, { status: 400 })
    }

    await ensureDataFile()
    let existing: Array<{ id: string; email: string; sources: string[]; createdAt: number }>
    try {
      const raw = await fs.readFile(FILE_PATH, 'utf-8')
      existing = JSON.parse(raw)
      if (!Array.isArray(existing)) existing = []
    } catch {
      existing = []
    }

    const now = Date.now()
    const entry = { id: randomUUID(), email, sources, createdAt: now }
    existing.push(entry)
    await fs.writeFile(FILE_PATH, JSON.stringify(existing, null, 2), 'utf-8')

    return NextResponse.json({ ok: true, id: entry.id })
  } catch (error) {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}


