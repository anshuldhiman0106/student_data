import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const body = await req.json()
    const amount = Number(body.amount) || 10
    const studentId = body.studentId || 'unknown'

    const key = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!key || !secret) {
      return NextResponse.json({ error: 'Razorpay keys not configured' }, { status: 500 })
    }

    const amountPaise = Math.round(amount * 100)
    const payload = {
      amount: amountPaise,
      currency: 'INR',
      receipt: `stu_${studentId}_${Date.now()}`,
      payment_capture: 1,
    }

    const auth = Buffer.from(`${key}:${secret}`).toString('base64')
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!r.ok) {
      const errText = await r.text()
      return NextResponse.json({ error: 'Razorpay order creation failed', details: errText }, { status: 502 })
    }

    const order = await r.json()
    return NextResponse.json({ order })
  } catch (err) {
    return NextResponse.json({ error: (err && err.message) || String(err) }, { status: 500 })
  }
}
