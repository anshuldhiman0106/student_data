'use client'
import React, { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { saveAs } from 'file-saver'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export default function StudentDashboard() {
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
    let query = supabase.from('students').select('*', { count: 'exact' })
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
    setLoading(true)
    const { data, count } = await buildQuery()
    setStudents(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  useEffect(() => {
    fetchStudents()
  }, [page, pageSize, search, filterClass, filterSemester, filterMissingPhoto])

  const toggleSelect = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)] flex flex-col md:flex-row">

      {/* SIDEBAR */}
      <aside className="w-full md:w-64 p-4 md:p-6 backdrop-blur-xl bg-[var(--sidebar-bg)] shadow-xl border-b md:border-b-0 md:border-r border-[var(--glass-border)]">
        <h1 className="text-xl md:text-2xl font-bold mb-6">Dashboard</h1>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-1">Search</p>
            <input
              className="w-full px-3 py-2 rounded-lg bg-[var(--glass-bg)] shadow focus:bg-white"
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
              className="w-full px-3 py-2 rounded bg-black/90 shadow"
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
              className="w-full px-3 py-2 rounded bg-black/90 shadow"
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
            >
              <option value="">All Semesters</option>
              <option>1st Sem</option>
              <option>2nd Sem</option>
              <option>3rd Sem</option>
              <option>4th Sem</option>
              <option>5th Sem</option>
              <option>6th Sem</option>
              <option>7th Sem</option>
              <option>8th Sem</option>
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
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Students</h2>
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
                className="p-4 md:p-5 rounded-2xl shadow-xl bg-[var(--card-bg)] backdrop-blur border border-[var(--glass-border)] hover:shadow-2xl transition cursor-pointer"
                onClick={() => setDetail(s)}
              >
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <img
                    src={s.photo_url || '/blank.png'}
                    className="h-28 w-28 sm:h-32 sm:w-32 rounded-xl object-cover shadow-md transform transition duration-300 hover:scale-110"
                  />
                  <div className="text-center sm:text-left">
                    <h3 className="text-lg font-semibold text-[var(--text-main)]">{s.name || '—'}</h3>
                    <p className="text-sm text-[var(--text-light)]">Father: {s.father || '—'}</p>
                    <p className="text-sm text-[var(--text-light)]">Class: {s.class || '—'}</p>
                    <p className="text-sm text-[var(--text-light)]">Semester: {s.semester || '—'}</p>
                    <p className="text-sm text-[var(--text-light)]">Roll: {s.roll_no || '—'}</p>
                    <p className="text-sm text-[var(--text-light)]">
                      Phone: {s.phone?.replace(/\.0$/, '') || '—'}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex items-center justify-between text-sm md:text-base">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-4 py-2 rounded bg-[var(--glass-bg)] shadow"
          >
            Prev
          </button>
          <p>Page {page}</p>
          <button
            disabled={page * pageSize >= total}
            onClick={() => setPage(page + 1)}
            className="px-4 py-2 rounded bg-[var(--glass-bg)] shadow"
          >
            Next
          </button>
        </div>
      </main>

      {/* MODAL */}
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
