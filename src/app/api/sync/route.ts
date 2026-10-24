import { NextRequest, NextResponse } from 'next/server'

// In-memory sync cache for quick multi-device handshake on serverless/edge instances
const syncStore = new Map<string, { data: unknown; updatedAt: string }>()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { room, data } = body

    if (!room || typeof room !== 'string' || !data) {
      return NextResponse.json(
        { error: 'Room ID dan data diperlukan' },
        { status: 400 }
      )
    }

    const cleanRoom = room.trim().toLowerCase()
    const payload = {
      data,
      updatedAt: new Date().toISOString(),
    }

    syncStore.set(cleanRoom, payload)

    return NextResponse.json({
      success: true,
      room: cleanRoom,
      updatedAt: payload.updatedAt,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Gagal memproses sinkronisasi', details: String(err) },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const room = searchParams.get('room')

    if (!room) {
      return NextResponse.json(
        { error: 'Parameter room diperlukan' },
        { status: 400 }
      )
    }

    const cleanRoom = room.trim().toLowerCase()
    const item = syncStore.get(cleanRoom)

    if (!item) {
      return NextResponse.json(
        { error: 'Ruang sinkronisasi tidak ditemukan atau belum ada data' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      room: cleanRoom,
      data: item.data,
      updatedAt: item.updatedAt,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Gagal mengambil data sinkronisasi', details: String(err) },
      { status: 500 }
    )
  }
}
