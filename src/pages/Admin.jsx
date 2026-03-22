import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const ITEMS_PER_PAGE = 25

export default function Admin() {
    const navigate = useNavigate()
    const [recordings, setRecordings] = useState([])
    const [sentences, setSentences] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Stats
    const [totalRecordings, setTotalRecordings] = useState(0)
    const [uniqueUsers, setUniqueUsers] = useState(0)
    const [totalSentences, setTotalSentences] = useState(0)

    // Search & filter
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')

    // Pagination
    const [currentPage, setCurrentPage] = useState(0)
    const [hasMore, setHasMore] = useState(false)

    // Audio playback
    const [playingId, setPlayingId] = useState(null)
    const audioRef = useRef(null)

    // Modals
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [editTarget, setEditTarget] = useState(null)
    const [editForm, setEditForm] = useState({})
    const [editAudioFile, setEditAudioFile] = useState(null)
    const [saving, setSaving] = useState(false)

    // Auth guard — check sessionStorage
    useEffect(() => {
        const isAdmin = sessionStorage.getItem('adminAuthenticated')
        if (isAdmin !== 'true') {
            navigate('/admin-login')
            return
        }
        fetchAll()
    }, [])

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery)
            setCurrentPage(0)
        }, 400)
        return () => clearTimeout(timer)
    }, [searchQuery])

    // Refetch when page or search changes
    useEffect(() => {
        fetchRecordings()
    }, [currentPage, debouncedSearch])

    const fetchAll = async () => {
        setLoading(true)
        try {
            await Promise.all([fetchStats(), fetchRecordings(), fetchSentences()])
        } catch (err) {
            setError('Failed to load data.')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const fetchStats = async () => {
        const [recCount, sentCount] = await Promise.all([
            supabase.from('recordings').select('*', { count: 'exact', head: true }),
            supabase.from('sentences').select('*', { count: 'exact', head: true })
        ])
        setTotalRecordings(recCount.count || 0)
        setTotalSentences(sentCount.count || 0)

        const { data: emails } = await supabase.from('recordings').select('email')
        const uniqueEmails = new Set(emails?.map(r => r.email).filter(Boolean))
        setUniqueUsers(uniqueEmails.size)
    }

    const fetchSentences = async () => {
        const { data } = await supabase.from('sentences').select('*').order('id')
        setSentences(data || [])
    }

    const fetchRecordings = async () => {
        try {
            const from = currentPage * ITEMS_PER_PAGE
            const to = from + ITEMS_PER_PAGE

            let query = supabase
                .from('recordings')
                .select(`*, sentences ( sentence )`)
                .order('created_at', { ascending: false })
                .range(from, to)

            if (debouncedSearch) {
                query = query.or(`name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`)
            }

            const { data, error } = await query
            if (error) throw error

            // If we got ITEMS_PER_PAGE + 1 results, there are more pages
            if (data && data.length > ITEMS_PER_PAGE) {
                setHasMore(true)
                setRecordings(data.slice(0, ITEMS_PER_PAGE))
            } else {
                setHasMore(false)
                setRecordings(data || [])
            }
        } catch (err) {
            console.error('Error fetching recordings:', err)
            setError('Failed to load recordings.')
        }
    }

    // --- Audio Playback ---
    const handlePlay = (recordingId, audioUrl) => {
        if (playingId === recordingId) {
            audioRef.current?.pause()
            setPlayingId(null)
            return
        }
        if (audioRef.current) {
            audioRef.current.pause()
        }
        const audio = new Audio(audioUrl)
        audioRef.current = audio
        audio.play()
        setPlayingId(recordingId)
        audio.onended = () => setPlayingId(null)
        audio.onerror = () => {
            setPlayingId(null)
            alert('Failed to play audio. The file may be missing or corrupted.')
        }
    }

    // --- Delete ---
    const handleDelete = async () => {
        if (!deleteTarget) return
        setSaving(true)
        try {
            // Extract filename from audio_url for storage deletion
            if (deleteTarget.audio_url) {
                const urlParts = deleteTarget.audio_url.split('/')
                const fileName = urlParts[urlParts.length - 1]
                // Attempt storage file removal (ignore error if file already gone)
                await supabase.storage.from('audio-recordings').remove([fileName])
            }

            // Remove from recordings table
            const { error } = await supabase
                .from('recordings')
                .delete()
                .eq('id', deleteTarget.id)

            if (error) throw error

            setRecordings(prev => prev.filter(r => r.id !== deleteTarget.id))
            setTotalRecordings(prev => prev - 1)
            setDeleteTarget(null)
        } catch (err) {
            console.error('Delete failed:', err)
            alert('Failed to delete recording: ' + (err.message || 'Unknown error'))
        } finally {
            setSaving(false)
        }
    }

    // --- Edit ---
    const openEditModal = (recording) => {
        setEditTarget(recording)
        setEditForm({
            name: recording.name || '',
            email: recording.email || '',
            age: recording.age || '',
            gender: recording.gender || '',
            sentence_id: recording.sentence_id || ''
        })
        setEditAudioFile(null)
    }

    const handleEditSave = async () => {
        if (!editTarget) return
        setSaving(true)
        try {
            let updatedAudioUrl = editTarget.audio_url

            // If admin uploaded a replacement audio file
            if (editAudioFile) {
                const timestamp = Date.now()
                const extension = editAudioFile.name.split('.').pop() || 'webm'
                const newFileName = `admin_replace_${editTarget.id}_${timestamp}.${extension}`

                const { error: uploadError } = await supabase.storage
                    .from('audio-recordings')
                    .upload(newFileName, editAudioFile, { contentType: editAudioFile.type })

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('audio-recordings')
                    .getPublicUrl(newFileName)

                updatedAudioUrl = publicUrl

                // Remove old file from storage
                if (editTarget.audio_url) {
                    const oldParts = editTarget.audio_url.split('/')
                    const oldFileName = oldParts[oldParts.length - 1]
                    await supabase.storage.from('audio-recordings').remove([oldFileName])
                }
            }

            const { error } = await supabase
                .from('recordings')
                .update({
                    name: editForm.name,
                    email: editForm.email,
                    age: editForm.age ? parseInt(editForm.age) : null,
                    gender: editForm.gender,
                    sentence_id: editForm.sentence_id ? parseInt(editForm.sentence_id) : editTarget.sentence_id,
                    audio_url: updatedAudioUrl
                })
                .eq('id', editTarget.id)

            if (error) throw error

            // Refresh data
            await fetchRecordings()
            await fetchStats()
            setEditTarget(null)
        } catch (err) {
            console.error('Edit failed:', err)
            alert('Failed to save changes: ' + (err.message || 'Unknown error'))
        } finally {
            setSaving(false)
        }
    }

    // --- CSV Download ---
    const downloadCSV = () => {
        if (recordings.length === 0) return
        const headers = ['ID', 'Name', 'Email', 'Age', 'Gender', 'Telugu Sentence', 'Audio Link', 'Date Submitted']
        const csvRows = [headers.join(',')]
        recordings.forEach(rec => {
            const row = [
                rec.id,
                `"${rec.name || ''}"`,
                `"${rec.email || ''}"`,
                rec.age || '',
                `"${rec.gender || ''}"`,
                `"${rec.sentences?.sentence || ''}"`,
                `"${rec.audio_url || ''}"`,
                `"${new Date(rec.created_at).toLocaleString()}"`
            ]
            csvRows.push(row.join(','))
        })
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `gor_banjara_recordings_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleSignOut = () => {
        sessionStorage.removeItem('adminAuthenticated')
        navigate('/admin-login')
    }

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-gray-400 space-y-4">
                <svg className="animate-spin h-10 w-10 text-purple-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm">Loading admin dashboard...</span>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-900 font-sans pb-12">
            {/* ===== NAVIGATION ===== */}
            <nav className="bg-gray-800/90 backdrop-blur-md shadow-lg border-b border-gray-700/50 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center space-x-4">
                            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center ring-1 ring-purple-500/30">
                                <ShieldIcon className="w-5 h-5 text-purple-400" />
                            </div>
                            <h1 className="text-xl font-bold tracking-tight text-white">
                                Admin Dashboard
                            </h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                            >
                                User App →
                            </button>
                            <button
                                onClick={handleSignOut}
                                className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
                {/* ===== STATS CARDS ===== */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <StatCard label="Total Recordings" value={totalRecordings} color="purple" icon={<MicIcon className="w-6 h-6" />} />
                    <StatCard label="Unique Users" value={uniqueUsers} color="blue" icon={<UsersIcon className="w-6 h-6" />} />
                    <StatCard label="Total Sentences" value={totalSentences} color="emerald" icon={<TextIcon className="w-6 h-6" />} />
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center text-red-400 font-medium text-lg mb-8">
                        {error}
                    </div>
                )}

                {/* ===== TOOLBAR ===== */}
                <div className="bg-gray-800/60 backdrop-blur rounded-t-2xl border border-gray-700/50 border-b-0 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="relative w-full sm:w-80">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={downloadCSV}
                        disabled={recordings.length === 0}
                        className="flex items-center space-x-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40 transition-all"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        <span>Download CSV</span>
                    </button>
                </div>

                {/* ===== TABLE ===== */}
                <div className="bg-gray-800/40 rounded-b-2xl border border-gray-700/50 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-700/50">
                            <thead className="bg-gray-800/80">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Telugu Sentence</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Audio</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700/30">
                                {recordings.map((rec) => (
                                    <tr key={rec.id} className="hover:bg-gray-700/20 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-white">{rec.name || 'Anonymous'}</div>
                                            <div className="text-xs text-gray-500">{rec.email}</div>
                                            <div className="text-xs text-gray-600 mt-0.5">
                                                {rec.gender && `${rec.gender}`}{rec.age && ` • ${rec.age} yrs`}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-300 max-w-sm whitespace-normal leading-relaxed">
                                                {rec.sentences?.sentence || 'Unknown'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {rec.audio_url ? (
                                                <button
                                                    onClick={() => handlePlay(rec.id, rec.audio_url)}
                                                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                        playingId === rec.id
                                                            ? 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40'
                                                            : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white'
                                                    }`}
                                                >
                                                    {playingId === rec.id ? (
                                                        <>
                                                            <PauseIcon className="w-4 h-4" />
                                                            <span>Playing</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <PlayIcon className="w-4 h-4" />
                                                            <span>Play</span>
                                                        </>
                                                    )}
                                                </button>
                                            ) : (
                                                <span className="text-xs text-gray-600 italic">No audio</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(rec.created_at).toLocaleDateString('en-IN', {
                                                year: 'numeric', month: 'short', day: 'numeric'
                                            })}
                                            <div className="text-xs text-gray-600">
                                                {new Date(rec.created_at).toLocaleTimeString('en-IN', {
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex items-center justify-center space-x-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEditModal(rec)}
                                                    className="p-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                                                    title="Edit recording"
                                                >
                                                    <EditIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget(rec)}
                                                    className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                    title="Delete recording"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {recordings.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-16 text-center text-gray-500">
                                            {debouncedSearch ? 'No recordings match your search.' : 'No recordings have been submitted yet.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-6 py-4 border-t border-gray-700/30 flex items-center justify-between bg-gray-800/50">
                        <span className="text-sm text-gray-500">
                            Page {currentPage + 1} • Showing {recordings.length} recordings
                        </span>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                                disabled={currentPage === 0}
                                className="px-3 py-1.5 text-sm rounded-lg bg-gray-700/50 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                ← Prev
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => p + 1)}
                                disabled={!hasMore}
                                className="px-3 py-1.5 text-sm rounded-lg bg-gray-700/50 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* ===== DELETE CONFIRMATION MODAL ===== */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !saving && setDeleteTarget(null)}>
                    <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                                <TrashIcon className="w-5 h-5 text-red-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">Delete Recording</h3>
                        </div>
                        <p className="text-sm text-gray-400">
                            Are you sure you want to delete this recording by <strong className="text-gray-200">{deleteTarget.name || 'Unknown'}</strong>?
                            This will remove the audio file and database entry permanently.
                        </p>
                        <div className="flex justify-end space-x-3 pt-2">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                            >
                                {saving ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                                        <span>Deleting...</span>
                                    </>
                                ) : <span>Delete</span>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== EDIT MODAL ===== */}
            {editTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !saving && setEditTarget(null)}>
                    <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                                <EditIcon className="w-5 h-5 text-blue-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">Edit Recording</h3>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={editForm.name}
                                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                                <input
                                    type="email"
                                    className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={editForm.email}
                                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Gender</label>
                                    <select
                                        className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        value={editForm.gender}
                                        onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}
                                    >
                                        <option value="">Select...</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Age</label>
                                    <input
                                        type="number"
                                        className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        value={editForm.age}
                                        onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Assigned Sentence</label>
                                <select
                                    className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={editForm.sentence_id}
                                    onChange={e => setEditForm(f => ({ ...f, sentence_id: e.target.value }))}
                                >
                                    <option value="">Select sentence...</option>
                                    {sentences.map(s => (
                                        <option key={s.id} value={s.id}>#{s.id} — {s.sentence}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Replace Audio File <span className="text-gray-600">(optional)</span></label>
                                <input
                                    type="file"
                                    accept="audio/*"
                                    className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-500/20 file:text-purple-300 hover:file:bg-purple-500/30 file:cursor-pointer file:transition-colors"
                                    onChange={e => setEditAudioFile(e.target.files?.[0] || null)}
                                />
                            </div>
                            {editTarget.audio_url && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Current Audio</label>
                                    <audio controls src={editTarget.audio_url} className="w-full h-10" preload="metadata" />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end space-x-3 pt-2">
                            <button
                                onClick={() => setEditTarget(null)}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditSave}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                            >
                                {saving ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                                        <span>Saving...</span>
                                    </>
                                ) : <span>Save Changes</span>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ===== STAT CARD COMPONENT =====
function StatCard({ label, value, color, icon }) {
    const colorMap = {
        purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
        blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
        emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400'
    }
    return (
        <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-xl p-5 flex items-center space-x-4`}>
            <div className={`${colorMap[color].split(' ').pop()} opacity-80`}>{icon}</div>
            <div>
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</div>
            </div>
        </div>
    )
}

// ===== INLINE SVG ICONS =====
function ShieldIcon({ className }) {
    return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>)
}
function MicIcon({ className }) {
    return (<svg className={className} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>)
}
function UsersIcon({ className }) {
    return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>)
}
function TextIcon({ className }) {
    return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>)
}
function SearchIcon({ className }) {
    return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>)
}
function DownloadIcon({ className }) {
    return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>)
}
function PlayIcon({ className }) {
    return (<svg className={className} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>)
}
function PauseIcon({ className }) {
    return (<svg className={className} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>)
}
function EditIcon({ className }) {
    return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>)
}
function TrashIcon({ className }) {
    return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>)
}
