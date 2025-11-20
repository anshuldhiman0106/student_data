import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req) {
  try {
    const body = await req.json()
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body
    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!secret) return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 500 })

    const generated = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (generated === razorpay_signature) {
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'invalid signature' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message || String(err) }, { status: 500 })
  }
}
