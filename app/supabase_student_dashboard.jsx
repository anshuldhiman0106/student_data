'use client'
import React, { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { saveAs } from 'file-saver'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Do not create the Supabase client at module eval time because malformed or
// missing env vars will throw during Next.js render. Create it inside the
// component after validating the env values.

export default function StudentDashboard() {
  const [supabaseClient, setSupabaseClient] = useState(null)
  const [supabaseConfigValid, setSupabaseConfigValid] = useState(true)
  const [authUser, setAuthUser] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState('login') // 'login' or 'signup'
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminPanelOpen, setAdminPanelOpen] = useState(false)

  // Create the Supabase client on the client-side after validating env
  useEffect(() => {
    try {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        setSupabaseConfigValid(false)
        setSupabaseClient(null)
        return
      }
      // validate URL format
      new URL(SUPABASE_URL)
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      setSupabaseClient(client)
      setSupabaseConfigValid(true)
      // listen for auth state changes
      let sub = null
      ;(async () => {
        // set initial session/user
        try {
          const { data } = await client.auth.getSession()
          const user = data?.session?.user || null
          setAuthUser(user)
          const list = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)
          setIsAdmin(user && user.email ? list.includes(user.email.toLowerCase()) : false)
        } catch (e) {
          console.warn('Failed to get initial session', e)
        }

        // If the OAuth callback returned tokens in the URL fragment (e.g. when
        // provider redirects directly to the site), parse them and set the
        // session so the client becomes authenticated. This helps if the
        // browser was redirected to an origin and the app needs to pick up the
        // access token from the URL.
        try {
          if (typeof window !== 'undefined' && window.location && window.location.hash) {
            const hash = window.location.hash.substring(1)
            const params = Object.fromEntries(new URLSearchParams(hash))
            if (params.access_token) {
              await client.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token })
              // Remove fragment to keep URL clean
              history.replaceState(null, '', window.location.pathname + window.location.search)
            }
          }
        } catch (e) {
          // non-fatal
          console.debug('No URL token to set or failed to set session', e)
        }

        const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
          const user = session?.user || null
          setAuthUser(user)
          const list = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)
          setIsAdmin(user && user.email ? list.includes(user.email.toLowerCase()) : false)
        })
        sub = subscription
      })()
      return () => { if (sub && sub.unsubscribe) try { sub.unsubscribe() } catch(e){} }
    } catch (err) {
      console.error('Invalid Supabase config:', err)
      setSupabaseConfigValid(false)
      setSupabaseClient(null)
    }
  }, [])

  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterSemester, setFilterSemester] = useState('')
  const [filterMissingPhoto, setFilterMissingPhoto] = useState(false)

  const [selected, setSelected] = useState(new Set())
  const [detail, setDetail] = useState(null)

  const PAGE_SIZE_OPTIONS = [25, 50, 100]

  const buildQuery = () => {
    if (!supabaseClient) return null
    let query = supabaseClient.from('students').select('*', { count: 'exact' })
    if (search.trim()) {
      const q = search.trim()
      query = query.or(
        `name.ilike.%${q}%,father.ilike.%${q}%,class.ilike.%${q}%,university_roll.ilike.%${q}%,phone.ilike.%${q}%`
      )
    }
    if (filterClass) query = query.eq('class', filterClass)
    if (filterSemester) query = query.eq('semester', filterSemester)
    if (filterMissingPhoto) query = query.is_('photo_url', null)
    query = query.order('student_id').range((page - 1) * pageSize, page * pageSize - 1)
    return query
  }

  const fetchStudents = async () => {
    if (!supabaseClient) return
    setLoading(true)
    const q = buildQuery()
    if (!q) {
      setLoading(false)
      return
    }
    const { data, count } = await q
    setStudents(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  useEffect(() => {
    fetchStudents();
  }, [page, pageSize, search, filterClass, filterSemester, filterMissingPhoto])

  // Load Razorpay checkout script once
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.Razorpay) return
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    document.body.appendChild(s)
    return () => {
      try { document.body.removeChild(s) } catch(e) {}
    }
  }, [])

  const toggleSelect = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  // Handle clicking a student: start payment flow then show details on success
  const handleStudentClick = async (student) => {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        // show auth modal for email/password signup/login
        setShowAuthModal(true)
        setAuthMode('login')
        return;
      }

      const accessToken = session.access_token;
      const amount = 10;

      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, studentId: student.student_id, accessToken }),
      });
      const json = await res.json();
      if (json.error) return alert('Order creation failed: ' + json.error);
      const order = json.order;

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'Student Details',
        description: `Unlock details for ${student.name}`,
        order_id: order.id,
        handler: async function (response) {
          const verifyRes = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              accessToken,
            }),
          });
          const verifyJson = await verifyRes.json();
          if (verifyJson.ok) {
            // show full detail modal
            setDetail(student);
          } else {
            alert('Payment verification failed: ' + (verifyJson.error || 'unknown'));
          }
        },
        prefill: {
          email: session.user.email,
        },
        theme: { color: '#F37254' },
      };

      if (typeof window !== 'undefined' && window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        alert('Razorpay checkout not available. Ensure checkout script is loaded.');
      }
    } catch (err) {
      console.error(err);
      alert('Payment flow failed: ' + (err.message || err));
    }
  }

  // Auth helpers
  const handleAuthSubmit = async () => {
    if (!supabaseClient) return alert('Supabase not ready')
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabaseClient.auth.signUp({ email: authEmail, password: authPassword })
        if (error) return alert('Sign up error: ' + error.message)
        alert('Sign up successful. Check your email to confirm (if email confirmation is enabled).')
        setShowAuthModal(false)
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email: authEmail, password: authPassword })
        if (error) return alert('Sign in error: ' + error.message)
        setShowAuthModal(false)
      }
    } catch (err) {
      console.error(err)
      alert('Auth failed: ' + (err.message || err))
    }
  }

  const handleSignOut = async () => {
    if (!supabaseClient) return
    await supabaseClient.auth.signOut()
    setAuthUser(null)
    setIsAdmin(false)
  }

  const handleOAuthSignIn = async (provider) => {
    if (!supabaseClient) return alert('Supabase not ready')
    try {
      // Supabase will redirect to the provider's consent screen
      await supabaseClient.auth.signInWithOAuth({ provider })
    } catch (err) {
      console.error('OAuth sign in failed', err)
      alert('OAuth sign in failed: ' + (err.message || String(err)))
    }
  }

  if (!supabaseConfigValid) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold mb-2">Supabase configuration missing or invalid</h2>
        <p className="mb-2">Please set the following environment variables in your <code>.env</code> file and restart the dev server:</p>
        <ul className="list-disc pl-5">
          <li><code>NEXT_PUBLIC_SUPABASE_URL</code> — e.g. <code>https://&lt;your-project-ref&gt;.supabase.co</code></li>
          <li><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> — your public anon key</li>
        </ul>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-main flex flex-col md:flex-row">

      {/* SIDEBAR */}
      <aside className="w-full md:w-64 p-4 md:p-6 backdrop-blur-xl bg-sidebar-bg shadow-xl border-b md:border-b-0 md:border-r border-glass-border">

        <h1 className="text-xl md:text-2xl font-bold mb-6">Dashboard</h1>

        {/* Auth block */}
        <div className="mb-4">
          {authUser ? (
            <div className="text-sm">
              <p>Signed in as <strong>{authUser.email}</strong></p>
              <div className="mt-2 flex gap-2">
                <button className="px-3 py-1 rounded bg-glass-bg" onClick={handleSignOut}>Sign out</button>
                  {isAdmin && <>
                    <span className="px-2 py-1 rounded bg-green-600 text-white">Admin</span>
                    
                  </>}
              </div>
            </div>
          ) : (
            <div className="text-sm">
              <p className="mb-2">Sign in to unlock student details</p>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded bg-glass-bg" onClick={() => { setShowAuthModal(true); setAuthMode('login') }}>Sign in</button>
                <button className="px-3 py-1 rounded bg-glass-bg" onClick={() => { setShowAuthModal(true); setAuthMode('signup') }}>Sign up</button>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-1">Search</p>
            <input
              className="w-full px-3 py-2 rounded-lg bg-black/40 shadow focus:bg-black/90 "
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search..."
            />
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Filter Class</p>
            <select
              className="w-full px-3 py-2  rounded bg-black/40 focus:bg-black/90"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
            >
              <option value="">All Classes</option>

              <option>B. Voc.</option>
              <option>B.A - Bachelors</option>
              <option>B.Com - Bachelors</option>
              <option>B.Sc - Medical</option>
              <option>B.Sc - Non-Medical-1st Year College</option>
              <option>B.Sc - Non-Medical-2nd Year College</option>
              <option>B.Sc - Non-Medical-3rd Year College</option>
              <option>B.Sc. - Physical Science-1st Year College</option>
              <option>B.Sc. - Physical Science-2nd Year College</option>
              <option>B.Sc. - Physical Science-3rd Year College</option>

              <option>B.Sc. Hons. Biotechnology-1st Year College</option>
              <option>B.Sc. Hons. Biotechnology-2nd Year College</option>
              <option>B.Sc. Hons. Biotechnology-3rd Year College</option>

              <option>B.Tech - Computer Science and Engineering-1st Sem College</option>
              <option>B.Tech - Computer Science and Engineering-2nd Sem College</option>
              <option>B.Tech - Computer Science and Engineering-3rd Sem College</option>
              <option>B.Tech - Computer Science and Engineering-5th Sem College</option>
              <option>B.Tech - Computer Science and Engineering-6th Sem College</option>
              <option>B.Tech - Computer Science and Engineering-7th Sem College</option>
              <option>B.Tech - Computer Science and Engineering-8th Sem College</option>

              <option>BBA - Bachelor of Business Administration-1st Sem College</option>
              <option>BBA - Bachelor of Business Administration-2nd Sem College</option>
              <option>BBA - Bachelor of Business Administration-3rd Sem College</option>
              <option>BBA - Bachelor of Business Administration-4th Sem College</option>
              <option>BBA - Bachelor of Business Administration-5th Sem College</option>
              <option>BBA - Bachelor of Business Administration-6th Sem College</option>

              <option>BCA - Bachelor of Computer Application-1st Sem College</option>
              <option>BCA - Bachelor of Computer Application-2nd Sem College</option>
              <option>BCA - Bachelor of Computer Application-3rd Sem College</option>
              <option>BCA - Bachelor of Computer Application-4th Sem College</option>
              <option>BCA - Bachelor of Computer Application-5th Sem College</option>
              <option>BCA - Bachelor of Computer Application-6th Sem College</option>

              <option>M.A. English-1st Sem College</option>
              <option>M.A. English-2nd Sem College</option>
              <option>M.A. English-3rd Sem College</option>
              <option>M.A. English-4th Sem College</option>

              <option>M.Sc. Chemistry-1st Sem College</option>
              <option>M.Sc. Chemistry-2nd Sem College</option>
              <option>M.Sc. Chemistry-3rd Sem College</option>
              <option>M.Sc. Chemistry-4th Sem College</option>

              <option>M.Sc. Geography-1st Sem College</option>
              <option>M.Sc. Geography-2nd Sem College</option>
              <option>M.Sc. Geography-3rd Sem College</option>
              <option>M.Sc. Geography-4th Sem College</option>

              <option>Master of Business Administration - MBA-1st Sem College</option>
              <option>Master of Business Administration - MBA-3rd Sem College</option>
              <option>Master of Business Administration - MBA-3rd Year College</option>
              <option>Master of Business Administration - MBA-4th Sem College</option>

              <option>Master of Commerce</option>

              <option>Master of Computer Application - MCA-1st Sem College</option>
              <option>Master of Computer Application - MCA-2nd Sem College</option>
              <option>Master of Computer Application - MCA-3rd Sem College</option>
              <option>Master of Computer Application - MCA-4th Sem College</option>

              <option>PGDCA - Post Graduate Diploma in Computer Applications-1st Sem College</option>
              <option>PGDCA - Post Graduate Diploma in Computer Applications-2nd Sem College</option>
            </select>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Semester</p>
            <select
              className="w-full px-3 py-2 rounded bg-black/40 focus:bg-black/90 shadow"
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
            >
              <option value="">All Semesters</option>
              <option>1st Year</option>
              <option>2nd Year</option>
              <option>3rd Year</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filterMissingPhoto}
              onChange={(e) => setFilterMissingPhoto(e.target.checked)}
            />
            Missing Photo
          </label>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 md:p-10">
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Students Data </h2>
          <p className="text-gray-600 text-sm md:text-base">Total: {total}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {loading ? (
            <div className="col-span-full text-center p-6">Loading...</div>
          ) : students.length === 0 ? (
            <div className="col-span-full text-center p-6">No results</div>
          ) : (
            students.map((s) => (
              <div
                key={s.student_id}
                className="p-4 md:p-5 rounded-2xl shadow-xl bg-card-bg backdrop-blur border border-glass-border hover:shadow-2xl transition cursor-pointer"
                onClick={() => handleStudentClick(s)}
              >
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div style={{ position: 'relative' }}>
                    <img
                      src={s.photo_url || '/blank.png'}
                      className="h-28 w-28 sm:h-32 sm:w-32 rounded-xl object-cover shadow-md transform transition duration-300 hover:scale-110"
                    />
                        <div style={{ position: 'absolute', left: 6, bottom: 6, padding: '4px 8px', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 8, fontSize: 12 }}>
                          {isAdmin ? 'Admin: Free' : 'Unlock ₹10'}
                        </div>
                        {isAdmin && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetail(s) }}
                            style={{ position: 'absolute', right: 6, bottom: 6, padding: '6px 8px', background: '#10B981', color: '#fff', borderRadius: 8, fontSize: 12, border: 'none', cursor: 'pointer' }}
                          >
                            Unlock Free
                          </button>
                        )}
                  </div>
                  <div className="text-center sm:text-left" style={{ width: '100%' }}>
                    <h3 className="text-lg font-semibold text-text-main">
                      {s.name ? `${String(s.name).slice(0, 3)}...` : '—'}
                    </h3>
                    <div style={{ filter: 'blur(6px)', color: 'transparent', userSelect: 'none' }}>
                      <p className="text-sm text-text-light">Father: {s.father || '—'}</p>
                      <p className="text-sm text-text-light">Class: {s.class || '—'}</p>
                      <p className="text-sm text-text-light">Semester: {s.semester || '—'}</p>
                      <p className="text-sm text-text-light">Roll: {s.roll_no || '—'}</p>
                      <p className="text-sm text-text-light">Phone: {s.phone?.replace(/\.0$/, '') || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Auth modal */}
        {showAuthModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center p-4">
            <div className="bg-black/90 p-6 rounded-lg shadow-md w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">Sign in / Sign up</h3>
                <p className="text-sm mb-4">Use one of the providers below to sign in or create an account.</p>
                <div className="flex flex-col gap-3">
                  <button onClick={()=>handleOAuthSignIn('google')} className="w-full px-3 py-2 rounded bg-blue-600/60 text-white">Continue with Google</button>
                </div>
                <div className="mt-4 flex justify-end">
                  <button className="px-3 py-1 rounded bg-gray-700" onClick={()=>{ setShowAuthModal(false) }}>Close</button>
                </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between text-sm md:text-base">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-4 py-2 rounded bg-glass-bg shadow"
          >
            Prev
          </button>
          <p>Page {page}</p>
          <button
            disabled={page * pageSize >= total}
            onClick={() => setPage(page + 1)}
            className="px-4 py-2 rounded bg-glass-bg shadow"
          >
            Next
          </button>
        </div>
      </main>

      {/* MODAL */}
      {/* Admin panel modal */}
      {adminPanelOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-black/90 p-6 rounded shadow-md w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Admin Panel</h3>
              <button className="px-2 py-1 rounded bg-gray-600" onClick={()=>setAdminPanelOpen(false)}>Close</button>
            </div>
            <p className="text-sm mb-4">Selected students: {selected.size}</p>
            <div className="max-h-64 overflow-auto mb-4">
              {[...selected].slice(0,50).map(id => {
                const s = students.find(x=>String(x.student_id) === String(id))
                if (!s) return null
                return (
                  <div key={id} className="p-2 border-b flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-gray-600">ID: {s.student_id}</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-2 py-1 rounded bg-blue-600 text-white" onClick={()=>setDetail(s)}>View</button>
                      <button className="px-2 py-1 rounded bg-green-600 text-white" onClick={()=>{ setDetail(s); alert('Unlocked for free') }}>Unlock Free</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end">
              <button className="px-3 py-2 rounded bg-red-500 text-white" onClick={()=>{
                // clear selection
                setSelected(new Set())
                setAdminPanelOpen(false)
              }}>Clear Selection</button>
            </div>
          </div>
        </div>
      )}
      {detail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center p-4">
          <div className="bg-black/80 p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex justify-between mb-4">
              <h3 className="text-lg md:text-xl font-bold">{detail.name}</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400">
                ✕
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <img
                src={detail.photo_url || '/blank.png'}
                className="h-48 w-48 md:h-64 md:w-64 rounded-2xl object-cover shadow-lg"
              />

              <div className="space-y-2 text-sm md:text-base">
                <p>
                  <strong>Father:</strong> {detail.father || '—'}
                </p>
                <p>
                  <strong>Class:</strong> {detail.class || '—'}
                </p>
                <p>
                  <strong>Roll:</strong> {detail.roll_no || '—'}
                </p>
                <p>
                  <strong>Phone:</strong> {detail.phone?.replace(/\.0$/, '') || '—'}
                </p>
                <p>
                  <strong>Address:</strong> {detail.address || '—'}
                </p>
                <p>
                  <strong>Semester:</strong> {detail.semester || '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
