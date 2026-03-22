import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'

export default function AdminLogin() {
    const navigate = useNavigate()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    const handleLogin = (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const adminUser = import.meta.env.VITE_ADMIN_USERNAME || 'admin'
        const adminPass = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123'

        // Small delay to feel like a real auth check
        setTimeout(() => {
            if (username === adminUser && password === adminPass) {
                sessionStorage.setItem('adminAuthenticated', 'true')
                navigate('/admin')
            } else {
                setError('Invalid admin credentials. Please try again.')
            }
            setLoading(false)
        }, 500)
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-900 via-purple-950 to-gray-900">
            {/* Decorative elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative max-w-md w-full space-y-8 bg-gray-800/80 backdrop-blur-xl shadow-2xl p-8 rounded-2xl border border-gray-700/50">
                <div className="text-center">
                    <div className="mx-auto w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mb-4 ring-2 ring-purple-500/30">
                        <Shield className="w-8 h-8 text-purple-400" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-white">
                        Admin Access
                    </h2>
                    <p className="mt-2 text-sm text-gray-400">
                        Enter admin credentials to access the dashboard
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm text-center font-medium animate-in fade-in duration-300">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300">Username</label>
                            <input
                                type="text"
                                required
                                autoComplete="username"
                                className="mt-1 block w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white transition-all"
                                placeholder="Enter admin username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300">Password</label>
                            <input
                                type="password"
                                required
                                autoComplete="current-password"
                                className="mt-1 block w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white transition-all"
                                placeholder="Enter admin password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 focus:ring-offset-gray-800 disabled:opacity-50 transition-all duration-200"
                    >
                        {loading ? (
                            <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Authenticating...
                            </span>
                        ) : 'Access Dashboard'}
                    </button>
                </form>

                <div className="text-center">
                    <button
                        type="button"
                        className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                        onClick={() => navigate('/')}
                    >
                        ← Back to User Login
                    </button>
                </div>
            </div>
        </div>
    )
}
