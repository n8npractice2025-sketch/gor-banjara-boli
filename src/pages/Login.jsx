import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Mic } from 'lucide-react'

export default function Login() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [isSignUp, setIsSignUp] = useState(false)

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    // Metadata for signup only
    const [name, setName] = useState('')
    const [gender, setGender] = useState('')
    const [age, setAge] = useState('')

    const [error, setError] = useState(null)
    const [successMsg, setSuccessMsg] = useState(null)

    const handleAuth = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccessMsg(null)

        try {
            if (!supabase.supabaseUrl || supabase.supabaseUrl === 'https://placeholder.supabase.co') {
                throw new Error('Supabase integration is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables (e.g., in Netlify settings).')
            }

            if (isSignUp) {
                if (!name || !gender || !age) {
                    throw new Error('Please fill in all profile details to sign up')
                }

                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            name,
                            gender,
                            age: parseInt(age)
                        }
                    }
                })
                if (error) throw error

                // Show success and redirect to login
                setSuccessMsg('Congratulations! Your account has been created and details are stored in the database. Please sign in to continue.')
                setIsSignUp(false)
                setPassword('')
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                })
                if (error) throw error
                navigate('/dashboard')
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
            <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 shadow-xl p-8 rounded-2xl border border-gray-100 dark:border-gray-700">
                <div className="text-center">
                    <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                        <Mic className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
                        Gor-Banjara Boli
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {isSignUp ? 'Create your account to start contributing' : 'Sign in to continue recording'}
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleAuth}>
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-md text-sm text-center font-medium">
                            {error}
                        </div>
                    )}
                    {successMsg && (
                        <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-4 rounded-md text-sm text-center font-medium border border-green-200 dark:border-green-800">
                            {successMsg}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
                            <input
                                type="email"
                                required
                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-white"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                            <input
                                type="password"
                                required
                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-white"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        {isSignUp && (
                            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-2 duration-300">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-gray-900 dark:text-white"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gender</label>
                                        <select
                                            className="mt-1 block w-full pl-3 pr-10 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-white"
                                            value={gender}
                                            onChange={(e) => setGender(e.target.value)}
                                        >
                                            <option value="">Select...</option>
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Age</label>
                                        <input
                                            type="number"
                                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-gray-900 dark:text-white"
                                            value={age}
                                            onChange={(e) => setAge(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                        >
                            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                        </button>
                    </div>
                </form>

                <div className="text-center">
                    <button
                        type="button"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        onClick={() => {
                            setIsSignUp(!isSignUp)
                            setError(null)
                            setSuccessMsg(null)
                        }}
                    >
                        {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                    </button>
                </div>
            </div>
        </div>
    )
}
