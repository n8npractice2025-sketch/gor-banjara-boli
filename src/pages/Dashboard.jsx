import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import SentenceCard from '../components/SentenceCard'
import Recorder from '../components/Recorder'

export default function Dashboard() {
    const navigate = useNavigate()
    const [user, setUser] = useState(null)

    const [sentence, setSentence] = useState(null)
    const [completedCount, setCompletedCount] = useState(0)
    const [totalCount, setTotalCount] = useState(0)

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        checkUser()
    }, [])

    const checkUser = async () => {
        try {
            const { data: { user }, error } = await supabase.auth.getUser()
            if (error || !user) {
                navigate('/')
                return
            }
            setUser(user)
            await fetchProgress(user.id)
            await fetchNextSentence(user.id)
        } catch (err) {
            console.error(err)
            setError('Authentication error. Please sign in again.')
        } finally {
            setLoading(false)
        }
    }

    const fetchProgress = async (userId) => {
        try {
            const { count, error } = await supabase
                .from('recordings')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)

            if (error) throw error
            setCompletedCount(count || 0)
        } catch (err) {
            console.error('Error fetching progress:', err)
        }
    }

    const fetchNextSentence = async (userId) => {
        try {
            setSentence(null)

            // Step 1: Get all sentence IDs the user has ALREADY recorded
            const { data: recordings } = await supabase
                .from('recordings')
                .select('sentence_id')
                .eq('user_id', userId)

            const recordedIds = recordings?.map(r => r.sentence_id) || []

            // Step 2: Fetch a random sentence NOT IN that list
            const query = supabase.from('sentences').select('*')

            if (recordedIds.length > 0) {
                query.not('id', 'in', `(${recordedIds.join(',')})`)
            }

            const { data: sentences, error } = await query.limit(1)

            if (error) throw error

            if (sentences && sentences.length > 0) {
                setSentence(sentences[0])
            } else {
                // Run out of new sentences!
                setError('Congratulations! You have recorded all available sentences.')
            }

        } catch (err) {
            console.error('Error fetching sentences:', err)
            setError('Failed to fetch the next sentence.')
        }
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        navigate('/')
    }

    const handleUploadSuccess = () => {
        // Refresh count and get newest sentence
        if (user) {
            fetchProgress(user.id)
            fetchNextSentence(user.id)
        }
    }

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 border text-gray-400">Loading your dashboard...</div>
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans pb-12">
            {/* Navigation Header */}
            <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex-shrink-0 flex items-center">
                            <h1 className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                                Gor-Banjara Data Collector
                            </h1>
                        </div>
                        {user && (
                            <div className="flex items-center space-x-4">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                    {user.user_metadata?.name || user.email}
                                </span>
                                <button
                                    onClick={handleSignOut}
                                    className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 transition-colors"
                                >
                                    Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
                {error ? (
                    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-8 text-center text-blue-800 dark:text-blue-300 font-medium text-lg">
                        {error}
                    </div>
                ) : (
                    <div className="space-y-8 animate-in slide-in-from-bottom duration-700">
                        {/* 1. Sentence Display */}
                        <SentenceCard
                            sentence={sentence}
                            completedCount={completedCount}
                            totalCount={totalCount}
                        />

                        {/* 2. Recorder Component */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                                <h3 className="text-sm font-medium text-gray-500 tracking-wider uppercase">
                                    Voice Recording
                                </h3>
                            </div>
                            <Recorder
                                sentence={sentence}
                                user={user}
                                onUploadSuccess={handleUploadSuccess}
                            />
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
